const { addDays, formatISO } = require("date-fns");
const { getDb } = require("../db/database");
const numbering = require("./numbering.service");
const activity = require("./activitylog.service");
const accounting = require("./accounting.service");
const { round, totalsForItems, ensureService } = require("./gst.service");

function today() {
  return formatISO(new Date(), { representation: "date" });
}

function vendorName(db, id, fallback) {
  if (!id) return String(fallback || "").trim();
  const row = db.prepare("SELECT company_name FROM contacts WHERE id = ? AND is_vendor = 1").get(id);
  return row?.company_name || String(fallback || "").trim();
}

function statusForPurchase(purchase, paidAmount = purchase.paid_amount) {
  const total = Number(purchase.grand_total || 0);
  const paid = Number(paidAmount || 0);
  const balanceDue = round(total - paid);

  if (balanceDue <= 0) return "paid";
  if (paid > 0) return "partially_paid";
  return "unpaid";
}

function normalizeItems(items = [], fallback = {}) {
  const source =
    items.length > 0
      ? items
      : [
          {
            service_id: fallback.service_id || null,
            name: fallback.service_name || "Purchase Item",
            description: fallback.notes || "",
            qty: 1,
            rate: fallback.amount || 0,
            gst_rate: fallback.gst_rate || 0,
            sac_code: fallback.sac_code || "",
            billing_type: fallback.billing_type || "Service",
          },
        ];

  return source
    .map((item) => ({
      service_id: item.service_id ? Number(item.service_id) : null,
      name: String(item.name || item.service_name || "").trim(),
      description: item.description || "",
      sac_code: item.sac_code || "",
      qty: Number(item.qty || 1),
      billing_type: item.billing_type || "Service",
      rate: Number(item.rate || 0),
      gst_rate: item.gst_rate == null ? 0 : Number(item.gst_rate),
    }))
    .filter((item) => item.name && item.qty > 0 && item.rate >= 0);
}

function calculatePurchaseTotals(items, vendor, isGstEnabled = true) {
  const company = getDb().prepare("SELECT * FROM company WHERE id = 1").get();
  const vendorAsContact = {
    state: vendor?.state || company?.state || "",
    gst_treatment: "registered",
  };
  return totalsForItems(items, company, vendorAsContact, 0, false, isGstEnabled);
}

