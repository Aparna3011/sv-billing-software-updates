const { addMonths, formatISO, differenceInDays, isAfter } = require("date-fns");

const { getDb } = require("../db/database");
const { ensureService } = require("./gst.service");

const { createInvoice } = require("./invoice.service");
const numbering = require("./numbering.service"); // Import numbering service
const activity = require("./activitylog.service");

function getCycleMonths(billing_cycle, custom_billing_cycle) {
  switch (billing_cycle) {
    case "monthly":
      return 1;

    case "quarterly":
      return 3;

    case "half_yearly":
      return 6;

    case "yearly":
      return 12;

    case "custom":
      return Number(custom_billing_cycle || 1);

    default:
      return 1;
  }
}

function advance(date, billing_cycle, custom_billing_cycle) {
  const base = new Date(date);

  return addMonths(base, getCycleMonths(billing_cycle, custom_billing_cycle));
}

function dateOnly(value) {
  return value ? new Date(value).toISOString().split("T")[0] : null;
}

function getActiveCycleRow(db, recurringInvoiceId, activeStartDate) {
  if (!activeStartDate) return null;

  return db
    .prepare(
      `
      SELECT *
      FROM recurring_invoice_history
      WHERE recurring_invoice_id = ?
        AND date(invoice_start_date) = date(?)
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(recurringInvoiceId, activeStartDate);
}

function deleteDuplicateGeneratedCycles(db, recurringInvoiceId, cycleStartDate) {
  if (!cycleStartDate) return;

  db.prepare(
    `
      DELETE FROM recurring_invoice_history
      WHERE recurring_invoice_id = ?
        AND action_type = 'cycle_generated'
        AND date(invoice_start_date) = date(?)
        AND id NOT IN (
          SELECT MIN(id)
          FROM recurring_invoice_history
          WHERE recurring_invoice_id = ?
            AND action_type = 'cycle_generated'
            AND date(invoice_start_date) = date(?)
        )
    `,
  ).run(
    recurringInvoiceId,
    cycleStartDate,
    recurringInvoiceId,
    cycleStartDate,
  );
}

function deleteGeneratedCyclesAfter(db, recurringInvoiceId, cycleStartDate) {
  if (!cycleStartDate) return;

  db.prepare(
    `
      DELETE FROM recurring_invoice_history
      WHERE recurring_invoice_id = ?
        AND action_type = 'cycle_generated'
        AND date(invoice_start_date) > date(?)
    `,
  ).run(recurringInvoiceId, cycleStartDate);
}

/**
 * Helper to calculate GST totals and process items for recurring plans.
 */
function calculateGSTTotals({
  items,
  subtotal,
  discount,
  discount_is_percent,
  sameState,
  isOverseas,
  isGstEnabled = true,
}) {
  const s = Number(subtotal || 0);
  const d = Number(discount || 0);
  const discountAmount = discount_is_percent ? (s * d) / 100 : d;

  let cgst_total = 0,
    sgst_total = 0,
    igst_total = 0;

  const processedItems = (items || []).map((item) => {
    const qty = Number(item.qty || 1);
    const rate = Number(item.rate || 0);
    const lineTotal = qty * rate;
    const gstRate = isGstEnabled ? Number(item.gst_rate || 0) : 0;

    const itemDiscount = s > 0 ? (lineTotal / s) * discountAmount : 0;
    const taxableAmount = Math.max(0, lineTotal - itemDiscount);
    const gstAmount = (taxableAmount * gstRate) / 100;

    let cgst = 0,
      sgst = 0,
      igst = 0;
    if (!isOverseas) {
      if (sameState) {
        cgst = Number((gstAmount / 2).toFixed(2));
        sgst = Number((gstAmount - cgst).toFixed(2));
      } else {
        igst = Number(gstAmount.toFixed(2));
      }
    }

    cgst_total += cgst;
    sgst_total += sgst;
    igst_total += igst;

    return {
      ...item,
      qty,
      rate,
      gst_rate: gstRate,
      cgst,
      sgst,
      igst,
      line_total: lineTotal,
    };
  });

  const cgst_total_fixed = Number(cgst_total.toFixed(2));
  const sgst_total_fixed = Number(sgst_total.toFixed(2));
  const igst_total_fixed = Number(igst_total.toFixed(2));
  const tax_total = Number(
    (cgst_total_fixed + sgst_total_fixed + igst_total_fixed).toFixed(2),
  );
  const grand_total = Math.round(s - discountAmount + tax_total);

  return {
    items: processedItems,
    cgst_total: cgst_total_fixed,
    sgst_total: sgst_total_fixed,
    igst_total: igst_total_fixed,
    tax_total,
    grand_total,
  };
}

/**
 * Updates the collection status and pending amounts for a billing plan
 * and logs the event to the history timeline.
 */
function syncRecurringLifecycle(db, recurringInvoiceId, actionData = {}) {
  const plan = db
    .prepare(
      `
      SELECT 
        ri.*, 
        r.customer_id,
        COALESCE(ri.start_date, date('now')) as current_cycle_start
      FROM recurring_invoices ri 
      JOIN recurring r ON r.id = ri.recurring_id 
      WHERE ri.id = ?
    `,
    )
    .get(recurringInvoiceId);

  if (!plan) return;

  const activeStartDate = dateOnly(plan.start_date);
  const actionStartDate = dateOnly(actionData.invoice_start_date);
  const currentStartDate = actionStartDate || activeStartDate;

  if (actionData.action_type === "payment_voided") {
    deleteGeneratedCyclesAfter(db, recurringInvoiceId, currentStartDate);
    if (currentStartDate) {
      db.prepare("UPDATE recurring_invoices SET start_date = ? WHERE id = ?").run(
        currentStartDate,
        recurringInvoiceId,
      );
    }
  }

  const activeCycle = getActiveCycleRow(
    db,
    recurringInvoiceId,
    currentStartDate,
  );

  const normalizedNextDate = dateOnly(
    actionData.next_invoice_date ||
      activeCycle?.next_invoice_date ||
      (currentStartDate
        ? formatISO(
            advance(
              currentStartDate,
              plan.billing_cycle,
              plan.custom_billing_cycle,
            ),
            { representation: "date" },
          )
        : plan.start_date),
  );
  const currentNextDate = normalizedNextDate;

  const grand_total = Number(plan.grand_total || 0);
  const incoming_amount = Number(actionData.amount || 0);

  let paid_amount = activeCycle ? Number(activeCycle.paid_amount || 0) : 0;
  let pending_amount = activeCycle
    ? Number(activeCycle.pending_amount)
    : grand_total;

  const today = new Date();
  const dueDate = currentNextDate ? new Date(currentNextDate) : today;

  let status = "pending";
  let overdue_days = 0;

  const referenceDate = actionData.payment_date
    ? new Date(actionData.payment_date)
    : today;
  if (isAfter(referenceDate, dueDate)) {
    overdue_days = differenceInDays(referenceDate, dueDate);
  }

  if (actionData.action_type === "payment_received") {
    const latestPaymentAction = actionData.payment_id
      ? db
          .prepare(
            `
            SELECT action_type
            FROM recurring_invoice_history
            WHERE recurring_invoice_id = ?
              AND payment_id = ?
              AND action_type IN ('payment_received', 'payment_voided')
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          `,
          )
          .get(recurringInvoiceId, actionData.payment_id)
      : null;

    if (latestPaymentAction?.action_type === "payment_received") {
      return {
        status: activeCycle?.collection_status || "pending",
        pending_amount,
        paid_amount,
      };
    }

    paid_amount += incoming_amount;
    pending_amount = Math.max(0, pending_amount - incoming_amount);
  } else if (actionData.action_type === "payment_voided") {
    paid_amount = Math.max(0, paid_amount - incoming_amount);
    pending_amount = Math.min(grand_total, pending_amount + incoming_amount);
  } else if (
    ["cycle_generated", "plan_created", "recurring_updated"].includes(
      actionData.action_type,
    )
  ) {
    paid_amount =
      actionData.paid_amount !== undefined ? Number(actionData.paid_amount) : 0;
    pending_amount =
      actionData.pending_amount !== undefined
        ? Number(actionData.pending_amount)
        : grand_total;
  }

  if (pending_amount <= 0) {
    status = "completed";
  } else if (paid_amount > 0) {
    status = "partially_paid";
  }

  if (pending_amount > 0 && overdue_days > 0) {
    status = "overdue";
  }

  // Log to history
  db.prepare(
    `
    INSERT INTO recurring_invoice_history (
      recurring_invoice_id, payment_id, action_type, action_status,
      action_notes, amount, payment_date, due_date,
      paid_amount, pending_amount, overdue_days, collection_status,
      invoice_start_date, next_invoice_date, paid_on_date, last_generated_at
    ) VALUES (
      @recurring_invoice_id, @payment_id, @action_type, @action_status,
      @action_notes, @amount, @payment_date, @due_date,
      @paid_amount, @pending_amount, @overdue_days, @collection_status,
      @invoice_start_date, @next_invoice_date, @paid_on_date, @last_generated_at
    )
  `,
  ).run({
    recurring_invoice_id: recurringInvoiceId,
    payment_id: actionData.payment_id || null,
    action_type:
      actionData.action_type ||
      (paid_amount >= grand_total ? "payment_completed" : "payment_received"),
    action_status: actionData.action_status || null, // Added missing column
    action_notes: actionData.notes || actionData.action_notes || "",
    amount: actionData.amount || 0,
    payment_date: actionData.payment_date || null,
    due_date: actionData.due_date || currentNextDate, // Use actionData.due_date if provided, otherwise currentNextDate
    paid_amount:
      actionData.paid_amount !== undefined
        ? actionData.paid_amount
        : paid_amount,
    pending_amount:
      actionData.pending_amount !== undefined
        ? actionData.pending_amount
        : pending_amount,
    overdue_days:
      actionData.overdue_days !== undefined
        ? actionData.overdue_days
        : overdue_days,
    collection_status:
      actionData.collection_status !== undefined
        ? actionData.collection_status
        : status,
    invoice_start_date: currentStartDate,
    next_invoice_date: normalizedNextDate,
    paid_on_date:
      actionData.paid_on_date !== undefined
        ? actionData.paid_on_date
        : status === "completed"
          ? actionData.payment_date ||
            formatISO(new Date(), { representation: "date" })
          : null,
    last_generated_at: actionData.last_generated_at || null,
  });

  // If completed, trigger cycle advancement logic
  if (status === "completed" && actionData.action_type !== "cycle_generated") {
    // The end of the current cycle becomes the start of the next cycle
    const nextCycleStartDate = currentNextDate;
    // Calculate the actual next invoice date for the new cycle
    const nextCycleNextDate = formatISO(
      advance(
        nextCycleStartDate,
        plan.billing_cycle,
        plan.custom_billing_cycle,
      ),
      { representation: "date" },
    );

    // IDEMPOTENCY CHECK: Do not generate a new cycle if it already exists for this date
    const existingCycle = db.prepare(`
      SELECT id FROM recurring_invoice_history
      WHERE recurring_invoice_id = ?
      AND invoice_start_date = ?
      AND action_type = 'cycle_generated'
      LIMIT 1
    `).get(recurringInvoiceId, nextCycleStartDate);

    if (existingCycle) {
      deleteDuplicateGeneratedCycles(db, recurringInvoiceId, nextCycleStartDate);
      // Master plan must still be updated to ensure it points to the future
      db.prepare("UPDATE recurring_invoices SET start_date = ? WHERE id = ?").run(
        nextCycleStartDate,
        recurringInvoiceId,
      );
      return { status, pending_amount, paid_amount };
    }

    // 1. Update master plan start_date to the next cycle date
    db.prepare("UPDATE recurring_invoices SET start_date = ? WHERE id = ?").run(
      nextCycleStartDate,
      recurringInvoiceId,
    );

    // 2. Immediately insert a next pending cycle history row
    syncRecurringLifecycle(db, recurringInvoiceId, {
      action_type: "cycle_generated",
      action_notes: `New cycle started. Next invoice due on ${nextCycleNextDate}`,
      amount: plan.grand_total, // The full amount for the new cycle
      payment_id: null,
      payment_date: null,
      invoice_start_date: nextCycleStartDate,
      next_invoice_date: nextCycleNextDate,
      due_date: nextCycleNextDate,
      paid_amount: 0, // Explicitly reset for new pending cycle
      pending_amount: plan.grand_total, // Explicitly set to full grand_total
      collection_status: "pending", // Explicitly set to pending
      paid_on_date: null, // Explicitly reset
      overdue_days: 0,
      last_generated_at: formatISO(new Date()), // Store exact generation timestamp in history
    });
  }

  return { status, pending_amount, paid_amount };
}

function getRecurring(id, light = false) {
  const db = getDb();

  const recurring = db
    .prepare(
      `
  SELECT
    r.*,

    c.company_name,
    c.contact_person,
    c.email,
    c.phone,
    c.gstin,
    c.address,
    c.city,
    c.state,
    c.gst_treatment,
    c.country,

    i.id AS invoice_id,
    i.invoice_no,
    i.invoice_date,
    i.status AS invoice_status,
    i.grand_total AS invoice_total,

    co.state AS company_state

  FROM recurring r

  LEFT JOIN customers c
    ON c.id = r.customer_id

  LEFT JOIN company co
    ON co.id = 1

  LEFT JOIN invoices i
    ON i.id = r.invoice_id

  WHERE r.id = ?
`,
    )
    .get(id);

  if (!recurring) return null;

  let invoiceItems = [];

  if (recurring.invoice_id) {
    invoiceItems = db
      .prepare(
        `
    SELECT
      name

    FROM invoice_items

    WHERE invoice_id = ?
  `,
      )
      .all(recurring.invoice_id);
  }

  const templates = db
    .prepare(
      `
    SELECT 
      ri.*,
      ri.recurring_invoice_no,
      (
        SELECT collection_status FROM recurring_invoice_history 
        WHERE recurring_invoice_id = ri.id 
          AND date(invoice_start_date) = date(ri.start_date)
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) as current_status,
      (
        SELECT next_invoice_date FROM recurring_invoice_history 
        WHERE recurring_invoice_id = ri.id 
          AND date(invoice_start_date) = date(ri.start_date)
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) as current_next_date,
      (
        SELECT pending_amount FROM recurring_invoice_history 
        WHERE recurring_invoice_id = ri.id 
          AND date(invoice_start_date) = date(ri.start_date)
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) as current_pending_amount,
      (
        SELECT paid_amount FROM recurring_invoice_history 
        WHERE recurring_invoice_id = ri.id 
          AND date(invoice_start_date) = date(ri.start_date)
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) as current_paid_amount

    FROM recurring_invoices ri

    WHERE ri.recurring_id = ? AND ri.is_deleted = 0

    ORDER BY ri.id
  `,
    )
    .all(id);

  recurring.templates = templates.map((template) => {
    const items = loadRecurringItems(db, template.id);

    const paid_amount = Number(template.current_paid_amount || 0);
    const pending_amount =
      template.current_pending_amount === null ||
      template.current_pending_amount === undefined
        ? Number(template.grand_total || 0)
        : Number(template.current_pending_amount || 0);
    const next_invoice_date =
      template.current_next_date ||
      (template.start_date
        ? formatISO(
            advance(
              template.start_date,
              template.billing_cycle,
              template.custom_billing_cycle,
            ),
            { representation: "date" },
          )
        : null);

    // Dynamic status calculation for UI - handles passive overdue status
    let currentStatus = template.current_status || "pending";
    if (
      currentStatus !== "completed" &&
      !template.is_stopped &&
      pending_amount > 0
    ) {
      const todayStr = new Date().toISOString().split("T")[0];
      if (next_invoice_date && next_invoice_date < todayStr) {
        currentStatus = "overdue";
      }
    }

    return {
      ...template,
      items,
      paid_amount,
      pending_amount,
      next_invoice_date,
      status: currentStatus,
    };
  });

  if (light) {
    return { ...recurring, templates: recurring.templates };
  }

  // Fetch Timeline History
  const history = db
    .prepare(
      `
        SELECT
          rih.*,
          ri.recurring_invoice_no,
          ri.recurring_invoice_no AS generated_invoice_no,
          hp.payment_no,
          hp.mode,
          hp.reference_no,
          COALESCE(NULLIF(rih.amount, 0), ri.grand_total) as grand_total,
          (
            SELECT h2.paid_amount
            FROM recurring_invoice_history h2
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date)
            ORDER BY h2.created_at DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_paid_amount,
          (
            SELECT h2.pending_amount
            FROM recurring_invoice_history h2
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date)
            ORDER BY h2.created_at DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_pending_amount,
          (
            SELECT h2.collection_status
            FROM recurring_invoice_history h2
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date)
            ORDER BY h2.created_at DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_collection_status,
          (
            SELECT h2.payment_id
            FROM recurring_invoice_history h2
            JOIN incoming_payments ip2 ON ip2.id = h2.payment_id
            LEFT JOIN bank_transactions bt2 ON bt2.id = ip2.bank_transaction_id
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date)
              AND h2.action_type = 'payment_received'
              AND h2.payment_id IS NOT NULL
              AND COALESCE(ip2.is_deleted, 0) = 0
              AND (
                ip2.bank_transaction_id IS NULL
                OR COALESCE(bt2.is_deleted, 0) = 0
              )
              AND h2.id = (
                SELECT h3.id
                FROM recurring_invoice_history h3
                WHERE h3.recurring_invoice_id = h2.recurring_invoice_id
                  AND h3.payment_id = h2.payment_id
                  AND h3.action_type IN ('payment_received', 'payment_voided')
                ORDER BY h3.created_at DESC, h3.id DESC
                LIMIT 1
              )
            ORDER BY h2.payment_date DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_payment_id
        FROM recurring_invoice_history rih
        JOIN recurring_invoices ri ON ri.id = rih.recurring_invoice_id
        LEFT JOIN incoming_payments hp ON hp.id = rih.payment_id
        LEFT JOIN bank_transactions hbt ON hbt.id = hp.bank_transaction_id
        WHERE ri.recurring_id = ?
          AND (
            rih.action_type <> 'payment_received'
            OR (
              COALESCE(hp.is_deleted, 0) = 0
              AND (
                hp.bank_transaction_id IS NULL
                OR COALESCE(hbt.is_deleted, 0) = 0
              )
              AND rih.id = (
                SELECT h3.id
                FROM recurring_invoice_history h3
                WHERE h3.recurring_invoice_id = rih.recurring_invoice_id
                  AND h3.payment_id = rih.payment_id
                  AND h3.action_type IN ('payment_received', 'payment_voided')
                ORDER BY h3.created_at DESC, h3.id DESC
                LIMIT 1
              )
            )
          )
        ORDER BY rih.created_at DESC
  `,
    )
    .all(id);

  // Fetch Direct Payments
  const payments = db
    .prepare(
      `
    SELECT
      p.*,
      ri.recurring_invoice_no
    FROM incoming_payments p
    JOIN recurring_invoices ri
      ON ri.id = p.recurring_invoice_id
    LEFT JOIN bank_transactions bt
      ON bt.id = p.bank_transaction_id
    WHERE ri.recurring_id = ?
      AND COALESCE(p.is_deleted, 0) = 0
      AND COALESCE(bt.is_deleted, 0) = 0
    ORDER BY p.payment_date DESC
  `,
    )
    .all(id);

     
  return {
    ...recurring,
    invoice_items: invoiceItems,
    templates: recurring.templates,
    history,
    payments,
  };
}

function getPlan(id) {
  const db = getDb();
  const plan = db
    .prepare(
      `
    SELECT 
      ri.*, 
      ri.recurring_invoice_no,
      r.customer_id, 
      c.company_name
    FROM recurring_invoices ri
    JOIN recurring r ON r.id = ri.recurring_id
    JOIN customers c ON c.id = r.customer_id
    WHERE ri.id = ?
  `,
    )
    .get(id);
  if (!plan) return null;

  const latestHistory = db
    .prepare(
      `
    SELECT pending_amount, collection_status
    FROM recurring_invoice_history 
    WHERE recurring_invoice_id = ? 
    ORDER BY created_at DESC, id DESC LIMIT 1
  `,
    )
    .get(id);

  plan.pending_amount =
    latestHistory && latestHistory.collection_status !== "completed"
      ? latestHistory.pending_amount
      : Number(plan.grand_total);
  return plan;
}

function createRecurring(data) {
  const db = getDb();

  const tx = db.transaction(() => {
    const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
    const customer = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(data.customer_id);
    const sameState =
      String(company?.state || "")
        .trim()
        .toLowerCase() ===
      String(customer?.state || "")
        .trim()
        .toLowerCase();
    const isOverseas =
      String(customer?.gst_treatment || "").toLowerCase() === "overseas";

    const outgoingSetting = db.prepare("SELECT value FROM settings WHERE key = 'gst_enabled_outgoing'").get();
    const defaultGstEnabled = outgoingSetting?.value !== '0' ? 1 : 0;

    const result = db
      .prepare(
        `
       INSERT INTO recurring (
  customer_id,
  invoice_id
)

VALUES (
  @customer_id,
  @invoice_id
)
      `,
      )
      .run({
        customer_id: data.customer_id,

        invoice_id: data.invoice_id || null,
      });

    const recurringId = result.lastInsertRowid;

    const sharedInvoiceNo =
      data.templates?.find((t) => t.recurring_invoice_no)
        ?.recurring_invoice_no || numbering.nextRecurringInvoiceNo(new Date());

    for (const template of data.templates || []) {
      const finalRecurringInvoiceNo =
        template.recurring_invoice_no || sharedInvoiceNo;

      const validItemsInput = (template.items || []).filter(
        (i) =>
          (i.name?.trim() || i.service_id) &&
          Number(i.rate || 0) > 0 &&
          Number(i.qty || 0) > 0,
      );
      const subtotalRecalculated = validItemsInput.reduce(
        (sum, i) => sum + Number(i.qty || 1) * Number(i.rate || 0),
        0,
      );

      const isGstEnabled = template.is_gst_enabled !== undefined
        ? (template.is_gst_enabled ? 1 : 0)
        : defaultGstEnabled;

      const { items: processedItems, ...totals } = calculateGSTTotals({
        items: validItemsInput,
        subtotal: subtotalRecalculated,
        discount: template.discount,
        discount_is_percent: template.discount_is_percent,
        sameState,
        isOverseas,
        isGstEnabled: isGstEnabled === 1,
      });

      const recurringInvoice = db
        .prepare(
          `
      INSERT INTO recurring_invoices (
        recurring_id,

        recurring_invoice_no,

        billing_cycle,
        custom_billing_cycle,

        start_date,

        is_stopped,
        stopped_reason,
        is_gst_enabled,
        auto_generate,

        subtotal,

        discount,
        discount_is_percent,

        cgst_total,
        sgst_total,
        igst_total,

        tax_total,

        grand_total,

        notes
      )

      VALUES (
        @recurring_id,

        @recurring_invoice_no,

        @billing_cycle,
        @custom_billing_cycle,

        @start_date,

          @is_stopped,  
          @stopped_reason,
          @is_gst_enabled,
          @auto_generate,

        @subtotal,

        @discount,
        @discount_is_percent,

        @cgst_total,
        @sgst_total,
        @igst_total,

        @tax_total,

        @grand_total,

        @notes
      )
    `,
        )
        .run({
          recurring_id: recurringId,
          recurring_invoice_no: finalRecurringInvoiceNo,

          billing_cycle: template.billing_cycle,

          custom_billing_cycle: template.custom_billing_cycle || null,

          start_date: template.start_date,

          is_stopped: template.is_stopped ? 1 : 0,

          stopped_reason: template.stopped_reason || "",
          is_gst_enabled: isGstEnabled,

          subtotal: template.subtotal || 0,

          discount: template.discount || 0,

          auto_generate: template.auto_generate ? 1 : 0,

          discount_is_percent: template.discount_is_percent ? 1 : 0,

          ...totals,

          notes: template.notes || "",
        });

      const recurringInvoiceId = recurringInvoice.lastInsertRowid;

      const firstNextDate = formatISO(
        advance(
          template.start_date,
          template.billing_cycle,
          template.custom_billing_cycle,
        ),
        { representation: "date" },
      );

      for (const item of processedItems) {
        db.prepare(
          `
      INSERT INTO recurring_items (
        recurring_invoice_id,
        service_id,
        name,
        description,
        sac_code,
        qty,
        billing_type,
        rate,
        gst_rate,
        cgst,
        sgst,
        igst,
        line_total
      )

      VALUES (
        @recurring_invoice_id,
        @service_id,
        @name,
        @description,
        @sac_code,
        @qty,
        @billing_type,
        @rate,
        @gst_rate,
        @cgst,
        @sgst,
        @igst,
        @line_total
      )
    `,
        ).run({
          recurring_invoice_id: recurringInvoiceId,
          service_id: ensureService(db, item),

          name: item.name || "",

          description: item.description || "",

          sac_code: item.sac_code || "",

          qty: item.qty,

          billing_type: item.billing_type || "Service",

          rate: item.rate,

          gst_rate: item.gst_rate,

          cgst: item.cgst,
          sgst: item.sgst,
          igst: item.igst,

          line_total: item.line_total,
        });
      }

      // Log initial lifecycle entry
      syncRecurringLifecycle(db, recurringInvoiceId, {
        action_type: "plan_created",
        action_notes: `Recurring plan initialized. First invoice due on ${firstNextDate}`,
        amount: totals.grand_total, // Snapshot total for history table
        invoice_start_date: template.start_date,
        next_invoice_date: firstNextDate,
        due_date: firstNextDate,
        last_generated_at: formatISO(new Date()),
      });
    }

    const newData = getRecurring(recurringId);
    activity.log("recurring:created", {
      entityType: "recurring",
      entityId: recurringId,
      message: sharedInvoiceNo,
      newData,
    });

    return getRecurring(recurringId);
  });

  return tx();
}

function updateRecurring(id, data) {
  const db = getDb();

  const tx = db.transaction(() => {
    const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
    const customer = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(data.customer_id);
    const sameState =
      String(company?.state || "")
        .trim()
        .toLowerCase() ===
      String(customer?.state || "")
        .trim()
        .toLowerCase();
    const isOverseas =
      String(customer?.gst_treatment || "").toLowerCase() === "overseas";

    const outgoingSetting = db.prepare("SELECT value FROM settings WHERE key = 'gst_enabled_outgoing'").get();
    const defaultGstEnabled = outgoingSetting?.value !== '0' ? 1 : 0;

    const oldData = getRecurring(id);

    db.prepare(
      `
      UPDATE recurring

SET
  customer_id = @customer_id,
  invoice_id = @invoice_id

WHERE id = @id
    `,
    ).run({
      id,

      customer_id: data.customer_id,

      invoice_id: data.invoice_id || null,
    });
    // Safe Update Strategy: Soft delete plans removed from UI, update existing, insert new
    const incomingIds = (data.templates || []).map((t) => t.id).filter(Boolean);

    if (incomingIds.length > 0) {
      const placeholders = incomingIds.map(() => "?").join(",");
      db.prepare(
        `UPDATE recurring_invoices SET is_deleted = 1 WHERE recurring_id = ? AND id NOT IN (${placeholders})`,
      ).run(id, ...incomingIds);
    } else {
      // If all plans were removed in the UI
      db.prepare(
        `UPDATE recurring_invoices SET is_deleted = 1 WHERE recurring_id = ?`,
      ).run(id);
    }

    // Fetch shared number for the current active cycle to use for any new templates added during edit
    const existingNo =
      db
        .prepare(
          `
      SELECT recurring_invoice_no FROM recurring_invoices 
      WHERE recurring_id = ? AND is_active = 1 AND is_deleted = 0 AND recurring_invoice_no IS NOT NULL
      ORDER BY id DESC LIMIT 1
    `,
        )
        .get(id)?.recurring_invoice_no ||
      data.templates?.find((t) => t.recurring_invoice_no)?.recurring_invoice_no;

    for (const template of data.templates || []) {
      const finalRecurringInvoiceNo =
        template.recurring_invoice_no || existingNo;

      const validItemsInput = (template.items || []).filter(
        (i) =>
          (i.name?.trim() || i.service_id) &&
          Number(i.rate || 0) > 0 &&
          Number(i.qty || 0) > 0,
      );
      const subtotalRecalculated = validItemsInput.reduce(
        (sum, i) => sum + Number(i.qty || 1) * Number(i.rate || 0),
        0,
      );

      const isGstEnabledPayload = template.is_gst_enabled !== undefined 
        ? (template.is_gst_enabled ? 1 : 0) 
        : null;

      const { items: processedItems, ...totals } = calculateGSTTotals({
        items: validItemsInput,
        subtotal: subtotalRecalculated,
        discount: template.discount,
        discount_is_percent: template.discount_is_percent,
        sameState,
        isOverseas,
        isGstEnabled: isGstEnabledPayload !== null ? (isGstEnabledPayload === 1) : (oldPlan?.is_gst_enabled !== 0)
      });

      let recurringInvoiceId = template.id;

      if (recurringInvoiceId) {
        const oldPlan = oldData.templates.find(
          (t) => t.id === recurringInvoiceId,
        );

        // Detection logic: Sync if dates/cycle changed, OR if history is corrupted (Next Date == Start Date)
        const nextDateInHistory = oldPlan?.next_invoice_date;
        const isHistoryCorrupted = nextDateInHistory === template.start_date;

        const configChanged =
          oldPlan &&
          (oldPlan.start_date !== template.start_date ||
            oldPlan.billing_cycle !== template.billing_cycle ||
            isHistoryCorrupted);

        // UPDATE EXISTING PLAN (Stability check)
        db.prepare(
          `
  UPDATE recurring_invoices SET
    recurring_id = @recurring_id,
    recurring_invoice_no = @recurring_invoice_no,
    billing_cycle = @billing_cycle,
    custom_billing_cycle = @custom_billing_cycle,
    start_date = @start_date,
    is_stopped = @is_stopped,
    stopped_reason = @stopped_reason,
    is_gst_enabled = @is_gst_enabled,
    subtotal = @subtotal,
    discount = @discount,
    discount_is_percent = @discount_is_percent,
    cgst_total = @cgst_total,
    sgst_total = @sgst_total,
    igst_total = @igst_total,
    tax_total = @tax_total,
    grand_total = @grand_total,
    notes = @notes,
    auto_generate = @auto_generate,
    is_deleted = 0
  WHERE id = @id AND recurring_id = @recurring_id
`,
        ).run({
          id: recurringInvoiceId,
          recurring_id: id,
          recurring_invoice_no: finalRecurringInvoiceNo,
          billing_cycle: template.billing_cycle,
          custom_billing_cycle: template.custom_billing_cycle || null,
          is_gst_enabled: isGstEnabledPayload !== null ? isGstEnabledPayload : (oldPlan?.is_gst_enabled ?? 1),
          start_date: template.start_date,
          is_stopped: template.is_stopped ? 1 : 0,
          stopped_reason: template.stopped_reason || "",
          subtotal: subtotalRecalculated,
          discount: template.discount || 0,
          auto_generate: template.auto_generate ? 1 : 0,
          discount_is_percent: template.discount_is_percent ? 1 : 0,

          ...totals,

          notes: template.notes || "",
        });

        // Delete items only for this specific plan
        db.prepare(
          `DELETE FROM recurring_items WHERE recurring_invoice_id = ?`,
        ).run(recurringInvoiceId);

        if (configChanged) {
          const firstNextDate = formatISO(
            advance(
              template.start_date,
              template.billing_cycle,
              template.custom_billing_cycle,
            ),
            { representation: "date" },
          );
          syncRecurringLifecycle(db, recurringInvoiceId, {
            action_type: "recurring_updated",
            action_notes: `Plan configuration updated. New next invoice due on ${firstNextDate}`,
            amount: totals.grand_total, // Snapshot total for history table
            invoice_start_date: template.start_date,
            next_invoice_date: firstNextDate,
            due_date: firstNextDate,
          });
        }
      } else {
        const isGstEnabled = isGstEnabledPayload !== null 
          ? isGstEnabledPayload 
          : defaultGstEnabled;

        // INSERT NEW PLAN
        const result = db
          .prepare(
            `
          INSERT INTO recurring_invoices (
            recurring_id,
            recurring_invoice_no,
            billing_cycle,
            custom_billing_cycle,
            start_date,
            auto_generate,
            is_stopped,
            stopped_reason,
            is_gst_enabled,
            subtotal,
            discount,
            discount_is_percent,
            cgst_total,
            sgst_total,
            igst_total,
            tax_total,
            grand_total,
            notes
          ) VALUES (
            @recurring_id,
            @recurring_invoice_no,
            @billing_cycle,
            @custom_billing_cycle,
            @start_date,
            @auto_generate,
            @is_stopped,
            @stopped_reason,
            @is_gst_enabled,
            @subtotal,
            @discount,
            @discount_is_percent,
            @is_gst_enabled,
            @cgst_total,
            @sgst_total,
            @igst_total,
            @tax_total,
            @grand_total,
            @notes
          )
        `,
          )
          .run({
            recurring_id: id,
            recurring_invoice_no: finalRecurringInvoiceNo,

            billing_cycle: template.billing_cycle,

            custom_billing_cycle: template.custom_billing_cycle || null,

            start_date: template.start_date,

            is_stopped: template.is_stopped ? 1 : 0,

            stopped_reason: template.stopped_reason || "",

            is_gst_enabled: isGstEnabled,

            subtotal: template.subtotal || 0,

            discount: template.discount || 0,

            discount_is_percent: template.discount_is_percent ? 1 : 0,

            ...totals,

            notes: template.notes || "",
            auto_generate: template.auto_generate ? 1 : 0,
          });
        recurringInvoiceId = result.lastInsertRowid;

        const firstNextDate = formatISO(
          advance(
            template.start_date,
            template.billing_cycle,
            template.custom_billing_cycle,
          ),
          { representation: "date" },
        );

        // Log initial lifecycle for new template added during edit
        syncRecurringLifecycle(db, recurringInvoiceId, {
          action_type: "plan_created",
          action_notes: `New billing plan added. First invoice due on ${firstNextDate}`,
          amount: totals.grand_total, // Snapshot total for history table
          invoice_start_date: template.start_date,
          next_invoice_date: firstNextDate,
          due_date: firstNextDate,
          last_generated_at: formatISO(new Date()),
        });
      }

      for (const item of processedItems) {
        db.prepare(
          `
      INSERT INTO recurring_items (
        recurring_invoice_id,
        service_id,
        name,
        description,
        sac_code,
        qty,
        billing_type,
        rate,
        gst_rate,
        cgst,
        sgst,
        igst,
        line_total
      )

      VALUES (
        @recurring_invoice_id,
        @service_id,
        @name,
        @description,
        @sac_code,
        @qty,
        @billing_type,
        @rate,
        @gst_rate,
        @cgst,
        @sgst,
        @igst,
        @line_total
      )
    `,
        ).run({
          recurring_invoice_id: recurringInvoiceId,
          service_id: ensureService(db, item),

          name: item.name || "",

          description: item.description || "",

          sac_code: item.sac_code || "",

          qty: item.qty,

          billing_type: item.billing_type || "Service",

          rate: item.rate,

          gst_rate: item.gst_rate,

          cgst: item.cgst,

          sgst: item.sgst,

          igst: item.igst,

          line_total: item.line_total,
        });
      }
    }

    const newData = getRecurring(id);
    activity.log("recurring:updated", {
      entityType: "recurring",
      entityId: id,
      message: existingNo,
      oldData,
      newData,
    });

    return getRecurring(id);
  });

  return tx();
}

function generateDueInvoices() {
  const db = getDb();

  const recurringRows = db
    .prepare(
      `
      SELECT
  ri.*,
  r.customer_id

  FROM recurring_invoices ri
  JOIN recurring r ON r.id = ri.recurring_id
  JOIN (
    SELECT recurring_invoice_id, next_invoice_date, collection_status
    FROM recurring_invoice_history
    WHERE id IN (
      SELECT MAX(id) FROM recurring_invoice_history GROUP BY recurring_invoice_id
    )
  ) h ON h.recurring_invoice_id = ri.id

  WHERE
    ri.auto_generate = 1
    AND ri.is_stopped = 0
    AND h.collection_status = 'completed'
    AND h.next_invoice_date <= date('now')
    AND r.is_deleted = 0
    `,
    )
    .all();

  return recurringRows.map((row) => {
    const oldData = db
      .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
      .get(row.id);

    const items = db
      .prepare(
        `
        SELECT *

        FROM recurring_items

        WHERE recurring_invoice_id = ?
      `,
      )
      .all(row.id);

    const invoice = createInvoice({
      customer_id: row.customer_id,
      is_recurring: true,
      recurring_id: row.id,
      is_gst_enabled: row.is_gst_enabled,

      subtotal: row.subtotal || 0,
      discount: row.discount || 0,
      discount_is_percent: row.discount_is_percent || 0,
      notes: row.notes || "",

      items,
    });

    const latestHistory = db
      .prepare(
        `
      SELECT next_invoice_date FROM recurring_invoice_history 
      WHERE recurring_invoice_id = ? 
      ORDER BY created_at DESC, id DESC LIMIT 1
    `,
      )
      .get(row.id);

    const currentNextDate = latestHistory?.next_invoice_date || row.start_date;

    const nextDate = formatISO(
      advance(currentNextDate, row.billing_cycle, row.custom_billing_cycle),
      {
        representation: "date",
      },
    );

    // Log invoice generation to history and advance the cycle
    syncRecurringLifecycle(db, row.id, {
      action_type: "invoice_generated",
      action_notes: `Invoice ${invoice.invoice_no} generated automatically`,
      amount: invoice.grand_total, // Store the actual total for this cycle
      invoice_start_date: currentNextDate,
      next_invoice_date: nextDate,
      due_date: currentNextDate,
      last_generated_at: formatISO(new Date()),
    });

    const newData = db
      .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
      .get(row.id);

    activity.log("recurring:auto_generate", {
      entityType: "recurring",
      entityId: row.recurring_id,
      message: row.recurring_invoice_no,
      oldData,
      newData,
    });

    return invoice;
  });
}

function stopRecurring(id, reason) {
  const db = getDb();

  const oldData = getRecurring(id);

  const transaction = db.transaction(() => {
    db.prepare(
      `
      UPDATE recurring
      SET
        is_stopped = 1,
        stopped_reason = ?
      WHERE id = ?
    `,
    ).run(reason, id);

    db.prepare(
      `
      UPDATE recurring_invoices
      SET
        is_stopped = 1,
        stopped_reason = ?
      WHERE recurring_id = ?
    `,
    ).run(reason, id);

    // Log for all plans under this header
    const plans = db
      .prepare(`SELECT id FROM recurring_invoices WHERE recurring_id = ?`)
      .all(id);
    plans.forEach((p) => {
      syncRecurringLifecycle(db, p.id, {
        action_type: "plan_stopped",
        notes: `Lifecycle stopped: ${reason}`,
      });
    });
  });

  transaction();

  const newData = getRecurring(id);
  activity.log("recurring:stopped", {
    entityType: "recurring",
    entityId: id,
    message: reason || "Subscription stopped",
    oldData,
    newData,
  });

  return getRecurring(id);
}

function resumeRecurring(id) {
  const db = getDb();

  const oldData = getRecurring(id);

  const transaction = db.transaction(() => {
    db.prepare(
      `
      UPDATE recurring
      SET
        is_stopped = 0,
        stopped_reason = NULL
      WHERE id = ?
    `,
    ).run(id);

    db.prepare(
      `
      UPDATE recurring_invoices
      SET
        is_stopped = 0,
        stopped_reason = NULL
      WHERE recurring_id = ?
    `,
    ).run(id);

    // Log for all plans under this header
    const plans = db
      .prepare(`SELECT id FROM recurring_invoices WHERE recurring_id = ?`)
      .all(id);
    plans.forEach((p) => {
      syncRecurringLifecycle(db, p.id, {
        action_type: "plan_resumed",
        notes: `Lifecycle resumed`,
      });
    });
  });

  transaction();

  const newData = getRecurring(id);
  activity.log("recurring:resumed", {
    entityType: "recurring",
    entityId: id,
    message: "Subscription resumed",
    oldData,
    newData,
  });

  return getRecurring(id);
}

function stopPlan(recurringId, templateId, reason) {
  const db = getDb();

  const oldData = db
    .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
    .get(templateId);

  db.prepare(
    `
    UPDATE recurring_invoices
    SET is_stopped = 1, stopped_reason = @reason
    WHERE id = @templateId AND recurring_id = @recurringId
  `,
  ).run({
    templateId: Number(templateId),
    recurringId: Number(recurringId),
    reason: String(reason || "").trim(),
  });

  const newData = db
    .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
    .get(templateId);

  const plan = db
    .prepare("SELECT recurring_invoice_no FROM recurring_invoices WHERE id = ?")
    .get(templateId);
  activity.log("recurring:stopped", {
    entityType: "recurring",
    entityId: Number(recurringId),
    message: `${plan?.recurring_invoice_no || ""}: ${reason || "Plan stopped"}`,
    oldData,
    newData,
  });

  syncRecurringLifecycle(db, Number(templateId), {
    action_type: "plan_stopped",
    notes: reason,
  });

  return getRecurring(recurringId);
}

function resumePlan(recurringId, templateId) {
  const db = getDb();

  const oldData = db
    .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
    .get(templateId);

  db.prepare(
    `
    UPDATE recurring_invoices
    SET is_stopped = 0, stopped_reason = ''
    WHERE id = @templateId AND recurring_id = @recurringId
  `,
  ).run({
    templateId: Number(templateId),
    recurringId: Number(recurringId),
  });

  const newData = db
    .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
    .get(templateId);

  const plan = db
    .prepare("SELECT recurring_invoice_no FROM recurring_invoices WHERE id = ?")
    .get(templateId);
  activity.log("recurring:resumed", {
    entityType: "recurring",
    entityId: Number(recurringId),
    message: `${plan?.recurring_invoice_no || ""}: Cycle resumed`,
    oldData,
    newData,
  });

  syncRecurringLifecycle(db, Number(templateId), {
    action_type: "plan_resumed",
    notes: "Service renewal cycle resumed",
  });

  return getRecurring(recurringId);
}

function listAllHistory() {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT
      rih.*,
      ri.recurring_invoice_no,
      ri.grand_total,
      r.id AS recurring_id,
      r.customer_id,

      c.company_name,
      c.contact_person,
      c.state,
      c.gst_treatment,
      co.state AS company_state,

      p.payment_no,
      p.reference_no

    FROM recurring_invoice_history rih

    JOIN recurring_invoices ri
      ON ri.id = rih.recurring_invoice_id

    JOIN recurring r
      ON r.id = ri.recurring_id

    JOIN customers c
      ON c.id = r.customer_id

    JOIN company co
      ON co.id = 1

    LEFT JOIN incoming_payments p
      ON p.id = rih.payment_id

    WHERE NOT (
      rih.action_type = 'payment_received'
      AND COALESCE(p.is_deleted, 0) = 1
    )

    ORDER BY rih.created_at DESC
  `,
    )
    .all();
}

