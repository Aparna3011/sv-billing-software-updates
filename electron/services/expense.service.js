const { formatISO, addDays } = require("date-fns");
const { getDb } = require("../db/database");
const numbering = require("./numbering.service");
const activity = require("./activitylog.service");
const accounting = require("./accounting.service");
const { round, totalsForItems } = require("./gst.service");

function today() {
  return formatISO(new Date(), { representation: "date" });
}

function lookupName(db, table, id, column) {
  if (!id) return "";
  const row = db.prepare(`SELECT ${column} FROM ${table} WHERE id = ?`).get(id);
  return row?.[column] || "";
}

function normalize(payload = {}, fallback = {}) {
  const db = getDb();
  const clean = { ...fallback, ...payload };
  clean.expense_date = clean.expense_date || today();

  // Handle prefixed vendor_id from frontend (e.g., "v_1" or "c_5")
  if (typeof clean.vendor_id === 'string') {
    if (clean.vendor_id.startsWith('v_')) {
      clean.vendor_id = Number(clean.vendor_id.substring(2)); // Extract numeric ID for vendor
    } else if (clean.vendor_id.startsWith('c_')) {
      clean.vendor_id = null; // Customers are not stored in vendor_id column in expenses table
      // Ensure vendor name is captured if it's a customer
      clean.vendor = clean.vendor || payload.vendor;
    } else {
      clean.vendor_id = Number(clean.vendor_id); // Fallback for raw numeric ID
    }
  } else {
    clean.vendor_id = clean.vendor_id ? Number(clean.vendor_id) : null;
  }
  clean.bank_account_id = clean.bank_account_id ? Number(clean.bank_account_id) : null;
  clean.vendor =
    lookupName(db, "vendors", clean.vendor_id, "company_name") || 
    String(clean.vendor || "").trim();

  // Handle GST enabled flag
  if (payload.is_gst_enabled !== undefined) {
    clean.is_gst_enabled = payload.is_gst_enabled ? 1 : 0;
  } else if (fallback.is_gst_enabled !== undefined) {
    clean.is_gst_enabled = fallback.is_gst_enabled;
  } else {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'gst_enabled_incoming'").get();
    clean.is_gst_enabled = setting?.value !== '0' ? 1 : 0;
  }

  const items = (clean.items || []).map(item => ({
    ...item,
    name: String(item.name || "").trim(),
    qty: Number(item.qty || 1),
    rate: Number(item.rate || 0),
    gst_rate: Number(item.gst_rate || 0)
  })).filter(i => i.name && i.qty > 0);

  if (!items.length) throw new Error("At least one expense item is required");

  const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
  const vendor = clean.vendor_id ? db.prepare("SELECT * FROM vendors WHERE id = ?").get(clean.vendor_id) : null;
  const totals = totalsForItems(items, company, { 
    state: vendor?.state || company?.state || "", 
    gst_treatment: 'registered' 
  }, 0, false, clean.is_gst_enabled === 1);

  console.log("[Audit] GST Calculation Totals:", totals);
  clean.items = totals.items;
  clean.subtotal = totals.subtotal;
  clean.amount = totals.subtotal; // Legacy support for old schema
  clean.gst_rate = clean.items[0]?.gst_rate || 0;
  clean.gst_amount = totals.taxTotal; // Legacy support for old schema
  clean.tax_total = totals.taxTotal; // New field
  clean.cgst_total = totals.cgst;
  clean.sgst_total = totals.sgst;
  clean.igst_total = totals.igst;
  clean.total_amount = totals.grandTotal;

  // Resolve Category for the main expense record
  const firstItem = clean.items[0];
  clean.category_id = ensureCategory(db, firstItem);
  clean.category = lookupName(db, "expense_categories", clean.category_id, "name") || firstItem.name;

  clean.payment_mode = clean.payment_mode || "bank_transfer";
  
  // Automate status calculation
  const paid = round(Number(payload.paid_amount || fallback.paid_amount || 0));
  const total = round(Number(clean.total_amount || 0));
  
  clean.paid_amount = paid;
  clean.balance_due = Math.max(0, round(total - paid));
  clean.status = clean.balance_due <= 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'unpaid');

  clean.reference_no = clean.reference_no || "";
  clean.attachment_path = clean.attachment_path || "";
  clean.notes = clean.notes || "";

  if (!clean.vendor_id && !clean.vendor) throw new Error("Vendor is required");
  if (!clean.category_id && !clean.category) throw new Error("Category is required");
  if (clean.amount <= 0) throw new Error("Amount must be greater than zero");
  return clean;
}

