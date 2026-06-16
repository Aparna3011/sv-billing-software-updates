const { getDb } = require("../db/database");
const { ok } = require("./helpers");
const payments = require("../services/payment.service");

module.exports = (ipcMain) => {
  ipcMain.handle(
    "payments:list",
    ok(() =>
      getDb()
        .prepare(
          `
    SELECT
  p.*,
  i.invoice_no,
  ri.recurring_invoice_no,
  c.company_name,
  c.contact_person,
  ba.account_name AS bank_account_name,

  CASE
    WHEN i.id IS NOT NULL THEN (
      SELECT GROUP_CONCAT(name, '||')
      FROM (
        SELECT ii.name
        FROM invoice_items ii
        WHERE ii.invoice_id = i.id
        LIMIT 3
      )
    )

    WHEN ri.id IS NOT NULL THEN (
      SELECT GROUP_CONCAT(name, '||')
      FROM (
        SELECT rii.name
        FROM recurring_items rii
        WHERE rii.recurring_invoice_id = ri.id
        LIMIT 3
      )
    )
  END AS service_items

FROM incoming_payments p

LEFT JOIN invoices i
  ON i.id = p.invoice_id

LEFT JOIN recurring_invoices ri
  ON ri.id = COALESCE(p.recurring_invoice_id, i.recurring_id)

JOIN customers c
  ON c.id = p.customer_id

LEFT JOIN bank_accounts ba
  ON ba.id = p.bank_account_id

LEFT JOIN bank_transactions bt
  ON bt.id = p.bank_transaction_id

WHERE COALESCE(p.is_deleted, 0) = 0
  AND COALESCE(bt.is_deleted, 0) = 0

ORDER BY p.id DESC
  `,
        )
        .all(),
    ),
  );
  ipcMain.handle(
    "payments:create",
    ok((payload) => payments.recordPayment(payload)),
  );
  ipcMain.handle(
    "payments:update",

    ok((payload) => {
      const db = getDb();

      return db.transaction(() => {
        // OLD PAYMENT
        const oldPayment = db
          .prepare(
            `
          SELECT *
          FROM incoming_payments
          WHERE id = ?
        `,
          )
          .get(payload.id);

        if (!oldPayment) {
          throw new Error("Payment not found");
        }

        // UPDATE PAYMENT
        db.prepare(
          `
        UPDATE incoming_payments
        SET
          payment_date = ?,
          amount = ?,
          mode = ?,
          reference_no = ?,
          notes = ?
        WHERE id = ?
      `,
        ).run(
          payload.payment_date,

          Number(payload.amount),

          payload.mode,

          payload.reference_no,

          payload.notes || "",

          payload.id,
        );

        // RECALCULATE TOTAL PAID
        const totals = db
          .prepare(
            `
          SELECT
            IFNULL(
              SUM(amount),
              0
            ) as total_paid
          FROM incoming_payments
          WHERE invoice_id = ?
        `,
          )
          .get(oldPayment.invoice_id);

        // GET INVOICE
        const invoice = db
          .prepare(
            `
          SELECT *
          FROM invoices
          WHERE id = ?
        `,
          )
          .get(oldPayment.invoice_id);

        const paidAmount = Number(totals.total_paid || 0);

        const balanceDue = Number(invoice.grand_total || 0) - paidAmount;

        // STATUS
        let status = "unpaid";

        if (balanceDue <= 0) {
          status = "paid";
        } else if (paidAmount > 0) {
          status = "partially_paid";
        }

        // UPDATE INVOICE
        db.prepare(
          `
        UPDATE invoices
        SET
          paid_amount = ?,
          balance_due = ?,
          status = ?
        WHERE id = ?
      `,
        ).run(
          paidAmount,

          balanceDue,

          status,

          invoice.id,
        );

        return true;
      })();
    }),
  );
};