function refreshRecurringStatuses() {
  const db = getDb();

  const plans = db
    .prepare(
      `
      SELECT
        ri.id,
        h.id as history_id,
        h.next_invoice_date,
        h.pending_amount,
        h.collection_status
      FROM recurring_invoices ri
      JOIN (
        SELECT *
        FROM recurring_invoice_history
        WHERE id IN (
          SELECT MAX(id)
          FROM recurring_invoice_history
          GROUP BY recurring_invoice_id
        )
      ) h
      ON h.recurring_invoice_id = ri.id
      WHERE ri.is_deleted = 0
    `,
    )
    .all();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  plans.forEach((plan) => {
    if (!plan.next_invoice_date) return;

    const dueDate = new Date(plan.next_invoice_date);
    dueDate.setHours(0, 0, 0, 0);

    if (plan.pending_amount > 0 && dueDate < today) {
      const overdueDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));

      db.prepare(
        `
        UPDATE recurring_invoice_history
        SET
          collection_status = 'overdue',
          overdue_days = ?
        WHERE id = ?
      `,
      ).run(overdueDays, plan.history_id);
    }
  });

  console.log("Recurring overdue status refreshed");
}

function loadRecurringItems(db, recurringInvoiceId) {
  const items = db
    .prepare(
      `
      SELECT
        ri.*,
        s.name AS master_service_name,
        s.category AS service_category
      FROM recurring_items ri
      LEFT JOIN services s
        ON s.id = ri.service_id
      WHERE ri.recurring_invoice_id = ?
      ORDER BY ri.id
    `,
    )
    .all(recurringInvoiceId);

  return items.map((item) => {
    let descriptionPoints = item.service_id
      ? db
          .prepare(
            `
            SELECT *
            FROM description_points
            WHERE service_id = ?
            ORDER BY point_order
          `,
          )
          .all(item.service_id)
      : [];

    if (!descriptionPoints.length) {
      descriptionPoints = String(item.description || "")
        .split("\n")
        .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
        .filter(Boolean)
        .map((point_text) => ({ point_text }));
    }

    return { ...item, descriptionPoints };
  });
}

module.exports = {
  getRecurring,
  getPlan,
  createRecurring,
  updateRecurring,
  generateDueInvoices,
  refreshRecurringStatuses,
  syncRecurringLifecycle,
  stopPlan,
  resumePlan,
  stopRecurring,
  resumeRecurring,
  listAllHistory,
  loadRecurringItems,
};