function ensureCategory(db, item) {
  if (item.category_id) return item.category_id;
  const name = String(item.name || "").trim();
  if (!name) return null;
  const existing = db.prepare("SELECT id FROM expense_categories WHERE TRIM(LOWER(name)) = LOWER(?) LIMIT 1").get(name);
  if (existing) return existing.id;
  const info = db.prepare("INSERT INTO expense_categories (name, is_active) VALUES (?, 1)").run(name);
  return info.lastInsertRowid;
}

function insertItems(db, expenseId, items) {
  db.prepare("DELETE FROM expense_items WHERE expense_id = ?").run(expenseId);
  const stmt = db.prepare(`
    INSERT INTO expense_items (
      expense_id, category_id, name, description, qty, rate,
      gst_rate, cgst, sgst, igst, line_total, billing_type
    ) VALUES (
      @expense_id, @category_id, @name, @description, @qty, @rate,
      @gst_rate, @cgst, @sgst, @igst, @line_total, 'Expense'
    )
  `);
  for (const item of items) {
    const category_id = item.category_id || ensureCategory(db, item);
    stmt.run({ ...item, expense_id: expenseId, category_id });
  }
}

function listExpenses() {
  const db = getDb();
  return db.prepare(
      `
      SELECT
        e.*,
        COALESCE(v.company_name, e.vendor) AS vendor_name,
        v.contact_person,
        v.phone,
        v.email,
        v.gstin,
        v.address,
        v.city,
        v.state,
        COALESCE(ec.name, e.category) AS category_name,
        ba.account_name AS bank_account_name,
        bt.id AS linked_bank_transaction_id,
        bt.balance_after
      FROM expenses e
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
      LEFT JOIN bank_transactions bt ON bt.id = e.bank_transaction_id
      WHERE e.is_deleted = 0
      ORDER BY e.expense_date DESC, e.id DESC
    `,
    )
    .all()
    .map(row => ({
      ...row,
      items: [{
        description: row.category_name || row.category,
        qty: 1,
        rate: row.amount,
        gst_rate: row.gst_rate,
        gst_amount: row.gst_amount,
        total: row.total_amount
      }]
    }));
}

function getExpense(id) {
  const db = getDb();
  const targetId = Number(id);
  
  const expense = db.prepare(`
    SELECT
      e.*,
      COALESCE(v.company_name, e.vendor) AS vendor_name,
      v.contact_person,
      v.phone,
      v.email,
      v.gstin,
      v.address,
      v.city,
      v.state,
      COALESCE(ec.name, e.category) AS category_name,
      ba.account_name AS bank_account_name,
      bt.id AS linked_bank_transaction_id,
      bt.balance_after
    FROM expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
    LEFT JOIN bank_transactions bt ON bt.id = e.bank_transaction_id
    WHERE e.id = ? AND e.is_deleted = 0
  `).get(targetId);

  if (!expense) return null;

  expense.items = db
    .prepare("SELECT * FROM expense_items WHERE expense_id = ? ORDER BY id")
    .all(targetId);

  // Fallback for legacy unmigrated records
  if (!expense.items.length) {
    expense.items = [{
      name: expense.category_name || expense.category,
      description: expense.notes,
      qty: 1,
      rate: expense.amount,
      gst_rate: expense.gst_rate,
      line_total: expense.total_amount
    }];
  }

  expense.payments = db
    .prepare(`
      SELECT 
        op.*, 
        ba.account_name as bank_account_name,
        bt.transaction_date as bank_tx_date,
        bt.type as bank_tx_type,
        bt.balance_after as bank_balance_after,
        bt.reference_no as bank_ref
      FROM outgoing_payments op
      LEFT JOIN bank_accounts ba ON ba.id = op.bank_account_id
      LEFT JOIN bank_transactions bt ON bt.id = op.bank_transaction_id
      WHERE op.expense_id = ?
        AND COALESCE(op.is_deleted, 0) = 0
        AND (op.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
      ORDER BY op.payment_date DESC, op.id DESC
    `)
    .all(targetId);

  expense.bank_transaction = expense.bank_transaction_id
    ? db
        .prepare(
          `
          SELECT bt.*, ba.account_name, ba.bank_name,
                 CASE WHEN bt.type = 'debit' THEN bt.amount ELSE 0 END AS debit,
                 CASE WHEN bt.type = 'credit' THEN bt.amount ELSE 0 END AS credit
          FROM bank_transactions bt
          LEFT JOIN bank_accounts ba ON ba.id = bt.bank_account_id
          WHERE bt.id = ?
        `,
        )
        .get(expense.bank_transaction_id)
    : null;
  expense.activity = db
    .prepare(
      `
      SELECT *
      FROM activity_logs
      WHERE entity_type = 'expense' AND entity_id = ?
      ORDER BY created_at DESC
    `).all(targetId);

  return expense;
}

