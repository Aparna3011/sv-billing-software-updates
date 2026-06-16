const { getDb } = require("../db/database");
const { ok } = require("./helpers");
const recurring = require("../services/recurring.service");
const activity = require("../services/activitylog.service");

const allowed = ["customer_id", "invoice_id"];

function normalize(data) {
  const clean = { ...data };

  clean.customer_id = Number(clean.customer_id);

  clean.invoice_id = clean.invoice_id ? Number(clean.invoice_id) : null;

  if (!clean.customer_id) {
    throw new Error("Please select a customer");
  }

  return clean;
}

module.exports = (ipcMain) => {
  ipcMain.handle(
    "recurring:list",

    ok(() => {
      const db = getDb();
      const rows = db
        .prepare(
          `
         SELECT
  r.id,

  r.customer_id,

  (
    SELECT collection_status 
    FROM recurring_invoice_history h 
    JOIN recurring_invoices ri_sub ON ri_sub.id = h.recurring_invoice_id
    WHERE ri_sub.recurring_id = r.id
    ORDER BY h.created_at DESC, h.id DESC LIMIT 1
  ) AS status,

  r.is_stopped,
  r.stopped_reason,

  r.created_at,

  c.company_name,
  c.contact_person,

  (
    SELECT SUM(amount)
    FROM recurring_invoice_history h
    JOIN recurring_invoices ri_sub ON ri_sub.id = h.recurring_invoice_id
    WHERE ri_sub.recurring_id = r.id AND h.action_type = 'payment_received'
  ) AS total_paid,

  (
    SELECT SUM(h.pending_amount)
    FROM recurring_invoice_history h
    WHERE h.id IN (
      SELECT MAX(id) 
      FROM recurring_invoice_history 
      WHERE recurring_invoice_id IN (SELECT id FROM recurring_invoices WHERE recurring_id = r.id)
      GROUP BY recurring_invoice_id
    )
  ) AS total_pending,

  COUNT(
  DISTINCT CASE
    WHEN ri.is_active = 1
      AND ri.is_deleted = 0
    THEN ri.id
  END
) AS total_templates,

  MIN(ri.recurring_invoice_no) AS recurring_invoice_no,

  (
  SELECT SUM(grand_total)
  FROM recurring_invoices
  WHERE recurring_id = r.id
    AND is_active = 1
    AND is_deleted = 0
) AS grand_total,

  GROUP_CONCAT(
    DISTINCT CASE
  WHEN ri.is_active = 1
   AND ri.is_deleted = 0
  THEN rii.name
  ELSE NULL
END
  ) AS service_names,

  GROUP_CONCAT(
    DISTINCT CASE
  WHEN ri.is_active = 1
   AND ri.is_deleted = 0
   AND ri.is_stopped = 0
  THEN (
    SELECT next_invoice_date 
    FROM recurring_invoice_history 
    WHERE recurring_invoice_id = ri.id 
    ORDER BY id DESC LIMIT 1
  )
  ELSE NULL
END
  ) AS next_dates

FROM recurring r

JOIN customers c
  ON c.id = r.customer_id

LEFT JOIN recurring_invoices ri
  ON ri.recurring_id = r.id

LEFT JOIN recurring_items rii
  ON rii.recurring_invoice_id = ri.id

WHERE r.is_deleted = 0

GROUP BY r.id

ORDER BY r.created_at DESC
        `,
        )
        .all();

      // Enhance each row with templates details
      const enhancedRows = rows.map((row) => {
        const templates = db
          .prepare(
            `
          SELECT 
            id,
            recurring_invoice_no as no,
            billing_cycle as cycle,
            (
              SELECT collection_status FROM recurring_invoice_history 
              WHERE recurring_invoice_id = ri_inner.id 
              ORDER BY created_at DESC, id DESC LIMIT 1
            ) as status,
            is_stopped,
            stopped_reason,
            (
              SELECT next_invoice_date FROM recurring_invoice_history 
              WHERE recurring_invoice_id = ri_inner.id 
              ORDER BY created_at DESC, id DESC LIMIT 1
            ) as next_date,
            grand_total as total,
            is_active
          FROM recurring_invoices ri_inner
          WHERE recurring_id = ? AND is_active = 1 AND is_deleted = 0
          ORDER BY id
        `,
          )
          .all(row.id);

        return {
          ...row,
          templates: JSON.stringify(templates),
        };
      });

      return enhancedRows;
    }),
  );

  ipcMain.handle(
    "recurring:get",

    ok((payload) => {
      const id = typeof payload === 'number' ? payload : payload.id;
      const light = payload.light || false;
      return recurring.getRecurring(id, light);
    }),
  );

  ipcMain.handle(
    "recurring:getPlan",
    ok((payload) => {
      const id = typeof payload === 'number' ? payload : payload.id;
      return recurring.getPlan(id);
    }),
  );

  ipcMain.handle(
    "recurring:create",

    ok((data) => recurring.createRecurring(normalize(data))),
  );

  ipcMain.handle(
    "recurring:update",

    ok(({ id, ...data }) =>
      recurring.updateRecurring(Number(id), normalize(data)),
    ),
  );

  ipcMain.handle(
    "recurring:delete",

    ok(({ id }) => {
      const r = recurring.getRecurring(id);
      const oldData = r;
      const invoiceNo = r?.templates?.[0]?.recurring_invoice_no || `ID: ${id}`;

      const result = getDb()
        .prepare(
          `
          UPDATE recurring
          SET is_deleted = 1
          WHERE id = ?
        `,
        ).run(id);

      const newData = recurring.getRecurring(id);
      activity.log("recurring:deleted", {
        entityType: "recurring",
        entityId: id,
        message: invoiceNo,
        oldData,
        newData,
      });

      return result;
    }),
  );

  ipcMain.handle(
    "recurring:generateDue",

    ok(() => recurring.generateDueInvoices()),
  );

  ipcMain.handle(
    "recurring:stopRecurring",

    ok(({ id, reason }) => recurring.stopRecurring(Number(id), reason)),
  );

  ipcMain.handle(
    "recurring:resumeRecurring",

    ok(({ id }) => recurring.resumeRecurring(Number(id))),
  );

  ipcMain.handle(
    "recurring:history",

    ok(({ recurringId }) => {
      const db = getDb();
      const rows = db
        .prepare(
          `
        SELECT
          rih.id,
          rih.recurring_invoice_id,
          rih.payment_id,
          rih.action_type,
          rih.action_notes,
          rih.amount,
          rih.payment_date,
          rih.due_date,
          rih.invoice_start_date,
          rih.next_invoice_date,
          rih.pending_amount,
          rih.paid_on_date,
          rih.overdue_days,
          rih.collection_status,
          rih.created_at,

          ri.recurring_invoice_no,
          COALESCE(NULLIF(rih.amount, 0), ri.grand_total) as grand_total,
          r.id AS recurring_id,

          c.company_name,
          c.contact_person,
          c.state,
          c.gst_treatment,
          co.state AS company_state,

          p.payment_no,
          p.reference_no,
          p.mode,

          inv.id AS generated_invoice_id,
          inv.invoice_no AS generated_invoice_no,
          inv.invoice_date,
          (
            SELECT h2.paid_amount
            FROM recurring_invoice_history h2
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date) -- Normalize dates
            ORDER BY h2.created_at DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_paid_amount,
          (
            SELECT h2.pending_amount
            FROM recurring_invoice_history h2
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date) -- Normalize dates
            ORDER BY h2.created_at DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_pending_amount,
          (
            SELECT h2.collection_status
            FROM recurring_invoice_history h2
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date) -- Normalize dates
            ORDER BY h2.created_at DESC, h2.id DESC
            LIMIT 1
          ) AS cycle_collection_status,
          (
            SELECT h2.payment_id
            FROM recurring_invoice_history h2
            JOIN incoming_payments ip2 ON ip2.id = h2.payment_id
            LEFT JOIN bank_transactions bt2 ON bt2.id = ip2.bank_transaction_id
            WHERE h2.recurring_invoice_id = rih.recurring_invoice_id
              AND date(h2.invoice_start_date) = date(rih.invoice_start_date) -- Normalize dates
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
          ) AS cycle_payment_id,
          ri.billing_cycle

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
        LEFT JOIN bank_transactions pbt
          ON pbt.id = p.bank_transaction_id

        LEFT JOIN invoices inv
          ON inv.recurring_id = ri.id 
          AND inv.invoice_date = rih.invoice_start_date
          AND inv.is_deleted = 0

        WHERE r.id = ?
          AND (
            rih.action_type <> 'payment_received'
            OR (
              COALESCE(p.is_deleted, 0) = 0
              AND (
                p.bank_transaction_id IS NULL
                OR COALESCE(pbt.is_deleted, 0) = 0
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
        .all(recurringId);

      return rows;
    }),
  );

  ipcMain.handle(
    "recurring:historyAll",
    ok(() => {
      return recurring.listAllHistory();
    }),
  );

  ipcMain.handle(
    "recurring:stopPlan",

    ok(({ id, templateId, reason }) =>
      recurring.stopPlan(Number(id), Number(templateId), reason),
    ),
  );

  ipcMain.handle(
    "recurring:resumePlan",

    ok(({ id, templateId }) =>
      recurring.resumePlan(Number(id), Number(templateId)),
    ),
  );
};
