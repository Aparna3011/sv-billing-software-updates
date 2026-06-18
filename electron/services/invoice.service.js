const { addDays, formatISO } = require("date-fns");
const { getDb } = require("../db/database");
const numbering = require("./numbering.service");
const quotations = require("./quotation.service"); // Import quotation service
const { totalsForItems, discountPct01, ensureService } = require("./gst.service");
const activity = require("./activitylog.service");

const INVOICE_WORKFLOW_STATUSES = new Set(["pending", "sent"]);

function normalizeInvoiceWorkflowStatus(status) {
  if (status == null || status === "") return null;
  return INVOICE_WORKFLOW_STATUSES.has(String(status)) ? String(status) : null;
}

/** Uses nullish semantics so payment_terms === 0 means net due immediately (invoice date). */
function paymentTermsDays(customer) {
  const t = customer?.payment_terms;

  if (t == null || t === "" || Number(t) <= 0) {
    return null;
  }

  return Number(t);
}

function createInvoice(payload) {
  const db = getDb();
  return db.transaction(() => {
    const contact = db
      .prepare("SELECT * FROM contacts WHERE id = ? AND is_customer = 1 AND is_deleted = 0") // Ensure it's a customer
      .get(payload.contact_id); // Use contact_id
    if (!contact) throw new Error("Customer not found");
    const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
    const invoiceDate =
      payload.invoice_date || formatISO(new Date(), { representation: "date" });
    const rawDue = payload.due_date;
    const terms = paymentTermsDays(contact);

    const dueDate = // Use contact's payment terms
      rawDue != null && String(rawDue).trim() !== "" // This comment is misleading, it's not using contact's payment terms here directly
        ? rawDue
        : terms == null
          ? null
          : formatISO(addDays(new Date(invoiceDate), terms), {
              representation: "date",
            });
    const status = normalizeInvoiceWorkflowStatus(payload.status) || "pending";
    const outgoingSetting = db.prepare("SELECT value FROM settings WHERE key = 'gst_enabled_outgoing'").get();
    const isGstEnabled = payload.is_gst_enabled !== undefined ? (payload.is_gst_enabled ? 1 : 0) : (outgoingSetting?.value !== '0' ? 1 : 0); // This is fine

    const pct = discountPct01(payload, null);
    const totals = totalsForItems( // Use contact for GST calculation
      payload.items || [],
      company,
      contact,
      payload.discount || 0,
      pct === 1,
      isGstEnabled === 1
    );
    const invoiceNo =
      payload.invoice_no || numbering.nextInvoiceNo(new Date(invoiceDate));
    const info = db
      .prepare(
        `
      INSERT INTO invoices (
        invoice_no, contact_id, quotation_id, invoice_date, due_date, status, is_gst_enabled, subtotal, discount, discount_is_percent,
        cgst_total, sgst_total, igst_total, tax_total, grand_total, round_off, balance_due, is_recurring, recurring_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        invoiceNo,
        payload.contact_id,
        payload.quotation_id || null,
        invoiceDate,
        dueDate,
        status,
        isGstEnabled,
        totals.subtotal,
        payload.discount || 0,
        pct,
        totals.cgst,
        totals.sgst,
        totals.igst,
        totals.taxTotal,
        totals.grandTotal,
        totals.roundOff,
        totals.grandTotal,
        payload.is_recurring ? 1 : 0,
        payload.recurring_id || null,
        payload.notes || "",
      );
    totals.items.forEach((item) => {
      const itemResult = db
        .prepare(
          `
    INSERT INTO invoice_items (
      invoice_id,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
        )
        .run(
          info.lastInsertRowid,
        ensureService(db, item),
          item.name,
          item.description || "",
          item.sac_code || "",
          item.qty || 1,
          item.billing_type || "Service",
          item.rate || 0,
          item.gst_rate ?? null,
          item.cgst,
          item.sgst,
          item.igst,
          item.line_total,
        );

      const invoiceItemId = itemResult.lastInsertRowid;

      // SAVE DESCRIPTION POINTS
      const points = (item.descriptionPoints || [])
        .map((point) => (typeof point === "string" ? point : point.point_text))
        .filter(Boolean);

      points.forEach((point, index) => {
        db.prepare(
          `
        INSERT INTO description_points (
          invoice_item_id,
          point_order,
          point_text
        )
        VALUES (?, ?, ?)
      `,
        ).run(invoiceItemId, index + 1, point);
      });
    });
    activity.log("invoice:created", {
      entityType: "invoice",
      entityId: info.lastInsertRowid,
      message: invoiceNo,
    });

    // If created from a quotation, update the quotation status
    if (payload.quotation_id) {
      db.prepare("UPDATE quotations SET status = 'converted', converted_invoice_id = ? WHERE id = ?").run(info.lastInsertRowid, payload.quotation_id);
      activity.log('quotation:converted', { entityType: 'quotation', entityId: payload.quotation_id, message: `Converted to invoice ${invoiceNo}` });
    }
    return getInvoice(info.lastInsertRowid);
  })();
}