function normalizePurchase(payload = {}, fallback = {}) {
  const db = getDb();
  const clean = { ...fallback, ...payload };
  clean.bill_date = clean.bill_date || today();
  
  // Handle prefixed contact_id from frontend (e.g., "v_1" or "c_5") and ensure it's a number or null
  let rawCid;
  if (typeof clean.contact_id === 'string') {
    if (clean.contact_id.startsWith('v_') || clean.contact_id.startsWith('c_')) {
      rawCid = parseInt(clean.contact_id.substring(2), 10); // Extract numeric ID
    } else {
      rawCid = parseInt(clean.contact_id, 10); // Fallback for raw numeric ID
    }
  } else {
    rawCid = parseInt(clean.contact_id, 10);
  }
  clean.contact_id = !isNaN(rawCid) && rawCid > 0 ? rawCid : null; // Ensure it's a valid number or null

  // Fetch the contact to ensure it's a vendor
  const contact = clean.contact_id
    ? db.prepare("SELECT * FROM contacts WHERE id = ? AND is_vendor = 1 AND is_deleted = 0").get(clean.contact_id)
    : null;

  clean.vendor = vendorName(db, clean.contact_id, clean.vendor); // Use contact_id
  clean.bill_no = clean.bill_no || numbering.nextBillNo(new Date(clean.bill_date)); // This comment is fine, it's a note
  clean.vendor_bill_no = clean.vendor_bill_no || ""; // Keep vendor_bill_no as it's an external reference
  clean.due_date = clean.due_date || formatISO(addDays(new Date(clean.bill_date), Number(contact?.payment_terms || 15)), { representation: "date" }); // This comment is fine, it's a note
  clean.notes = clean.notes || "";

  // Handle GST enabled flag
  if (payload.is_gst_enabled !== undefined) {
    clean.is_gst_enabled = payload.is_gst_enabled ? 1 : 0;
  } else if (fallback.is_gst_enabled !== undefined) {
    clean.is_gst_enabled = fallback.is_gst_enabled;
  } else {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'gst_enabled_incoming'").get();
    clean.is_gst_enabled = setting?.value !== '0' ? 1 : 0;
  }

  const items = normalizeItems(clean.items || [], clean);

  if (!clean.contact_id) throw new Error("A valid Vendor Selection is required (Foreign Key constraint)."); // This comment is fine, it's a note
  if (!items.length) throw new Error("At least one purchase item is required");

  const totals = calculatePurchaseTotals(items, contact, clean.is_gst_enabled === 1); // Use contact for GST calculation
  clean.items = totals.items.map((item) => ({
    ...item,
    name: item.name || item.service_name,
    sac_code: item.sac_code || "",
    billing_type: item.billing_type || "Service",
  }));
  clean.service_name = clean.items[0]?.name || clean.service_name || "Purchase Item";
  clean.amount = totals.subtotal;
  clean.gst_rate = clean.items[0]?.gst_rate || 0;
  clean.gst_amount = totals.taxTotal;
  clean.subtotal = totals.subtotal;
  clean.cgst_total = totals.cgst;
  clean.sgst_total = totals.sgst;
  clean.igst_total = totals.igst;
  clean.tax_total = totals.taxTotal;
  clean.grand_total = totals.grandTotal;

  // Derive status and paid_amount strictly. Ignore payload.status
  // Prioritize payload, then fallback, then null
  clean.bank_account_id = payload.bank_account_id ? Number(payload.bank_account_id) : (fallback.bank_account_id ? Number(fallback.bank_account_id) : null);
  clean.payment_mode = payload.payment_mode || fallback.payment_mode || "bank_transfer"; // Ensure payment_mode is set
  
  clean.paid_amount = round(Number(payload.paid_amount || fallback.paid_amount || 0));
  clean.balance_due = Math.max(0, round(clean.grand_total - clean.paid_amount));
  clean.status = statusForPurchase(clean, clean.paid_amount);
  return clean;
}

function insertItems(db, purchaseId, items) {
  db.prepare("DELETE FROM purchase_items WHERE purchase_id = ?").run(purchaseId);
  console.log(`[Audit] Inserting ${items.length} items for Purchase ID: ${purchaseId}`);
  items.forEach((item) => {
    // Fix: Force ensureService to resolve by name if the ID belongs to categories, 
    // or strip service_id to prevent FK collision with services table
    const serviceId = ensureService(db, { ...item, service_id: null });
    console.log(`[Audit] Purchase Item resolved to Service ID: ${serviceId}`, item);
    db.prepare(
      `
      INSERT INTO purchase_items (
        purchase_id, service_id, name, description, sac_code, qty, billing_type,
        rate, gst_rate, cgst, sgst, igst, line_total
      )
      VALUES (
        @purchase_id, @service_id, @name, @description, @sac_code, @qty, @billing_type,
        @rate, @gst_rate, @cgst, @sgst, @igst, @line_total
      )
    `,
    ).run({ ...item, purchase_id: purchaseId, service_id: serviceId });
  });
}

