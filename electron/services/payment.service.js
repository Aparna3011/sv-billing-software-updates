const { formatISO } = require('date-fns');
const { getDb } = require('../db/database');
const numbering = require('./numbering.service');
const activity = require('./activitylog.service');
const recurring = require('./recurring.service');
const accounting = require('./accounting.service');

function recordPayment(payload) {
  const db = getDb();
  return db.transaction(() => {
    const invoiceId = payload.invoice_id ? Number(payload.invoice_id) : null;
    const recurringInvoiceId = payload.recurring_invoice_id ? Number(payload.recurring_invoice_id) : null;

    accounting.checkNarrationRequirement(db, payload.notes);

    if (!payload.bank_account_id) throw new Error('Bank/Cash account is required to record a payment');

    const invoice = invoiceId ? db.prepare('SELECT * FROM invoices WHERE id = ? AND is_deleted = 0').get(invoiceId) : null;

    const oldData = {
      paid_amount: invoice?.paid_amount || 0,
      balance_due: invoice?.balance_due || 0,
      status: invoice?.status || 'recorded',
    };

    if (invoiceId && !invoice) throw new Error('Invoice not found');

    const amount = Number(payload.amount || 0);
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');

    if (invoice && amount > Number(invoice.balance_due || 0)) {
      throw new Error('Payment amount cannot exceed invoice balance due');
    }

    const paymentDate = payload.payment_date || formatISO(new Date(), { representation: 'date' });
    const paymentNo = payload.payment_no || numbering.nextPaymentNo(new Date(paymentDate));

    let customerId = payload.customer_id ? Number(payload.customer_id) : invoice?.customer_id;

    if (!customerId && recurringInvoiceId) {
      const plan = db.prepare('SELECT recurring_id FROM recurring_invoices WHERE id = ?').get(recurringInvoiceId);
      if (plan) {
        const header = db.prepare('SELECT customer_id FROM recurring WHERE id = ?').get(plan.recurring_id);
        customerId = header?.customer_id;
      }
    }

    if (!customerId) throw new Error('Customer information required for payment');

    const info = db.prepare(`
      INSERT INTO incoming_payments (
        payment_no, invoice_id, customer_id, payment_date, amount, 
        mode, reference_no, notes, recurring_invoice_id, bank_account_id, category_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentNo, 
      invoiceId, 
      customerId, 
      paymentDate, 
      amount, 
      payload.mode || 'bank_transfer', 
      payload.reference_no || '', 
      payload.notes || '', 
      recurringInvoiceId || invoice?.recurring_invoice_id || null,
      payload.bank_account_id || null,
      payload.category_id || null
    );

    const paymentId = info.lastInsertRowid;

    // Create Bank Transaction if bank account is provided
    if (payload.bank_account_id) {
      const bankTx = accounting.createBankTransaction(db, {
        bank_account_id: payload.bank_account_id,
        transaction_date: paymentDate,
        type: "credit",
        source_type: "customer_payment",
        source_id: paymentId,
        amount: amount,
        reference_no: payload.reference_no || paymentNo,
        notes: payload.notes || `Payment from customer`,
      });
      db.prepare("UPDATE incoming_payments SET bank_transaction_id = ? WHERE id = ?").run(bankTx.id, paymentId);
    }

    if (invoice) {
      const paidAmount = Number(invoice.paid_amount || 0) + amount; // Ensure invoice.paid_amount is number
      const balanceDue = Math.max(0, Number(invoice.grand_total || 0) - paidAmount); // Ensure invoice.grand_total is number
      const status = balanceDue === 0 ? 'paid' : 'partially_paid';
      db.prepare('UPDATE invoices SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?').run(paidAmount, balanceDue, status, invoice.id);
    }

    // 5. Sync Recurring History
    const finalRecurringInvoiceId = recurringInvoiceId || invoice?.recurring_invoice_id;
    if (finalRecurringInvoiceId) {
      const oldPlanData = db
        .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
        .get(finalRecurringInvoiceId);

      recurring.syncRecurringLifecycle(db, finalRecurringInvoiceId, {
        payment_id: info.lastInsertRowid,
        payment_date: paymentDate,
        amount: amount,
        notes: payload.notes || `Payment received: ${payload.mode}`,
        action_type: 'payment_received'
      });

      const plan = db.prepare('SELECT recurring_id, recurring_invoice_no FROM recurring_invoices WHERE id = ?').get(finalRecurringInvoiceId);
      const newPlanData = db
        .prepare("SELECT * FROM recurring_invoices WHERE id = ?")
        .get(finalRecurringInvoiceId);

      if (plan) {
        activity.log("recurring:payment_received", {
          entityType: "recurring",
          entityId: plan.recurring_id,
          message: `${plan.recurring_invoice_no}: ${paymentNo}`,
          oldData: oldPlanData,
          newData: newPlanData,
        });
      }
    }

    const updatedInvoice =
      invoice ? db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invoice.id) : null;

const newData = {
  payment_no: paymentNo,
  payment_amount: amount,
  paid_amount: updatedInvoice?.paid_amount || amount,
  balance_due: updatedInvoice?.balance_due || 0,
  status: updatedInvoice?.status || 'recorded',
};

activity.log(
  'payment:received',
  {
    entityType: 'payment',
    entityId: info.lastInsertRowid,
    message: paymentNo,

    oldData,
    newData,
  }
);
    return db.prepare('SELECT * FROM incoming_payments WHERE id = ?').get(info.lastInsertRowid);
  })();
}

module.exports = { recordPayment };