function updateInvoice(payload) {
  const db = getDb();
  const oldData = getInvoice(payload.id);
  return db.transaction(() => {
    const existing = db
      .prepare("SELECT * FROM invoices WHERE id = ? AND is_deleted = 0")
      .get(payload.id);
    if (!existing) throw new Error("Invoice not found");
    if (Number(existing.paid_amount) > 0) throw new Error('Invoice with payments cannot be edited');
    if (existing.status === "cancelled")
      throw new Error("Cancelled invoice cannot be edited");

    const customer = db
      .prepare("SELECT * FROM contacts WHERE id = ? AND is_customer = 1 AND is_deleted = 0") // Ensure it's a customer
      .get(payload.contact_id ?? existing.contact_id); // Use contact_id
    if (!customer) throw new Error("Customer not found"); // This is fine, variable name is 'customer'
    const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
    const invoiceDate = payload.invoice_date || existing.invoice_date;
    const rawDue = payload.due_date;
    let dueDate;
    if (rawDue != null && String(rawDue).trim() !== "") {
      dueDate = rawDue;
    } else if (existing.due_date) {
      dueDate = existing.due_date;
    } else { // This is fine, paymentTermsDays expects a customer/contact object
      dueDate = formatISO(
        addDays(new Date(invoiceDate), paymentTermsDays(customer)),
        { representation: "date" },
      );
    }

    const isGstEnabled = payload.is_gst_enabled !== undefined ? (payload.is_gst_enabled ? 1 : 0) : (existing.is_gst_enabled ?? 1); // Use contact for GST calculation
    const pct = discountPct01(payload, existing); // This is fine
    const totals = totalsForItems(
      payload.items || [],
      company,
      customer,
      payload.discount ?? existing.discount ?? 0,
      pct === 1,
      isGstEnabled === 1
    );
    const grandTotal = totals.grandTotal;
    const paidAmount = Number(existing.paid_amount || 0); // Ensure paid_amount is number

    const balanceDue = Math.max(0, grandTotal - paidAmount);
    let nextStatus = "pending";

    if (balanceDue <= 0) {
      nextStatus = "paid";
    } else if (paidAmount > 0) {
      nextStatus = "partially_paid";
    }

    db.prepare(
      `
      UPDATE invoices SET
        contact_id = ?, invoice_date = ?, due_date = ?, status = ?, is_gst_enabled = ?, discount = ?, discount_is_percent = ?,
        subtotal = ?, cgst_total = ?, sgst_total = ?, igst_total = ?, tax_total = ?, grand_total = ?, round_off = ?, balance_due = ?, notes = ?
      WHERE id = ?
    `,
    ).run(
      payload.contact_id ?? existing.contact_id,
      invoiceDate,
      dueDate,
      nextStatus,
      isGstEnabled,
      Number(payload.discount ?? existing.discount ?? 0),
      pct,
      totals.subtotal,
      totals.cgst,
      totals.sgst,
      totals.igst,
      totals.taxTotal,
      grandTotal,
      totals.roundOff,
      balanceDue,
      payload.notes ?? existing.notes ?? "",
      payload.id,
    );

    db.prepare(
      `
  DELETE FROM description_points
  WHERE invoice_item_id IN (
    SELECT id
    FROM invoice_items
    WHERE invoice_id = ?
  )
`,
    ).run(payload.id);
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(
      payload.id,
    );
    totals.items.forEach((item) => {
      const itemResult = db
        .prepare(
          `
    INSERT INTO invoice_items (
      invoice_id,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
        )
        .run(
          payload.id,
          ensureService(db, item),
          item.name,
          item.description || "",
          item.sac_code || " ",
          item.qty || 1,
          item.billing_type || "Service",
          item.rate || 0,
          item.gst_rate ?? null,
          item.cgst,
          item.sgst,
          item.igst,
          item.line_total,
        );

      const invoiceItemId = itemResult.lastInsertRowid;

      const points = (item.descriptionPoints || [])
        .map((point) => (typeof point === "string" ? point : point.point_text))
        .filter(Boolean);

      points.forEach((point, index) => {
        db.prepare(
          `
        INSERT INTO description_points (
          invoice_item_id,
          point_order,
          point_text
        )
        VALUES (?, ?, ?)
      `,
        ).run(invoiceItemId, index + 1, point);
      });
    });

    const newData = getInvoice(payload.id);

    activity.log("invoice:updated", {
      entityType: "invoice",
      entityId: payload.id,
      message: existing.invoice_no,

      oldData,
      newData,
    });
    return getInvoice(payload.id);
  })();
}

function getInvoice(id) {
  const db = getDb();
  const invoice = db
    .prepare(
      `
    SELECT
      i.*,
      c.company_name,
      c.contact_person,
      c.email,
      c.phone,
      c.gstin,
      c.gst_treatment,
      c.state,
      c.address,
      c.city,
      c.country,
      company.state AS company_state
    FROM invoices i
    JOIN contacts c ON c.id = i.contact_id
    LEFT JOIN company ON company.id = 1
    WHERE i.id = ?
  `,
    )
    .get(id);
  if (!invoice) return null;
  invoice.items = db
    .prepare(
      `
  SELECT *
  FROM invoice_items
  WHERE invoice_id = ?
`,
    )
    .all(id);

  invoice.items.forEach((item) => {
    item.descriptionPoints = db
      .prepare(
        `
      SELECT *
      FROM description_points
      WHERE invoice_item_id = ?
      ORDER BY point_order
    `,
      )
      .all(item.id);
  });
  invoice.payments = db
  .prepare(`
    SELECT p.*
    FROM incoming_payments p
    LEFT JOIN bank_transactions bt
      ON bt.id = p.bank_transaction_id
    WHERE p.invoice_id = ?
      AND COALESCE(p.is_deleted, 0) = 0
      AND (p.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
    ORDER BY p.payment_date DESC
  `)
  .all(id);
  const latestPayment = db
  .prepare(`
    SELECT p.amount
    FROM incoming_payments p
    LEFT JOIN bank_transactions bt
      ON bt.id = p.bank_transaction_id
    WHERE p.invoice_id = ?
      AND COALESCE(p.is_deleted, 0) = 0
      AND (p.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT 1
  `)
  .get(id);

  invoice.current_payment = latestPayment?.amount || 0;

  return invoice;
}

function listInvoices() {
  return getDb()
    .prepare(
      `
      SELECT
        i.*,
        c.company_name,
        c.contact_person,
        i.status AS display_status,

        (
          SELECT GROUP_CONCAT(name, '||')
          FROM (
            SELECT ii.name
            FROM invoice_items ii
            WHERE ii.invoice_id = i.id
            LIMIT 3
          )
        ) AS service_items

      FROM invoices i
      JOIN contacts c ON c.id = i.contact_id

      WHERE i.is_deleted = 0

      ORDER BY i.id DESC
      `,
    )
    .all();
}

function cancelInvoice(id, role = "operator") {
  if (role !== "super_admin")
    throw new Error("Only super admin can cancel invoices");
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.paid_amount > 0)
      throw new Error("Invoice with payments cannot be cancelled");
    db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(id);
    activity.log("invoice:cancelled", {
      entityType: "invoice",
      entityId: id,
      message: invoice.invoice_no,
    });
    return getInvoice(id);
  })();
}

function listInvoicesByContact(contactId) { // Rename parameter
  const db = getDb();

  const invoices = db
    .prepare(
      `
      SELECT
        i.id,
        i.invoice_no,
        i.invoice_date,
        i.status,
        i.grand_total

      FROM invoices i // This is fine

      WHERE i.contact_id = ? // Use contact_id

      ORDER BY i.id DESC
    `,
    )
    .all(contactId); // Use contactId

  return invoices.map((invoice) => {
    const items = db
      .prepare(
        `
        SELECT name
        FROM invoice_items
        WHERE invoice_id = ?
      `,
      )
      .all(invoice.id);

    return {
      ...invoice,
      items,
    };
  });
}

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoice,
  listInvoices,
  listInvoicesByContact,
  cancelInvoice,
};