function listPurchases() {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        p.*,
        COALESCE(v.company_name, p.vendor) AS vendor_name,
        ba.account_name AS bank_account_name
      FROM purchases p
      LEFT JOIN contacts v ON v.id = p.contact_id
      LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
      WHERE p.is_deleted = 0
      ORDER BY p.bill_date DESC, p.id DESC
    `,
    )
    .all();

  return rows.map((row) => ({
    ...row,
    status: statusForPurchase(row, row.paid_amount),
    items: db.prepare("SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id").all(row.id),
  }));
}

function getPurchase(id) {
  const db = getDb();
  const targetId = Number(id);

  const purchase = db.prepare(`
    SELECT
      p.*,
      COALESCE(v.company_name, p.vendor) AS vendor_name,
      v.contact_person, -- Use contact's contact_person
      v.phone,
      v.email,
      v.gstin,
      v.address,
      v.city,
      v.state,
      ba.account_name AS bank_account_name
    FROM purchases p
    LEFT JOIN contacts v ON v.id = p.contact_id
    LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
    WHERE p.id = ? AND p.is_deleted = 0
  `).get(targetId);

  if (!purchase) return null;

  purchase.payments = db
    .prepare(
      `
      SELECT 
        pp.*, 
        ba.account_name AS bank_account_name,
        bt.transaction_date as bank_tx_date,
        bt.type as bank_tx_type,
        bt.balance_after as bank_balance_after,
        bt.reference_no as bank_ref
      FROM outgoing_payments pp
      LEFT JOIN bank_accounts ba ON ba.id = pp.bank_account_id
      LEFT JOIN bank_transactions bt ON bt.id = pp.bank_transaction_id
      WHERE pp.purchase_id = ?
        AND COALESCE(pp.is_deleted, 0) = 0
        AND (pp.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
      ORDER BY pp.payment_date DESC, pp.id DESC
    `,
    ).all(targetId);

  purchase.items = db.prepare("SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id").all(targetId);

  purchase.activity = db
    .prepare(
      `
      SELECT *
      FROM activity_logs
      WHERE entity_type = 'purchase' AND entity_id = ?
      ORDER BY created_at DESC
    `,
    ).all(targetId);

  return purchase;
}

function purchaseDashboard() {
  const db = getDb();
  return {
    totalPurchases: db
      .prepare("SELECT COALESCE(SUM(grand_total), 0) total FROM purchases WHERE is_deleted = 0")
      .get().total,
    paidBills: db
      .prepare("SELECT COUNT(*) total FROM purchases WHERE is_deleted = 0 AND balance_due <= 0")
      .get().total,
    unpaidBills: db
      .prepare("SELECT COUNT(*) total FROM purchases WHERE is_deleted = 0 AND balance_due > 0")
      .get().total,
    overdueBills: db
      .prepare("SELECT COUNT(*) total FROM purchases WHERE is_deleted = 0 AND balance_due > 0 AND due_date IS NOT NULL AND due_date < date('now', 'localtime')")
      .get().total,
    todaysPurchases: db
      .prepare("SELECT COALESCE(SUM(grand_total), 0) total FROM purchases WHERE is_deleted = 0 AND bill_date = date('now', 'localtime')")
      .get().total,
    monthlyPurchases: db
      .prepare("SELECT COALESCE(SUM(grand_total), 0) total FROM purchases WHERE is_deleted = 0 AND strftime('%Y-%m', bill_date) = strftime('%Y-%m', 'now', 'localtime')")
      .get().total,
    yearlyPurchases: db
      .prepare("SELECT COALESCE(SUM(grand_total), 0) total FROM purchases WHERE is_deleted = 0 AND strftime('%Y', bill_date) = strftime('%Y', 'now', 'localtime')")
      .get().total,
    outstandingBillsAmount: db
      .prepare("SELECT COALESCE(SUM(balance_due), 0) total FROM purchases WHERE is_deleted = 0 AND balance_due > 0")
      .get().total,
  };
}

function createPurchase(payload) {
  const db = getDb();
  const clean = normalizePurchase(payload);

  // Task 2 & 5: Log payload and query parameters
  console.log("[DEBUG] Table: purchases | Action: INSERT"); // KEEP AS IS
  console.log("[DEBUG] SQL: INSERT INTO purchases (contact_id, bill_no, ...) VALUES (@contact_id, @bill_no, ...)"); // MUST CHANGE
  console.log("[DEBUG] Parameters:", { contact_id: clean.contact_id, bill_no: clean.bill_no, vendor: clean.vendor }); // MUST CHANGE

  return db.transaction(() => {
    const info = db
      .prepare(
        `
        INSERT INTO purchases (
          bill_date, due_date, vendor, contact_id, bill_no, vendor_bill_no, is_gst_enabled,
          service_name, amount, gst_rate, gst_amount, subtotal, cgst_total, // This is fine
          sgst_total, igst_total, tax_total, grand_total, paid_amount,
          balance_due, status, notes
        )
        VALUES (
          @bill_date, @due_date, @vendor, @contact_id, @bill_no, @vendor_bill_no, @is_gst_enabled,
          @service_name, @amount, @gst_rate, @gst_amount, @subtotal, @cgst_total,
          @sgst_total, @igst_total, @tax_total, @grand_total, @paid_amount, // This is fine
          @balance_due, @status, @notes
        )
      `,
      )
      .run(clean);

    insertItems(db, info.lastInsertRowid, clean.items);
    if (clean.paid_amount > 0) {
      recordPurchasePayment({
        purchase_id: Number(info.lastInsertRowid),
        contact_id: Number(clean.contact_id), // Fix: Pass resolved numeric ID
        payment_date: clean.bill_date,
        amount: clean.paid_amount,
        mode: clean.payment_mode, // Use the normalized payment_mode
        bank_account_id: clean.bank_account_id,
        reference_no: clean.vendor_bill_no || clean.bill_no,
        notes: "Opening payment recorded with purchase",
      });
    }

    activity.log("purchase:created", {
      entityType: "purchase",
      entityId: info.lastInsertRowid,
      message: clean.bill_no,
      newData: getPurchase(info.lastInsertRowid),
    });
    return getPurchase(info.lastInsertRowid);
  })();
}

function updatePurchase(payload) {
  const db = getDb();
  const routeId = Number(payload.id);
  console.log(`[TRACE] Service received ID: ${routeId}`);

  const oldData = getPurchase(routeId);
  if (!oldData) throw new Error("Purchase not found");
  console.log(`[TRACE] Database lookup successful for ID: ${oldData.id}`);

  const clean = normalizePurchase(payload, oldData);
  console.log(`[TRACE] Final Database Query ID: ${routeId}`);

  return db.transaction(() => {
    const paid = db
      .prepare("SELECT COALESCE(SUM(amount), 0) total FROM outgoing_payments WHERE purchase_id = ? AND COALESCE(is_deleted, 0) = 0")
      .get(routeId).total;
    
    clean.paid_amount = round(paid || 0);
    clean.balance_due = Math.max(0, round(clean.grand_total - clean.paid_amount));
    clean.status = statusForPurchase(clean, clean.paid_amount);

    db.prepare(
      `
      UPDATE purchases
      SET bill_date = @bill_date,
          due_date = @due_date,
          vendor = @vendor,
          contact_id = @contact_id,
          bill_no = @bill_no,
          vendor_bill_no = @vendor_bill_no,
          is_gst_enabled = @is_gst_enabled,
          service_name = @service_name,
          amount = @amount,
          gst_rate = @gst_rate,
          gst_amount = @gst_amount,
          subtotal = @subtotal,
          cgst_total = @cgst_total,
          sgst_total = @sgst_total,
          igst_total = @igst_total,
          tax_total = @tax_total,
          grand_total = @grand_total,
          paid_amount = @paid_amount,
          balance_due = @balance_due,
          status = @status,
          notes = @notes
      WHERE id = @id
    `).run({ ...clean, id: routeId });

    console.log(`[TRACE] Update Query executed for ID: ${routeId}`);

    insertItems(db, routeId, clean.items);
    const newData = getPurchase(routeId);
    activity.log("purchase:updated", {
      entityType: "purchase",
      entityId: routeId,
      message: clean.bill_no,
      oldData,
      newData,
    });
    return newData;
  })();
}

function recordPurchasePayment(payload) {
  const db = getDb();
  return db.transaction(() => {
    const purchaseId = payload.purchase_id ? Number(payload.purchase_id) : null;
    const purchase = purchaseId
      ? db.prepare("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0").get(purchaseId)
      : null;

    if (purchaseId && !purchase) throw new Error("Purchase not found");
    
    accounting.checkNarrationRequirement(db, payload.notes);

    const amount = round(payload.amount || 0);
    if (amount <= 0) throw new Error("Payment amount must be greater than zero");

    // Recalculate true remaining limit from payment records to avoid header sync race conditions
    const existingSum = Number(db.prepare("SELECT SUM(amount) as s FROM outgoing_payments WHERE purchase_id = ? AND COALESCE(is_deleted, 0) = 0").get(purchaseId).s || 0);
    const remainingLimit = Math.max(0, round(purchase.grand_total - existingSum));

    console.log({
      subtotal: purchase.subtotal,
      gst: purchase.tax_total,
      grandTotal: purchase.grand_total,
      initialPayment: amount,
      paidAmount: purchase.paid_amount,
      balanceDue: purchase.balance_due,
      status: purchase.status
    });

    if (purchase && amount > remainingLimit) {
      throw new Error(`Payment amount cannot exceed outstanding balance (${money(remainingLimit)})`);
    }

    // Task 4: Verify bank_account_id is not invalid
    const rawBankId = parseInt(payload.bank_account_id || "", 10);
    const bankAccountId = !isNaN(rawBankId) && rawBankId > 0 ? rawBankId : null;

    if (["bank_transfer", "upi", "card", "cheque"].includes(payload.mode || "bank_transfer") && !bankAccountId) {
      throw new Error("Bank account is required for this payment mode");
    }

    const paymentDate = payload.payment_date || today();
    const paymentNo =
      payload.payment_no || numbering.nextPurchasePaymentNo(new Date(paymentDate));
    const info = db
      .prepare(
        `
        INSERT INTO outgoing_payments ( // This is fine
          purchase_id, contact_id, payment_no, payment_date, amount,
          mode, reference_no, notes, bank_account_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        purchaseId,
        payload.contact_id || purchase?.contact_id || null, // This comment is fine, it's a note
        paymentNo,
        paymentDate,
        amount,
        payload.mode || 'bank_transfer',
        payload.reference_no || '',
        payload.notes || '',
        bankAccountId
      );

    let bankTx = null;
    if (bankAccountId) {
      bankTx = accounting.createBankTransaction(db, {
        bank_account_id: bankAccountId,
        transaction_date: paymentDate,
        type: "debit",
        source_type: "purchase_payment",
        source_id: info.lastInsertRowid,
        amount,
        reference_no: payload.reference_no || paymentNo,
        notes: payload.notes || (purchase ? `Payment for ${purchase.bill_no}` : "Purchase Payment"),
      });
      db.prepare("UPDATE outgoing_payments SET bank_transaction_id = ? WHERE id = ?").run(
        bankTx.id,
        info.lastInsertRowid,
      );
    }

    if (purchase) {
      const totals = db
        .prepare("SELECT COALESCE(SUM(amount), 0) total_paid FROM outgoing_payments WHERE purchase_id = ? AND COALESCE(is_deleted, 0) = 0")
        .get(purchase.id);
      const paidAmount = round(totals.total_paid);
      const balanceDue = Math.max(0, round(Number(purchase.grand_total || 0) - paidAmount));
      const status = statusForPurchase({ ...purchase, balance_due: balanceDue, grand_total: purchase.grand_total }, paidAmount);

      db.prepare(
        "UPDATE purchases SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?",
      ).run(paidAmount, balanceDue, status, purchase.id);
    }

    accounting.createLedgerEntry(db, {
      entry_date: paymentDate,
      account: "Purchase Payment",
      source_type: "purchase_payment",
      source_id: info.lastInsertRowid,
      reference_no: paymentNo,
      debit: amount,
      notes: payload.notes || (purchase ? `Payment for ${purchase.bill_no}` : "Purchase Payment"),
    });

    if (purchase) {
      activity.log("purchase:payment_recorded", {
        entityType: "purchase",
        entityId: purchase.id,
        message: paymentNo,
        oldData: purchase,
        newData: getPurchase(purchase.id),
      });
    }

    return db.prepare("SELECT * FROM outgoing_payments WHERE id = ?").get(info.lastInsertRowid);
  })();
}

function deletePurchase(id) {
  const db = getDb();
  return db.transaction(() => {
    const purchase = getPurchase(id);
    if (!purchase) throw new Error("Purchase not found");
    if (Number(purchase.paid_amount || 0) > 0) {
      throw new Error("Purchase with payments cannot be deleted");
    }
    db.prepare("UPDATE purchases SET is_deleted = 1 WHERE id = ?").run(id);
    activity.log("purchase:deleted", {
      entityType: "purchase",
      entityId: Number(id),
      message: purchase.bill_no,
      oldData: purchase,
    });
    return true;
  })();
}

module.exports = {
  createPurchase,
  deletePurchase,
  getPurchase,
  listPurchases,
  purchaseDashboard,
  recordPurchasePayment,
  statusForPurchase,
  updatePurchase,
};