function expenseDashboard() {
  const db = getDb();
  const topCategory = db
    .prepare(
      `
      SELECT COALESCE(ec.name, e.category, 'Uncategorized') category, COALESCE(SUM(e.total_amount), 0) total
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      WHERE e.is_deleted = 0
      GROUP BY category
      ORDER BY total DESC
      LIMIT 1
    `,
    )
    .get();
  return {
    todaysExpenses: db
      .prepare("SELECT COALESCE(SUM(total_amount), 0) total FROM expenses WHERE is_deleted = 0 AND expense_date = date('now', 'localtime')")
      .get().total,
    monthlyExpenses: db
      .prepare("SELECT COALESCE(SUM(total_amount), 0) total FROM expenses WHERE is_deleted = 0 AND strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now', 'localtime')")
      .get().total,
    yearlyExpenses: db
      .prepare("SELECT COALESCE(SUM(total_amount), 0) total FROM expenses WHERE is_deleted = 0 AND strftime('%Y', expense_date) = strftime('%Y', 'now', 'localtime')")
      .get().total,
    topExpenseCategory: topCategory?.category || "-",
  };
}

function createExpense(payload) {
  const db = getDb();
  const clean = normalize(payload);
  console.log("[Audit] Final Expense Header Payload:", clean);

  return db.transaction(() => {
    clean.expense_no = clean.expense_no || numbering.nextExpenseNo(new Date(clean.expense_date));

    const info = db
      .prepare(
        `
        INSERT INTO expenses (
        expense_no, expense_date, vendor, vendor_id, category, category_id, is_gst_enabled,
          amount, subtotal, gst_rate, gst_amount, tax_total, cgst_total, 
          sgst_total, igst_total, total_amount, payment_mode,
          reference_no, notes, attachment_path, bank_account_id, status,
          paid_amount, balance_due
        )
        VALUES (
        @expense_no, @expense_date, @vendor, @vendor_id, @category, @category_id, @is_gst_enabled,
          @amount, @subtotal, @gst_rate, @gst_amount, @tax_total, @cgst_total,
          @sgst_total, @igst_total, @total_amount, @payment_mode,
          @reference_no, @notes, @attachment_path, @bank_account_id, @status,
          @paid_amount, @balance_due
        )
      `,
      )
      .run(clean);

    insertItems(db, info.lastInsertRowid, clean.items);

    console.log("[Audit] Expense Header INSERT Successful. ID:", info.lastInsertRowid);
    if (clean.paid_amount > 0) {
      recordExpensePayment({
        expense_id: info.lastInsertRowid,
        vendor_id: clean.vendor_id,
        payment_date: clean.expense_date,
        amount: clean.paid_amount,
        mode: clean.payment_mode,
        bank_account_id: payload.bank_account_id,
        reference_no: clean.reference_no || clean.expense_no,
        notes: "Initial payment recorded with expense",
      });
    }

    accounting.createLedgerEntry(db, {
      entry_date: clean.expense_date,
      account: "Expense",
      source_type: "expense",
      source_id: info.lastInsertRowid,
      reference_no: clean.expense_no,
      debit: clean.total_amount,
      notes: clean.notes,
    });

    activity.log("expense:created", {
      entityType: "expense",
      entityId: info.lastInsertRowid,
      message: clean.expense_no,
      newData: getExpense(info.lastInsertRowid),
    });

    return getExpense(info.lastInsertRowid);
  })();
}

function updateExpense(payload) {
  const db = getDb();
  const routeId = Number(payload.id);
  console.log(`[TRACE] Service received ID: ${routeId}`);

  const oldData = getExpense(routeId);
  if (!oldData) throw new Error("Expense not found");
  console.log(`[TRACE] Database lookup successful for ID: ${oldData.id}`);

  const clean = normalize(payload, oldData);
  console.log(`[TRACE] Final Database Query ID: ${routeId}`);

  return db.transaction(() => {
    // Recalculate totals based on actual payments in DB
    const paymentTotals = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM outgoing_payments WHERE expense_id = ? AND COALESCE(is_deleted, 0) = 0").get(routeId);
    clean.paid_amount = round(paymentTotals.s);
    clean.balance_due = Math.max(0, round(clean.total_amount - clean.paid_amount));
    clean.status = clean.balance_due <= 0 ? 'paid' : (clean.paid_amount > 0 ? 'partially_paid' : 'unpaid');
    console.log("Before update lookup:", getExpense(routeId));

    db.prepare(
      `
      UPDATE expenses
      SET expense_no = @expense_no,
          expense_date = @expense_date,
          vendor = @vendor,
          vendor_id = @vendor_id,
          category = @category,
          category_id = @category_id,
          is_gst_enabled = @is_gst_enabled,
          amount = @amount,
          subtotal = @subtotal,
          gst_rate = @gst_rate,
          gst_amount = @gst_amount,
          tax_total = @tax_total,
          cgst_total = @cgst_total,
          sgst_total = @sgst_total,
          igst_total = @igst_total,
          total_amount = @total_amount,
          payment_mode = @payment_mode,
          reference_no = @reference_no,
          notes = @notes,
          attachment_path = @attachment_path,
          bank_account_id = @bank_account_id,
          status = @status,
          paid_amount = @paid_amount,
          balance_due = @balance_due
      WHERE id = @id
    `).run({ ...clean, id: routeId });

    insertItems(db, routeId, clean.items);

    console.log(`[TRACE] Update Query executed for ID: ${routeId}`);

    const newData = getExpense(routeId);
    activity.log("expense:updated", {
      entityType: "expense",
      entityId: routeId,
      message: clean.expense_no,
      oldData,
      newData,
    });
    return newData;
  })();
}

function recordExpensePayment(payload) {
  const db = getDb();
  return db.transaction(() => {
    const expenseId = Number(payload.expense_id || payload.id);
    const exp = db.prepare("SELECT subtotal, tax_total, total_amount, paid_amount, balance_due, status, vendor, vendor_id, category_id, category, expense_no FROM expenses WHERE id = ? AND is_deleted = 0").get(expenseId);
    if (!exp) throw new Error("Expense not found");

    const amount = round(payload.amount || 0);
    if (amount <= 0) throw new Error("Payment amount must be greater than zero");

    // Sum existing payments to determine actual remaining limit regardless of header cache
    const existingSum = Number(db.prepare("SELECT SUM(amount) as s FROM outgoing_payments WHERE expense_id = ? AND COALESCE(is_deleted, 0) = 0").get(expenseId).s || 0);
    const remainingLimit = Math.max(0, round(exp.total_amount - existingSum));

    console.log({
      subtotal: exp.subtotal,
      gst: exp.tax_total,
      grandTotal: exp.total_amount,
      initialPayment: amount,
      paidAmount: exp.paid_amount,
      balanceDue: exp.balance_due,
      status: exp.status
    });

    if (amount > remainingLimit) throw new Error("Payment amount cannot exceed outstanding balance");

    accounting.checkNarrationRequirement(db, payload.notes);

    const paymentDate = payload.payment_date || today();
    const paymentNo = numbering.nextPurchasePaymentNo(new Date(paymentDate));
    const bankAccountId = payload.bank_account_id ? Number(payload.bank_account_id) : null;

    const info = db.prepare(`
      INSERT INTO outgoing_payments (expense_id, vendor_id, category_id, payment_no, payment_date, amount, mode, reference_no, notes, bank_account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(expenseId, exp.vendor_id, exp.category_id, paymentNo, paymentDate, amount, payload.mode, payload.reference_no || '', payload.notes || '', bankAccountId);

    if (bankAccountId) {
      const bankTx = accounting.createBankTransaction(db, {
        bank_account_id: bankAccountId,
        transaction_date: paymentDate,
        type: "debit",
        source_type: "expense_payment",
        source_id: info.lastInsertRowid,
        amount,
        reference_no: payload.reference_no || exp.expense_no,
        notes: `Party: ${exp.vendor} | ${payload.notes || exp.category}`,
      });
      db.prepare("UPDATE outgoing_payments SET bank_transaction_id = ? WHERE id = ?").run(bankTx.id, info.lastInsertRowid);
    }

    const totalPaid = Number(db.prepare("SELECT SUM(amount) as s FROM outgoing_payments WHERE expense_id = ? AND COALESCE(is_deleted, 0) = 0").get(expenseId).s || 0);
    const balanceDue = Math.max(0, round(Number(exp.total_amount || 0) - totalPaid));
    const status = balanceDue <= 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid');

    db.prepare("UPDATE expenses SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?")
      .run(totalPaid, balanceDue, status, expenseId);

    activity.log("expense:payment_recorded", {
      entityType: "expense",
      entityId: expenseId,
      message: paymentNo,
      newData: getExpense(expenseId)
    });

    return true;
  })();
}
function deleteExpense(id) {
  const db = getDb();
  return db.transaction(() => {
    const expense = getExpense(id);
    if (!expense) throw new Error("Expense not found");
    
    // Strictly match Purchase Block logic: No delete if payments exist
    if (Number(expense.paid_amount || 0) > 0) {
      throw new Error("Expense with recorded payments cannot be deleted. Please delete payments first.");
    }

    db.prepare("UPDATE expenses SET is_deleted = 1 WHERE id = ?").run(id);
    activity.log("expense:deleted", {
      entityType: "expense",
      entityId: Number(id),
      message: expense.expense_no,
      oldData: expense,
    });
    return true;
  })();
}

module.exports = {
  createExpense,
  deleteExpense,
  expenseDashboard,
  getExpense,
  listExpenses,
  updateExpense,
  recordExpensePayment,
};
