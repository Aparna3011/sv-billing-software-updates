const { formatISO } = require("date-fns");
const { getDb } = require("../db/database");
const activity = require("./activitylog.service");
const { round } = require("./gst.service");

function today() {
  return formatISO(new Date(), { representation: "date" });
}

function checkNarrationRequirement(db, notes) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("banking_preferences");
  if (!row) return;
  try {
    const prefs = JSON.parse(row.value);
    if (prefs.require_narration && !String(notes || "").trim()) {
      throw new Error("Narration is required.");
    }
  } catch (e) {
    // If preferences are not set or invalid, we don't block
    console.error("Narration check error:", e);
  }
}

function recalculateBalances(db, bankAccountId) {
  const account = db
    .prepare("SELECT opening_balance FROM bank_accounts WHERE id = ?")
    .get(bankAccountId);
  if (!account) return 0;

  const txs = db
    .prepare(
      `
    SELECT id, type, amount 
    FROM bank_transactions 
    WHERE bank_account_id = ? AND COALESCE(is_deleted, 0) = 0 
    ORDER BY transaction_date ASC, id ASC
  `,
    )
    .all(bankAccountId);

  let running = round(account.opening_balance || 0);
  const updateStmt = db.prepare(
    "UPDATE bank_transactions SET balance_after = ? WHERE id = ?",
  );

  for (const t of txs) {
    running = round(running + (t.type === "credit" ? t.amount : -t.amount));
    updateStmt.run(running, t.id);
  }

  db.prepare("UPDATE bank_accounts SET current_balance = ? WHERE id = ?").run(
    running,
    bankAccountId,
  );
  return running;
}

function rebuildAllBankBalances() {
  const db = getDb();
  return db.transaction(() => {
    const accounts = db
      .prepare("SELECT id, account_name FROM bank_accounts WHERE is_active = 1")
      .all();
    const summary = [];
    for (const acc of accounts) {
      const finalBalance = recalculateBalances(db, acc.id);
      console.log(
        `[Maintenance] Account ${acc.id} (${acc.account_name}) rebuilt. Final balance: ${finalBalance}`,
      );
      summary.push({
        id: acc.id,
        name: acc.account_name,
        balance: finalBalance,
      });
    }
    return summary;
  })();
}

/**
 * Internal helper to synchronize source document totals (Invoice, Purchase, Expense, Recurring)
 * based on the current active payments in the database.
 */
function syncSourceDocumentState(db, docType, docId, recurringId) {
  if (docType === "invoice" && docId) {
    const totalPaid =
      db
        .prepare(
          `
      SELECT ROUND(SUM(ip.amount), 2) as s FROM incoming_payments ip 
      LEFT JOIN bank_transactions bt ON ip.bank_transaction_id = bt.id 
      WHERE ip.invoice_id = ?
        AND COALESCE(ip.is_deleted, 0) = 0
        AND (ip.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
    `,
        )
        .get(docId).s || 0;
    const inv = db
      .prepare("SELECT grand_total FROM invoices WHERE id = ?")
      .get(docId);
    const balanceDue = round(inv.grand_total - totalPaid);
    const status =
      balanceDue <= 0 ? "paid" : totalPaid > 0 ? "partially_paid" : "pending";
    db.prepare(
      "UPDATE invoices SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?",
    ).run(totalPaid, balanceDue, status, docId);
  }

  if (docType === "purchase" && docId) {
    const totalPaid =
      db
        .prepare(
          `
      SELECT ROUND(SUM(op.amount), 2) as s FROM outgoing_payments op 
      LEFT JOIN bank_transactions bt ON op.bank_transaction_id = bt.id 
      WHERE op.purchase_id = ?
        AND COALESCE(op.is_deleted, 0) = 0
        AND (op.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
    `,
        )
        .get(docId).s || 0;
    const pur = db
      .prepare("SELECT grand_total FROM purchases WHERE id = ?")
      .get(docId);
    const balanceDue = round(pur.grand_total - totalPaid);
    const status = balanceDue <= 0 ? "paid" : totalPaid > 0 ? "partially_paid" : "unpaid";

    db.prepare(
      "UPDATE purchases SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?",
    ).run(totalPaid, balanceDue, status, docId);
  }

  if (docType === "expense" && docId) {
    const exp = db
      .prepare("SELECT total_amount FROM expenses WHERE id = ?")
      .get(docId);
    const totalPaid =
      db
        .prepare(
          `
      SELECT ROUND(SUM(op.amount), 2) as s FROM outgoing_payments op 
      LEFT JOIN bank_transactions bt ON op.bank_transaction_id = bt.id 
      WHERE op.expense_id = ?
        AND COALESCE(op.is_deleted, 0) = 0
        AND (op.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
    `,
        )
        .get(docId).s || 0;
    const balanceDue = Math.max(
      0,
      round(Number(exp.total_amount || 0) - totalPaid),
    );
    const status = balanceDue <= 0 ? "paid" : totalPaid > 0 ? "partially_paid" : "unpaid";

    db.prepare(
      "UPDATE expenses SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?",
    ).run(totalPaid, balanceDue, status, docId);
  }

  if (recurringId) {
    // For recurring, we rely on the specific payment sync logic
    // provided in updateBankTransaction but improved to handle sums.
    return;
  }
}

function ensureLedgerTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      account TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER,
      reference_no TEXT,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function createBankTransaction(db, payload = {}) {
  if (!payload.bank_account_id) return null;

  const amount = round(payload.amount || 0);
  if (amount <= 0)
    throw new Error("Bank transaction amount must be greater than zero");

  const account = db
    .prepare("SELECT * FROM bank_accounts WHERE id = ? AND is_active = 1")
    .get(Number(payload.bank_account_id));
  if (!account) throw new Error("Bank account not found");

  const type = payload.type === "credit" ? "credit" : "debit";
  const signedAmount = type === "credit" ? amount : -amount;
  const nextBalance = round(
    Number(account.current_balance || 0) + signedAmount,
  );

  const info = db
    .prepare(
      `
      INSERT INTO bank_transactions (
        bank_account_id, transaction_date, type, source_type, source_id,
        amount, reference_no, notes, balance_after, created_at, updated_at
      )
      VALUES (
        @bank_account_id, @transaction_date, @type, @source_type, @source_id,
        @amount, @reference_no, @notes, @balance_after, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `,
    )
    .run({
      bank_account_id: Number(payload.bank_account_id),
      transaction_date: payload.transaction_date || today(),
      type,
      source_type: payload.source_type || "manual_adjustment",
      source_id: payload.source_id || null,
      amount,
      reference_no: payload.reference_no || "",
      notes: payload.notes || "",
      balance_after: nextBalance,
    });

  db.prepare("UPDATE bank_accounts SET current_balance = ? WHERE id = ?").run(
    nextBalance,
    account.id,
  );

  return {
    id: info.lastInsertRowid,
    balance_after: nextBalance,
  };
}

function getBankTransaction(id) {
  return getDb()
    .prepare("SELECT * FROM bank_transactions WHERE id = ?")
    .get(id);
}

function updateBankTransaction(id, payload) {
  const db = getDb();
  return db.transaction(() => {
    // 1. Load context and identify linked source documents
    const old = db
      .prepare(
        `
      SELECT bt.*, 
             ip.id as incoming_payment_id, ip.invoice_id, ip.recurring_invoice_id,
             op.id as outgoing_payment_id, op.purchase_id, op.expense_id
      FROM bank_transactions bt
      LEFT JOIN incoming_payments ip ON ip.bank_transaction_id = bt.id
      LEFT JOIN outgoing_payments op ON op.bank_transaction_id = bt.id
      WHERE bt.id = ?
    `,
      )
      .get(id);

    if (!old) throw new Error("Banking transaction not found");

    const amount = round(payload.amount ?? old.amount);
    const transactionDate = payload.transaction_date || old.transaction_date;
    const mode = payload.mode || "bank_transfer";
    const notes = payload.notes ?? old.notes;
    const referenceNo = payload.reference_no ?? old.reference_no;
    const bankAccountId = Number(
      payload.bank_account_id || old.bank_account_id,
    );

    // 2. Reverse old balance impact on Bank Account
    const oldImpact = old.type === "credit" ? -old.amount : old.amount;
    db.prepare(
      "UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?",
    ).run(oldImpact, old.bank_account_id);

    const type = payload.type || old.type;
    const newImpact = type === "credit" ? amount : -amount;

    // Requirement: Identify sibling for Transfers to ensure both sides update
    let sibling = null;
    if (old.source_type === "transfer") {
      sibling = db
        .prepare(
          `
        SELECT * FROM bank_transactions 
        WHERE source_type = 'transfer' AND reference_no = ? AND amount = ? AND transaction_date = ? AND type != ? AND id != ? AND COALESCE(is_deleted, 0) = 0
      `,
        )
        .get(old.reference_no, old.amount, old.transaction_date, old.type, id);
    }

    // 3. Apply new balance impact on Bank Account
    db.prepare(
      "UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?",
    ).run(newImpact, bankAccountId);

    // 4. Deep Sync: Update Source Tables
    if (old.incoming_payment_id) {
      // Update Incoming Payment record
      db.prepare(
        `
        UPDATE incoming_payments SET 
          payment_date = ?, amount = ?, mode = ?, reference_no = ?, notes = ?, category_id = ?
        WHERE id = ?
      `,
      ).run(
        transactionDate,
        amount,
        mode,
        referenceNo,
        notes,
        payload.category_id || null,
        old.incoming_payment_id,
      );

      if (old.invoice_id)
        syncSourceDocumentState(db, "invoice", old.invoice_id);

      // Recalculate Recurring History
      if (old.recurring_invoice_id) {
        db.prepare(
          `UPDATE recurring_invoice_history SET payment_date = ?, amount = ? WHERE payment_id = ?`,
        ).run(transactionDate, amount, old.incoming_payment_id);

        // Recalculate cycle totals (paid/pending) and status in history
        const hist = db
          .prepare(
            "SELECT invoice_start_date FROM recurring_invoice_history WHERE payment_id = ?",
          )
          .get(old.incoming_payment_id);
        if (hist) {
          const cycleStart = hist.invoice_start_date;
          const plan = db
            .prepare("SELECT grand_total FROM recurring_invoices WHERE id = ?")
            .get(old.recurring_invoice_id);
          const totalPaid =
            db
              .prepare(
                `
            SELECT ROUND(SUM(amount), 2) as s FROM recurring_invoice_history 
            WHERE recurring_invoice_id = ? AND invoice_start_date = ? AND payment_id IS NOT NULL
          `,
              )
              .get(old.recurring_invoice_id, cycleStart).s || 0;

          const pending = Math.max(0, round(plan.grand_total - totalPaid));
          const status =
            pending <= 0
              ? "completed"
              : totalPaid > 0
                ? "partially_paid"
                : "pending";

          db.prepare(
            `
            UPDATE recurring_invoice_history 
            SET paid_amount = ?, pending_amount = ?, collection_status = ? 
            WHERE recurring_invoice_id = ? AND invoice_start_date = ?
          `,
          ).run(
            totalPaid,
            pending,
            status,
            old.recurring_invoice_id,
            cycleStart,
          );
        }
      }
    } else if (old.outgoing_payment_id) {
      // Update Outgoing Payment record
      db.prepare(
        `
        UPDATE outgoing_payments SET 
          payment_date = ?, amount = ?, mode = ?, reference_no = ?, notes = ?, category_id = ?
        WHERE id = ?
      `,
      ).run(
        transactionDate,
        amount,
        mode,
        referenceNo,
        notes,
        payload.category_id || null,
        old.outgoing_payment_id,
      );

      if (old.purchase_id)
        syncSourceDocumentState(db, "purchase", old.purchase_id);
      if (old.expense_id)
        syncSourceDocumentState(db, "expense", old.expense_id);
    }

    // 5. Handle Sibling Sync for Transfers (Contra)
    let finalNotes = notes;
    if (sibling) {
      // Reverse sibling old impact
      const sibOldImpact =
        sibling.type === "credit" ? -sibling.amount : sibling.amount;
      db.prepare(
        "UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?",
      ).run(sibOldImpact, sibling.bank_account_id);

      // Apply new impact to sibling (potentially new destination account)
      const sibBankId = Number(
        payload.to_account_id || sibling.bank_account_id,
      );
      const sibType = type === "credit" ? "debit" : "credit";
      const sibNewImpact = sibType === "credit" ? amount : -amount;
      db.prepare(
        "UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?",
      ).run(sibNewImpact, sibBankId);

      // Regenerate descriptive notes based on current account names
      const fromAcc = db
        .prepare("SELECT account_name FROM bank_accounts WHERE id = ?")
        .get(bankAccountId);
      const toAcc = db
        .prepare("SELECT account_name FROM bank_accounts WHERE id = ?")
        .get(sibBankId);
      const narration = (notes || "").split("|").pop().trim();

      finalNotes = `Transfer to ${toAcc?.account_name}. ${narration}`;
      const sibNotes = `Transfer from ${fromAcc?.account_name}. ${narration}`;

      db.prepare(
        `
        UPDATE bank_transactions SET 
          transaction_date = ?, bank_account_id = ?, type = ?, 
          amount = ?, reference_no = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(
        transactionDate,
        sibBankId,
        sibType,
        amount,
        referenceNo,
        sibNotes,
        sibling.id,
      );
    }

    // 6. Finally sync the primary Bank Transaction record
    db.prepare(
      `
      UPDATE bank_transactions SET 
        transaction_date = ?, bank_account_id = ?, type = ?, 
        amount = ?, reference_no = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    ).run(
      transactionDate,
      bankAccountId,
      type,
      amount,
      referenceNo,
      finalNotes,
      id,
    );

    recalculateBalances(db, bankAccountId);
    if (old.bank_account_id !== bankAccountId) {
      recalculateBalances(db, old.bank_account_id);
    }
    if (sibling) {
      const sibBankId = Number(
        payload.to_account_id || sibling.bank_account_id,
      );
      recalculateBalances(db, sibBankId);
      if (sibling.bank_account_id !== sibBankId)
        recalculateBalances(db, sibling.bank_account_id);
    }

    return true;
  })();
}

function softDeleteBankTransaction(id) {
  const db = getDb();
  return db.transaction(() => {
    const tx = db
      .prepare(
        `
      SELECT bt.*, ip.invoice_id, ip.recurring_invoice_id, op.purchase_id, op.expense_id 
      FROM bank_transactions bt
      LEFT JOIN incoming_payments ip ON ip.bank_transaction_id = bt.id
      LEFT JOIN outgoing_payments op ON op.bank_transaction_id = bt.id
      WHERE bt.id = ? AND COALESCE(bt.is_deleted, 0) = 0
    `,
      )
      .get(id);
    if (!tx) return;

    const transactions = [tx];

    // Requirement: For Contra (transfers), identify and delete the sibling record
    if (tx.source_type === "transfer") {
      const sibling = db
        .prepare(
          `
        SELECT * FROM bank_transactions 
        WHERE source_type = 'transfer' AND reference_no = ? AND amount = ? AND transaction_date = ? AND type != ? AND id != ? AND COALESCE(is_deleted, 0) = 0
      `,
        )
        .get(tx.reference_no, tx.amount, tx.transaction_date, tx.type, id);
      if (sibling) transactions.push(sibling);
    }

    for (const t of transactions) {
      // Reverse balance impact because the transaction is no longer "active"
      const impact = t.type === "credit" ? -t.amount : t.amount;
      db.prepare(
        "UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?",
      ).run(impact, t.bank_account_id);
      db.prepare(
        "UPDATE bank_transactions SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(t.id);
      recalculateBalances(db, t.bank_account_id);
    }

    db.prepare(
      "UPDATE incoming_payments SET is_deleted = 1 WHERE bank_transaction_id = ?",
    ).run(id);
    db.prepare(
      "UPDATE outgoing_payments SET is_deleted = 1 WHERE bank_transaction_id = ?",
    ).run(id);

    // Deep Sync: Propagate deletion to source documents
    if (tx.invoice_id) {
      db.prepare(
        "UPDATE incoming_payments SET is_deleted = 1 WHERE bank_transaction_id = ?",
      ).run(id);
      syncSourceDocumentState(db, "invoice", tx.invoice_id);
    }
    if (tx.purchase_id) {
      db.prepare(
        "UPDATE outgoing_payments SET is_deleted = 1 WHERE bank_transaction_id = ?",
      ).run(id);
      syncSourceDocumentState(db, "purchase", tx.purchase_id);
    }
    if (tx.expense_id) {
      db.prepare(
        "UPDATE outgoing_payments SET is_deleted = 1 WHERE bank_transaction_id = ?",
      ).run(id);
      syncSourceDocumentState(db, "expense", tx.expense_id);
    }
    if (tx.recurring_invoice_id) {
      const ip = db.prepare("SELECT id FROM incoming_payments WHERE bank_transaction_id = ?").get(id);
      if (ip) {
        const hist = db.prepare("SELECT invoice_start_date, next_invoice_date, due_date FROM recurring_invoice_history WHERE payment_id = ? AND action_type = 'payment_received'").get(ip.id);
        const recurring = require("./recurring.service");
        db.prepare("UPDATE incoming_payments SET is_deleted = 1 WHERE id = ?").run(ip.id);
        
        recurring.syncRecurringLifecycle(db, tx.recurring_invoice_id, {
          action_type: 'payment_voided',
          amount: tx.amount,
          payment_id: ip.id,
          invoice_start_date: hist?.invoice_start_date,
          next_invoice_date: hist?.next_invoice_date,
          due_date: hist?.due_date,
          notes: `Bank transaction deleted: ${tx.reference_no || id}`
        });
      }
    }
  })();
}

function restoreBankTransaction(id) {
  const db = getDb();
  return db.transaction(() => {
    const tx = db
      .prepare(
        `
      SELECT bt.*, ip.invoice_id, ip.recurring_invoice_id, op.purchase_id, op.expense_id 
      FROM bank_transactions bt
      LEFT JOIN incoming_payments ip ON ip.bank_transaction_id = bt.id
      LEFT JOIN outgoing_payments op ON op.bank_transaction_id = bt.id
      WHERE bt.id = ? AND COALESCE(bt.is_deleted, 0) = 1
    `,
      )
      .get(id);
    if (!tx) return;

    const transactions = [tx];

    // Requirement: For Contra (transfers), identify and restore the sibling record
    if (tx.source_type === "transfer") {
      const sibling = db
        .prepare(
          `
        SELECT * FROM bank_transactions 
        WHERE source_type = 'transfer' AND reference_no = ? AND amount = ? AND transaction_date = ? AND type != ? AND id != ? AND COALESCE(is_deleted, 0) = 1
      `,
        )
        .get(tx.reference_no, tx.amount, tx.transaction_date, tx.type, id);
      if (sibling) transactions.push(sibling);
    }

    for (const t of transactions) {
      // Re-apply balance impact
      const impact = t.type === "credit" ? t.amount : -t.amount;
      db.prepare(
        "UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?",
      ).run(impact, t.bank_account_id);
      db.prepare(
        "UPDATE bank_transactions SET is_deleted = 0, deleted_at = NULL WHERE id = ?",
      ).run(t.id);
      recalculateBalances(db, t.bank_account_id);
    }

    db.prepare(
      "UPDATE incoming_payments SET is_deleted = 0 WHERE bank_transaction_id = ?",
    ).run(id);
    db.prepare(
      "UPDATE outgoing_payments SET is_deleted = 0 WHERE bank_transaction_id = ?",
    ).run(id);

    // Deep Sync: Re-apply impacts to source documents
    if (tx.invoice_id) {
      db.prepare(
        "UPDATE incoming_payments SET is_deleted = 0 WHERE bank_transaction_id = ?",
      ).run(id);
      syncSourceDocumentState(db, "invoice", tx.invoice_id);
    }
    if (tx.purchase_id) {
      db.prepare(
        "UPDATE outgoing_payments SET is_deleted = 0 WHERE bank_transaction_id = ?",
      ).run(id);
      syncSourceDocumentState(db, "purchase", tx.purchase_id);
    }
    if (tx.expense_id) {
      db.prepare(
        "UPDATE outgoing_payments SET is_deleted = 0 WHERE bank_transaction_id = ?",
      ).run(id);
      syncSourceDocumentState(db, "expense", tx.expense_id);
    }

    if (tx.recurring_invoice_id) {
      const ip = db.prepare("SELECT id FROM incoming_payments WHERE bank_transaction_id = ?").get(id);
      if (ip) {
        const hist = db.prepare("SELECT invoice_start_date, next_invoice_date, due_date FROM recurring_invoice_history WHERE payment_id = ? AND action_type = 'payment_received'").get(ip.id);
        const recurring = require("./recurring.service");
        db.prepare("UPDATE incoming_payments SET is_deleted = 0 WHERE id = ?").run(ip.id);
        
        recurring.syncRecurringLifecycle(db, tx.recurring_invoice_id, {
          action_type: 'payment_received',
          amount: tx.amount,
          payment_id: ip.id,
          invoice_start_date: hist?.invoice_start_date,
          next_invoice_date: hist?.next_invoice_date,
          due_date: hist?.due_date,
          notes: `Bank transaction restored: ${tx.reference_no || id}`
        });
      }
    }
  })();
}

function reverseBankTransaction(db, transactionId) {
  if (!transactionId) return;
  const tx = db
    .prepare("SELECT * FROM bank_transactions WHERE id = ?")
    .get(transactionId);
  if (!tx || tx.is_deleted) return;

  // Deactivate original transaction to keep "Active" view clean
  db.prepare(
    "UPDATE bank_transactions SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(transactionId);

  const info = createBankTransaction(db, {
    bank_account_id: tx.bank_account_id,
    transaction_date: today(),
    type: tx.type === "credit" ? "debit" : "credit",
    source_type: "reversal",
    source_id: tx.id,
    amount: tx.amount,
    reference_no: `RV-${tx.id.toString().padStart(4, "0")}`,
    notes: `Reversal for Voucher: ${tx.reference_no} | ${tx.notes}`,
  });

  // Mark reversal itself as archived so it doesn't clutter active transactions
  db.prepare("UPDATE bank_transactions SET is_deleted = 1 WHERE id = ?").run(
    info.id,
  );
}

function createLedgerEntry(db, payload = {}) {
  ensureLedgerTable(db);
  const debit = round(payload.debit || 0);
  const credit = round(payload.credit || 0);
  if (debit <= 0 && credit <= 0) return null;

  const info = db
    .prepare(
      `
      INSERT INTO ledger_entries (
        entry_date, account, source_type, source_id, reference_no,
        debit, credit, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      payload.entry_date || today(),
      payload.account,
      payload.source_type,
      payload.source_id || null,
      payload.reference_no || "",
      debit,
      credit,
      payload.notes || "",
    );
  return info.lastInsertRowid;
}

function getBankAccount(id) {
  return getDb().prepare("SELECT * FROM bank_accounts WHERE id = ?").get(id);
}

function bankAccounts() {
  return getDb()
    .prepare(
      `
      SELECT *
      FROM bank_accounts
      WHERE is_active = 1
      ORDER BY account_name
    `,
    )
    .all();
}

function ensureDefaultCashAccount() {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id FROM bank_accounts WHERE LOWER(account_name) = 'cash' OR account_type = 'Cash' LIMIT 1",
    )
    .get();

  if (!existing) {
    db.prepare(
      `
      INSERT INTO bank_accounts (
        account_name, bank_name, account_no, account_type, branch_name,
        opening_balance, current_balance, is_default
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run("Cash", "Cash in Hand", "CASH-001", "Cash", "Main Branch", 0, 0, 1);
  }
  return true;
}

function incomeCategories() {
  return getDb()
    .prepare(
      "SELECT * FROM income_categories WHERE is_active = 1 ORDER BY name",
    )
    .all();
}

function createIncomeCategory(payload) {
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO income_categories (name, description, is_active) VALUES (?, ?, ?)",
    )
    .run(payload.name, payload.description || "", payload.is_active ? 1 : 0);
  return db
    .prepare("SELECT * FROM income_categories WHERE id = ?")
    .get(info.lastInsertRowid);
}

function updateIncomeCategory(id, payload) {
  getDb()
    .prepare(
      "UPDATE income_categories SET name = ?, description = ?, is_active = ? WHERE id = ?",
    )
    .run(
      payload.name,
      payload.description || "",
      payload.is_active ? 1 : 0,
      id,
    );
  return true;
}

function deleteIncomeCategory(id) {
  const db = getDb();
  const cat = db
    .prepare("SELECT is_system FROM income_categories WHERE id = ?")
    .get(id);
  if (cat?.is_system) throw new Error("Cannot delete system categories");
  return db.prepare("DELETE FROM income_categories WHERE id = ?").run(id);
}

function ensureDefaultExpenseCategories() {
  const db = getDb();
  const defaults = [
    {
      name: "Hosting",
      description: "Server, hosting, and cloud infrastructure expenses",
    },
    {
      name: "Software",
      description: "Software subscriptions and digital tools",
    },
    { name: "Internet", description: "Internet and connectivity expenses" },
    { name: "Office", description: "Office and administration expenses" },
    { name: "Travel", description: "Travel and conveyance expenses" },
    {
      name: "Professional Fees",
      description: "Consultant, legal, and professional charges",
    },
    { name: "Miscellaneous", description: "Other operating expenses" },
  ];

  db.transaction(() => {
    // 1. Insert missing defaults
    const insert = db.prepare(`
      INSERT INTO expense_categories (name, description, is_system, is_active)
      SELECT ?, ?, 1, 1
      WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE LOWER(name) = LOWER(?))
    `);

    // 2. Ensure existing defaults are marked as system
    const update = db.prepare(`
      UPDATE expense_categories SET is_system = 1 
      WHERE LOWER(name) = LOWER(?)
    `);

    for (const d of defaults) {
      insert.run(d.name, d.description, d.name);
      update.run(d.name);
    }
  })();
  return true;
}

function expenseCategories() {
  return getDb()
    .prepare(
      "SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name",
    )
    .all();
}

function createExpenseCategory(payload) {
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO expense_categories (name, description, is_active) VALUES (?, ?, ?)",
    )
    .run(payload.name, payload.description || "", payload.is_active ? 1 : 0);
  return db
    .prepare("SELECT * FROM expense_categories WHERE id = ?")
    .get(info.lastInsertRowid);
}

function updateExpenseCategory(id, payload) {
  getDb()
    .prepare(
      "UPDATE expense_categories SET name = ?, description = ?, is_active = ? WHERE id = ?",
    )
    .run(
      payload.name,
      payload.description || "",
      payload.is_active ? 1 : 0,
      id,
    );
  return true;
}

function deleteExpenseCategory(id) {
  const db = getDb();
  const cat = db
    .prepare("SELECT is_system FROM expense_categories WHERE id = ?")
    .get(id);
  if (cat?.is_system) throw new Error("Cannot delete system categories");
  return db.prepare("DELETE FROM expense_categories WHERE id = ?").run(id);
}

function createBankAccount(payload) {
  const db = getDb();
  const opening = round(payload.opening_balance || 0);
  const info = db
    .prepare(
      `
      INSERT INTO bank_accounts (
        account_name, bank_name, account_no, ifsc, branch_name,
        account_type, opening_balance, current_balance
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      String(payload.account_name || "").trim(),
      payload.bank_name || "",
      payload.account_no || "",
      payload.ifsc || "",
      payload.branch_name || "",
      payload.account_type || "Current",
      opening,
      payload.current_balance === undefined
        ? opening
        : round(payload.current_balance || 0),
    );
  return db
    .prepare("SELECT * FROM bank_accounts WHERE id = ?")
    .get(info.lastInsertRowid);
}

function updateBankAccount(id, payload) {
  const db = getDb();
  const opening = round(payload.opening_balance || 0);
  db.prepare(
    `
    UPDATE bank_accounts 
    SET account_name = ?, bank_name = ?, account_no = ?, ifsc = ?, branch_name = ?,
        account_type = ?, opening_balance = ?, is_active = ?
    WHERE id = ?
  `,
  ).run(
    String(payload.account_name || "").trim(),
    payload.bank_name || "",
    payload.account_no || "",
    payload.ifsc || "",
    payload.branch_name || "",
    payload.account_type || "Current",
    opening,
    payload.is_active === undefined ? 1 : Number(payload.is_active),
    id,
  );

  activity.log("bank_account:updated", {
    entityType: "bank_account",
    entityId: id,
    message: payload.account_name,
  });
  return getBankAccount(id);
}

function deleteBankAccount(id) {
  return getDb()
    .prepare("UPDATE bank_accounts SET is_active = 0 WHERE id = ?")
    .run(id);
}

function manualAdjustment(payload) {
  const db = getDb();
  return db.transaction(() => {
    checkNarrationRequirement(db, payload.notes);

    const tx = createBankTransaction(db, {
      bank_account_id: payload.bank_account_id,
      transaction_date: payload.transaction_date,
      type: payload.type,
      source_type: "manual_adjustment",
      amount: payload.amount,
      reference_no: payload.reference_no,
      notes: payload.notes,
    });
    createLedgerEntry(db, {
      entry_date: payload.transaction_date,
      account: "Bank",
      source_type: "manual_adjustment",
      source_id: tx.id,
      reference_no: payload.reference_no,
      debit: payload.type === "debit" ? payload.amount : 0,
      credit: payload.type === "credit" ? payload.amount : 0,
      notes: payload.notes,
    });
    activity.log("bank:manual_adjustment", {
      entityType: "bank_transaction",
      entityId: tx.id,
      message: payload.reference_no || String(payload.amount || ""),
    });
    return db
      .prepare("SELECT * FROM bank_transactions WHERE id = ?")
      .get(tx.id);
  })();
}

function bankLedger(filters = null) {
  const db = getDb();
  const clean =
    filters && typeof filters === "object"
      ? filters
      : { bank_account_id: filters || null };
  const clauses = [];
  const params = [];
  if (clean.bank_account_id) {
    clauses.push("bt.bank_account_id = ?");
    params.push(Number(clean.bank_account_id));
  }
  if (clean.from_date) {
    clauses.push("bt.transaction_date >= ?");
    params.push(clean.from_date);
  }
  if (clean.to_date) {
    clauses.push("bt.transaction_date <= ?");
    params.push(clean.to_date);
  }

  if (clean.show_deleted) {
    clauses.push("COALESCE(bt.is_deleted, 0) = 1");
  } else {
    clauses.push("COALESCE(bt.is_deleted, 0) = 0");
  }

  if (clean.voucher_type && clean.voucher_type !== "All") {
    const vType = clean.voucher_type.toUpperCase();
    if (vType === "CONTRA") clauses.push("bt.source_type = 'transfer'");
    else if (vType === "RECEIPT") clauses.push("bt.type = 'credit'");
    else if (vType === "PAYMENT") clauses.push("bt.type = 'debit'");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `
      SELECT
        bt.*,
        ba.account_name,
        ba.bank_name,
        COALESCE(e.category_id, ip.category_id, op.category_id) as category_id,
        COALESCE(e.payment_mode, ip.mode, op.mode) as mode,
        -- Display Metadata
        c.company_name AS customer_name,
        v.company_name AS vendor_name,
        i.invoice_no,
        ri.recurring_invoice_no AS recurring_no, -- Use recurring_no for recurring invoices
        p.bill_no,
        ex.expense_no,
        COALESCE(ec.name, e.category) AS expense_category,
        COALESCE(
          (SELECT GROUP_CONCAT(name, ', ') FROM (SELECT name FROM invoice_items WHERE invoice_id = ip.invoice_id LIMIT 2)),
          (SELECT GROUP_CONCAT(name, ', ') FROM (SELECT name FROM recurring_items WHERE recurring_invoice_id = ip.recurring_invoice_id LIMIT 2))
        ) AS service_names,
        (SELECT GROUP_CONCAT(name, ', ') FROM (SELECT name FROM purchase_items WHERE purchase_id = op.purchase_id LIMIT 2)) AS purchase_services,
        COALESCE(ip.payment_no, op.payment_no, bt.reference_no) AS voucher_no,
        ip.invoice_id,
        ip.recurring_invoice_id,
        ip.contact_id,
        op.purchase_id,
        op.contact_id AS vendor_contact_id,
        op.expense_id,
        CASE
          WHEN bt.source_type = 'reversal' THEN 'Reversal'
          WHEN bt.source_type = 'expense' THEN 'Expense'
          WHEN bt.source_type = 'expense_payment' THEN 'Expense Payment'
          WHEN bt.source_type = 'customer_payment' THEN 'Invoice Payment'
          WHEN bt.source_type = 'purchase_payment' THEN 'Purchase Payment'
          WHEN bt.source_type = 'transfer' THEN 'Fund Transfer'
          ELSE 'Manual Adjustment'
        END AS transaction_label,
        CASE 
          WHEN bt.source_type = 'transfer' THEN 'CONTRA'
          WHEN bt.source_type = 'reversal' THEN 'REVERSAL'
          WHEN bt.type = 'credit' OR bt.source_type = 'customer_payment' THEN 'RECEIPT'
          WHEN bt.type = 'debit' THEN 'PAYMENT'
          ELSE 'JOURNAL'
        END AS voucher_type,
        CASE WHEN bt.type = 'debit' THEN bt.amount ELSE 0 END AS debit,
        CASE WHEN bt.type = 'credit' THEN bt.amount ELSE 0 END AS credit
      FROM bank_transactions bt
      LEFT JOIN bank_accounts ba
        ON ba.id = bt.bank_account_id
      LEFT JOIN expenses e ON e.id = bt.source_id AND bt.source_type = 'expense'
      LEFT JOIN incoming_payments ip ON ip.id = bt.source_id AND bt.source_type = 'customer_payment'
      LEFT JOIN outgoing_payments op ON op.id = bt.source_id AND (bt.source_type = 'purchase_payment' OR bt.source_type = 'manual_adjustment' OR bt.source_type = 'expense_payment')
      LEFT JOIN contacts c ON c.id = ip.contact_id AND c.is_customer = 1
      LEFT JOIN contacts v ON v.id = op.contact_id AND v.is_vendor = 1
      LEFT JOIN invoices i ON i.id = ip.invoice_id
      LEFT JOIN recurring_invoices ri ON ri.id = ip.recurring_invoice_id
      LEFT JOIN purchases p ON p.id = op.purchase_id
      LEFT JOIN expenses ex ON ex.id = op.expense_id
      LEFT JOIN expense_categories ec ON ec.id = COALESCE(e.category_id, op.category_id)
      ${where}
      ORDER BY bt.transaction_date DESC, bt.id DESC
    `,
    )
    .all(...params);
}

function bankingDashboard(filters = {}) {
  const db = getDb();
  const ledger = bankLedger(filters);
  return {
    totalBankBalance: db
      .prepare(
        "SELECT COALESCE(SUM(current_balance), 0) total FROM bank_accounts WHERE is_active = 1",
      )
      .get().total,
    todaysCredits: db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) total FROM bank_transactions WHERE type = 'credit' AND transaction_date = date('now', 'localtime') AND COALESCE(is_deleted, 0) = 0",
      )
      .get().total,
    todaysDebits: db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) total FROM bank_transactions WHERE type = 'debit' AND transaction_date = date('now', 'localtime') AND COALESCE(is_deleted, 0) = 0",
      )
      .get().total,
    monthlyTransactions: db
      .prepare(
        "SELECT COUNT(*) total FROM bank_transactions WHERE strftime('%Y-%m', transaction_date) = strftime('%Y-%m', 'now', 'localtime') AND COALESCE(is_deleted, 0) = 0",
      )
      .get().total,
    transactions: ledger,
  };
}

function recordTransfer(payload) {
  const db = getDb();
  return db.transaction(() => {
    const amount = round(payload.amount || 0);
    checkNarrationRequirement(db, payload.notes);

    if (amount <= 0)
      throw new Error("Transfer amount must be greater than zero");

    const fromAccount = db
      .prepare("SELECT * FROM bank_accounts WHERE id = ?")
      .get(payload.from_account_id);
    const toAccount = db
      .prepare("SELECT * FROM bank_accounts WHERE id = ?")
      .get(payload.to_account_id);

    if (!fromAccount || !toAccount)
      throw new Error("Source or destination account not found");
    if (fromAccount.id === toAccount.id)
      throw new Error("Source and destination accounts must be different");

    // 1. Debit Source
    const txFrom = createBankTransaction(db, {
      bank_account_id: fromAccount.id,
      transaction_date: payload.transaction_date,
      type: "debit",
      source_type: "transfer",
      amount: amount,
      reference_no: payload.reference_no,
      notes: `Transfer to ${toAccount.account_name}. ${payload.notes || ""}`,
    });

    // 2. Credit Destination
    const txTo = createBankTransaction(db, {
      bank_account_id: toAccount.id,
      transaction_date: payload.transaction_date,
      type: "credit",
      source_type: "transfer",
      amount: amount,
      reference_no: payload.reference_no,
      notes: `Transfer from ${fromAccount.account_name}. ${payload.notes || ""}`,
    });

    // 3. Ledger Entries
    createLedgerEntry(db, {
      entry_date: payload.transaction_date,
      account: "Bank Transfer",
      source_type: "transfer",
      source_id: txFrom.id,
      reference_no: payload.reference_no,
      debit: amount,
      notes: `Out: ${fromAccount.account_name} -> ${toAccount.account_name}`,
    });

    return { from_transaction_id: txFrom.id, to_transaction_id: txTo.id };
  })();
}

function getDetailedLedger(filters = {}) {
  const db = getDb();
  const accountId = Number(filters.bank_account_id);
  if (!accountId) throw new Error("Bank account ID is required for ledger");

  const account = db
    .prepare("SELECT * FROM bank_accounts WHERE id = ?")
    .get(accountId);
  if (!account) throw new Error("Account not found");

  const txs = bankLedger(filters);

  return {
    account,
    transactions: txs,
  };
}

function incomeLedger() {
  return getDb()
    .prepare(
      `
      SELECT
    p.id,
    p.payment_date AS received_date,
    CASE
      WHEN p.recurring_invoice_id IS NOT NULL THEN 'recurring_payment'
      ELSE 'invoice_payment'
    END AS source_type,
    COALESCE(i.id, ri.id) AS source_id,
    i.invoice_no,
    ri.recurring_invoice_no,
    p.payment_no,
    c.company_name AS customer, -- Alias for display, logic is updated
    p.mode,
    p.reference_no,
    p.amount,
    ba.account_name AS bank_account
FROM incoming_payments p
LEFT JOIN invoices i
    ON i.id = p.invoice_id
LEFT JOIN recurring_invoices ri
    ON ri.id = COALESCE(p.recurring_invoice_id, i.recurring_id)
JOIN contacts c
    ON c.id = p.contact_id AND c.is_customer = 1
LEFT JOIN bank_accounts ba
    ON ba.id = p.bank_account_id
LEFT JOIN bank_transactions bt
    ON bt.id = p.bank_transaction_id
WHERE COALESCE(p.is_deleted, 0) = 0
  AND (p.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
ORDER BY p.payment_date DESC, p.id DESC
    `,
    )
    .all();
}

function outgoingLedger() {
  return getDb()
    .prepare(
      `
      SELECT
        p.id,
        p.payment_date,
        p.payment_no,
        v.company_name AS vendor,
        COALESCE(pur.bill_no, ex.expense_no) AS reference_doc,
        p.amount, -- This is fine, it's the payment amount
        p.mode,
        p.reference_no,
        ba.account_name AS bank_account,
        CASE 
          WHEN p.purchase_id IS NOT NULL THEN 'purchase'
          WHEN p.expense_id IS NOT NULL THEN 'expense'
          ELSE 'other'
        END AS source_type
      FROM outgoing_payments p
      LEFT JOIN contacts v
        ON v.id = p.contact_id AND v.is_vendor = 1 -- Already updated in previous turn
      LEFT JOIN purchases pur
        ON pur.id = p.purchase_id
      LEFT JOIN expenses ex
        ON ex.id = p.expense_id
      LEFT JOIN bank_accounts ba
        ON ba.id = p.bank_account_id
      LEFT JOIN bank_transactions bt
        ON bt.id = p.bank_transaction_id
      WHERE COALESCE(p.is_deleted, 0) = 0
        AND (p.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
      ORDER BY p.payment_date DESC, p.id DESC
    `,
    )
    .all();
}

function accountsDashboard() {
  const db = getDb();

  // 1. Calculate Summary Metrics
  const totalReceivable = db.prepare("SELECT COALESCE(SUM(balance_due), 0) total FROM invoices WHERE is_deleted = 0 AND status != 'cancelled'").get().total;
  
  const recurringOutstanding = db.prepare(`
    SELECT COALESCE(SUM(h.pending_amount), 0) as total
    FROM recurring_invoice_history h
    INNER JOIN (
      SELECT recurring_invoice_id, MAX(id) as id
      FROM recurring_invoice_history
      GROUP BY recurring_invoice_id
    ) latest ON h.id = latest.id
    WHERE h.collection_status != 'completed'
  `).get().total;

  const purchaseOS = db.prepare("SELECT COALESCE(SUM(balance_due), 0) total FROM purchases WHERE is_deleted = 0").get().total;
  const expenseOS = db.prepare("SELECT COALESCE(SUM(balance_due), 0) total FROM expenses WHERE is_deleted = 0").get().total;

  const overdueAR = db.prepare("SELECT COALESCE(SUM(balance_due), 0) total FROM invoices WHERE is_deleted = 0 AND balance_due > 0 AND due_date < date('now') AND status != 'cancelled'").get().total;
  const overduePayable = db.prepare(`
    SELECT (SELECT COALESCE(SUM(balance_due), 0) FROM purchases WHERE is_deleted = 0 AND balance_due > 0 AND due_date < date('now')) +
           (SELECT COALESCE(SUM(balance_due), 0) FROM expenses WHERE is_deleted = 0 AND balance_due > 0 AND due_date < date('now')) as total
  `).get().total;

  // 2. Aggregate Customer Relationship Data
  const customers = db.prepare(`
    SELECT
        c.id AS id,
        c.id AS contact_id,
        c.company_name AS name,
        (SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE contact_id = c.id AND is_deleted = 0 AND status != 'cancelled') AS total_invoiced,
        (SELECT COALESCE(SUM(amount), 0) FROM incoming_payments WHERE contact_id = c.id AND COALESCE(is_deleted, 0) = 0 AND invoice_id IS NOT NULL) AS total_received,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE contact_id = c.id AND is_deleted = 0 AND status != 'cancelled') AS customer_outstanding,
        0 AS vendor_outstanding,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE contact_id = c.id AND is_deleted = 0 AND status != 'cancelled' AND due_date < date('now')) AS overdue,
        (
          SELECT MAX(activity_date)
          FROM (
            SELECT MAX(invoice_date) AS activity_date FROM invoices WHERE contact_id = c.id AND is_deleted = 0 AND status != 'cancelled'
            UNION ALL
            SELECT MAX(payment_date) AS activity_date FROM incoming_payments WHERE contact_id = c.id AND COALESCE(is_deleted, 0) = 0
          )
        ) AS last_activity
    FROM contacts c
    WHERE c.is_deleted = 0 AND c.is_customer = 1
    ORDER BY customer_outstanding DESC
  `).all();

  // 3. Aggregate Vendor Relationship Data
  const vendors = db.prepare(`
    SELECT
        v.id AS id,
        v.id AS contact_id,
        v.company_name AS name,
        0 AS total_invoiced,
        0 AS total_received,
        (SELECT COALESCE(SUM(grand_total), 0) FROM purchases WHERE contact_id = v.id AND is_deleted = 0) +
        (SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE contact_id = v.id AND is_deleted = 0) AS total_purchases,
        (SELECT COALESCE(SUM(op.amount), 0) 
         FROM outgoing_payments op 
         LEFT JOIN expenses e ON e.id = op.expense_id
         LEFT JOIN purchases p ON p.id = op.purchase_id
         WHERE COALESCE(op.contact_id, e.contact_id, p.contact_id) = v.id AND COALESCE(op.is_deleted, 0) = 0) AS total_paid,
        (SELECT COALESCE(SUM(balance_due), 0) FROM purchases WHERE contact_id = v.id AND is_deleted = 0) + 
        (SELECT COALESCE(SUM(balance_due), 0) FROM expenses WHERE contact_id = v.id AND is_deleted = 0) AS vendor_outstanding,
        0 AS customer_outstanding,
        (SELECT COALESCE(SUM(balance_due), 0) FROM purchases WHERE contact_id = v.id AND is_deleted = 0 AND due_date < date('now')) +
        (SELECT COALESCE(SUM(balance_due), 0) FROM expenses WHERE contact_id = v.id AND is_deleted = 0 AND due_date < date('now')) AS overdue,
        (
          SELECT MAX(activity_date)
          FROM (
            SELECT MAX(bill_date) AS activity_date FROM purchases WHERE contact_id = v.id AND is_deleted = 0
            UNION ALL
            SELECT MAX(expense_date) AS activity_date FROM expenses WHERE contact_id = v.id AND is_deleted = 0
            UNION ALL
            SELECT MAX(payment_date) AS activity_date FROM outgoing_payments WHERE contact_id = v.id AND COALESCE(is_deleted, 0) = 0
          )
        ) AS last_activity
    FROM contacts v
    WHERE v.is_deleted = 0 AND v.is_vendor = 1
    ORDER BY vendor_outstanding DESC
  `).all();

  // 4. Aggregate Party Accounts (Grouped by Company Name)
  const parties = db.prepare(`
    WITH party_names AS (
      SELECT TRIM(LOWER(company_name)) AS company_name FROM contacts WHERE is_deleted = 0
    )
    SELECT 
      pn.company_name AS name,
      (SELECT id FROM contacts WHERE TRIM(LOWER(company_name)) = pn.company_name AND is_deleted = 0 AND is_customer = 1 LIMIT 1) AS contact_id,
      (SELECT id FROM contacts WHERE TRIM(LOWER(company_name)) = pn.company_name AND is_deleted = 0 AND is_vendor = 1 LIMIT 1) AS vendor_contact_id,
      -- Receivable metrics
      COALESCE((SELECT SUM(grand_total) FROM invoices i JOIN contacts c ON c.id = i.contact_id WHERE TRIM(LOWER(c.company_name)) = pn.company_name AND i.is_deleted = 0 AND i.status != 'cancelled'), 0) AS total_invoiced,
      COALESCE((SELECT SUM(amount) FROM incoming_payments ip JOIN contacts c ON c.id = ip.contact_id WHERE TRIM(LOWER(c.company_name)) = pn.company_name AND COALESCE(ip.is_deleted, 0) = 0 AND ip.invoice_id IS NOT NULL), 0) AS total_received,
      COALESCE((SELECT SUM(balance_due) FROM invoices i JOIN contacts c ON c.id = i.contact_id WHERE TRIM(LOWER(c.company_name)) = pn.company_name AND i.is_deleted = 0 AND i.status != 'cancelled'), 0) AS customer_outstanding,
      COALESCE((SELECT SUM(CASE WHEN i.due_date < date('now') THEN i.balance_due ELSE 0 END) FROM invoices i JOIN contacts c ON c.id = i.contact_id WHERE TRIM(LOWER(c.company_name)) = pn.company_name AND i.is_deleted = 0 AND i.status != 'cancelled'), 0) AS customer_overdue,
      -- Payable metrics
      COALESCE((SELECT SUM(p.grand_total) FROM purchases p JOIN contacts v ON v.id = p.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND p.is_deleted = 0), 0) +
      COALESCE((SELECT SUM(e.total_amount) FROM expenses e JOIN contacts v ON v.id = e.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND e.is_deleted = 0), 0) AS total_purchases,
      COALESCE((
        SELECT SUM(op.amount) 
        FROM outgoing_payments op 
        LEFT JOIN expenses e_res ON e_res.id = op.expense_id
        LEFT JOIN purchases p_res ON p_res.id = op.purchase_id
        LEFT JOIN contacts v_res ON v_res.id = COALESCE(op.contact_id, e_res.contact_id, p_res.contact_id)
        WHERE TRIM(LOWER(v_res.company_name)) = pn.company_name AND COALESCE(op.is_deleted, 0) = 0
      ), 0) AS total_paid,
      COALESCE((SELECT SUM(p.balance_due) FROM purchases p JOIN contacts v ON v.id = p.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND p.is_deleted = 0), 0) +
      COALESCE((SELECT SUM(e.balance_due) FROM expenses e JOIN contacts v ON v.id = e.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND e.is_deleted = 0), 0) AS vendor_outstanding,
      COALESCE((SELECT SUM(CASE WHEN p.due_date < date('now') THEN p.balance_due ELSE 0 END) FROM purchases p JOIN contacts v ON v.id = p.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND p.is_deleted = 0), 0) +
      COALESCE((SELECT SUM(CASE WHEN e.due_date < date('now') THEN e.balance_due ELSE 0 END) FROM expenses e JOIN contacts v ON v.id = e.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND e.is_deleted = 0), 0) AS vendor_overdue,
      -- Counts
      COALESCE((SELECT COUNT(*) FROM invoices i JOIN contacts c ON c.id = i.contact_id WHERE TRIM(LOWER(c.company_name)) = pn.company_name AND i.balance_due > 0 AND i.is_deleted = 0 AND i.status != 'cancelled'), 0) AS open_invoice_count,
      COALESCE((SELECT COUNT(*) FROM purchases p JOIN contacts v ON v.id = p.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND p.balance_due > 0 AND p.is_deleted = 0), 0) + 
      COALESCE((SELECT COUNT(*) FROM expenses e JOIN contacts v ON v.id = e.contact_id WHERE TRIM(LOWER(v.company_name)) = pn.company_name AND e.balance_due > 0 AND e.is_deleted = 0), 0) AS open_bill_count,
      -- Recurring metrics
      COALESCE((SELECT SUM(h.pending_amount) FROM recurring_invoice_history h JOIN recurring_invoices ri ON ri.id = h.recurring_invoice_id JOIN recurring r ON r.id = ri.recurring_id JOIN contacts cust ON cust.id = r.contact_id WHERE TRIM(LOWER(cust.company_name)) = pn.company_name AND h.id IN (SELECT MAX(id) FROM recurring_invoice_history GROUP BY recurring_invoice_id)), 0) AS recurring_outstanding
    FROM party_names pn
    ORDER BY name ASC
  `).all();

  return {
    summary: {
      totalReceivable: round(totalReceivable),
      totalPayable: round(purchaseOS + expenseOS),
      overdueReceivable: round(overdueAR),
      overduePayable: round(overduePayable),
      recurringOutstanding: round(recurringOutstanding)
    },
    customers,
    vendors,
    parties
  };
}

/**
 * Detailed statement for a specific party grouping customers and vendors by name.
 */
function getPartyStatement(payload) {
  const db = getDb();

  const companyName =
    typeof payload === "string"
      ? payload
      : payload?.companyName || "";

  const customerId = payload?.customerId || null;
  const vendorId = payload?.vendorId || null;

  const searchName = String(companyName)
    .trim()
    .toLowerCase();

  console.log("[DIAGNOSTIC] Incoming companyName:", companyName);
  console.log("[DIAGNOSTIC] Normalized searchName:", searchName);

  const customerMatch = db.prepare("SELECT id, company_name, opening_balance FROM contacts WHERE (id = ? OR TRIM(LOWER(company_name)) = ?) AND is_customer = 1").get(customerId, searchName);
  const vendorMatch = db.prepare("SELECT id, company_name, opening_balance FROM contacts WHERE (id = ? OR TRIM(LOWER(company_name)) = ?) AND is_vendor = 1").get(vendorId, searchName);

  // Calculate Fresh Summary for Header
  const customer_outstanding = db.prepare(`
    SELECT COALESCE(SUM(balance_due), 0) as s 
    FROM invoices 
    WHERE contact_id = ? AND is_deleted = 0 AND status != 'cancelled'
  `).get(customerMatch?.id || -1).s;

  // Aggregate Total Sales for Summary
  const customer_generated = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) as s 
    FROM invoices 
    WHERE contact_id = ? AND is_deleted = 0 AND status != 'cancelled'
  `).get(customerMatch?.id || -1).s;

  // Aggregate Total Received for Summary
  const customer_received = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as s 
    FROM incoming_payments 
    WHERE contact_id = ? AND is_deleted = 0 AND invoice_id IS NOT NULL
  `).get(customerMatch?.id || -1).s;

  const customer_overdue = db.prepare(`
    SELECT COALESCE(SUM(balance_due), 0) as s 
    FROM invoices 
    WHERE contact_id = ? AND is_deleted = 0 AND status != 'cancelled' AND due_date < date('now')
  `).get(customerMatch?.id || -1).s;

  const open_invoice_count = db.prepare(`
    SELECT COUNT(*) as c 
    FROM invoices 
    WHERE contact_id = ? AND is_deleted = 0 AND status != 'cancelled' AND balance_due > 0
  `).get(customerMatch?.id || -1).c;

  const vendor_outstanding = db.prepare(` 
    SELECT 
      (SELECT COALESCE(SUM(balance_due), 0) FROM purchases WHERE contact_id = ? AND is_deleted = 0) +
      (SELECT COALESCE(SUM(balance_due), 0) FROM expenses WHERE contact_id = ? AND is_deleted = 0) as s
  `).get(vendorMatch?.id || -1, vendorMatch?.id || -1).s;

  const vendor_overdue = db.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(balance_due), 0) FROM purchases WHERE contact_id = ? AND is_deleted = 0 AND due_date < date('now')) +
      (SELECT COALESCE(SUM(balance_due), 0) FROM expenses WHERE contact_id = ? AND is_deleted = 0 AND due_date < date('now')) as s
  `).get(vendorMatch?.id || -1, vendorMatch?.id || -1).s;

  // Aggregate Total Purchases for Summary
  const vendor_generated = db.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(grand_total), 0) FROM purchases WHERE contact_id = ? AND is_deleted = 0) +
      (SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE contact_id = ? AND is_deleted = 0) as s
  `).get(vendorMatch?.id || -1, vendorMatch?.id || -1).s;

  // Aggregate Total Paid for Summary
  const vendor_paid = db.prepare(`
    SELECT COALESCE(SUM(op.amount), 0) as s 
    FROM outgoing_payments op
    LEFT JOIN expenses e ON e.id = op.expense_id
    LEFT JOIN purchases p ON p.id = op.purchase_id
    WHERE COALESCE(op.contact_id, e.contact_id, p.contact_id) = ? AND COALESCE(op.is_deleted, 0) = 0
  `).get(vendorMatch?.id || -1).s;

  const open_bill_count = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM purchases WHERE contact_id = ? AND is_deleted = 0 AND balance_due > 0) +
      (SELECT COUNT(*) FROM expenses WHERE contact_id = ? AND is_deleted = 0 AND balance_due > 0) as c
  `).get(vendorMatch?.id || -1, vendorMatch?.id || -1).c;



  // Recurring Calculations for this specific Party
  const recurring_generated = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as s FROM recurring_invoice_history h
    JOIN recurring_invoices ri ON ri.id = h.recurring_invoice_id
    JOIN recurring r ON r.id = ri.recurring_id
    WHERE r.contact_id = ? AND h.action_type = 'cycle_generated'
  `).get(customerMatch?.id || -1).s;

  const recurring_collected = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as s FROM incoming_payments
    WHERE ip.contact_id = ? AND ip.recurring_invoice_id IS NOT NULL AND COALESCE(ip.is_deleted, 0) = 0
  `).get(customerMatch?.id || -1).s;

  const recurring_outstanding = db.prepare(`
    SELECT COALESCE(SUM(h.pending_amount), 0) as s FROM recurring_invoice_history h
    JOIN recurring_invoices ri ON ri.id = h.recurring_invoice_id
    JOIN recurring r ON r.id = ri.recurring_id
    WHERE r.contact_id = ? AND h.id IN (SELECT MAX(id) FROM recurring_invoice_history GROUP BY recurring_invoice_id)
  `).get(customerMatch?.id || -1).s;

  console.log("[DIAGNOSTIC] Resolved Customer ID:", customerMatch?.id);
  console.log("[DIAGNOSTIC] Resolved Vendor ID:", vendorMatch?.id);

  // 1. Get All Invoices
  const invoices = db.prepare(`
    SELECT i.*
    FROM invoices i
    JOIN contacts c ON c.id = i.contact_id AND c.is_customer = 1
    WHERE (c.id = ? OR TRIM(LOWER(c.company_name)) = ?) AND i.is_deleted = 0 AND i.status != 'cancelled'
    ORDER BY i.invoice_date DESC
  `).all(customerMatch?.id || -1, searchName);
  console.log("[DIAGNOSTIC] Invoice Count:", invoices.length);

  // 2. Get All Purchases and Expenses
  const bills = db.prepare(`
    SELECT 'Purchase' as type, p.id, p.bill_date as date, p.bill_no as doc_no, p.grand_total as amount, p.paid_amount, p.balance_due, p.status
    FROM purchases p
    JOIN contacts v ON v.id = p.contact_id AND v.is_vendor = 1
    WHERE (v.id = ? OR TRIM(LOWER(v.company_name)) = ?) AND p.is_deleted = 0
    UNION ALL
    SELECT 'Expense' as type, e.id, e.expense_date as date, e.expense_no as doc_no, e.total_amount as amount, e.paid_amount, e.balance_due, e.status
    FROM expenses e
    JOIN contacts v ON v.id = e.contact_id AND v.is_vendor = 1
    WHERE (v.id = ? OR TRIM(LOWER(v.company_name)) = ?) AND e.is_deleted = 0
    ORDER BY date DESC
  `).all(vendorMatch?.id || -1, searchName, vendorMatch?.id || -1, searchName);
  console.log("[DIAGNOSTIC] Purchase/Expense Count:", bills.length);

  // 3. Combined Financial Timeline
  const rawTimeline = db.prepare(`
    SELECT 'Invoice' as type, invoice_date as date, invoice_no as ref, grand_total as debit, 0 as credit
    FROM invoices i JOIN contacts c ON c.id = i.contact_id AND c.is_customer = 1
    WHERE (i.contact_id = ? OR TRIM(LOWER(c.company_name)) = ?) AND i.is_deleted = 0 AND i.status != 'cancelled'
    UNION ALL
    SELECT 'Receipt' as type, payment_date as date, payment_no as ref, 0 as debit, amount as credit
    FROM incoming_payments ip JOIN contacts c ON c.id = ip.contact_id AND c.is_customer = 1
    WHERE (ip.contact_id = ? OR TRIM(LOWER(c.company_name)) = ?) AND COALESCE(ip.is_deleted, 0) = 0
    UNION ALL
    SELECT 'Purchase' as type, bill_date as date, bill_no as ref, 0 as debit, grand_total as credit
    FROM purchases p JOIN contacts v ON v.id = p.contact_id AND v.is_vendor = 1
    WHERE (p.contact_id = ? OR TRIM(LOWER(v.company_name)) = ?) AND p.is_deleted = 0
    UNION ALL
    SELECT 'Expense' as type, expense_date as date, expense_no as ref, 0 as debit, total_amount as credit
    FROM expenses e JOIN contacts v ON v.id = e.contact_id AND v.is_vendor = 1
    WHERE (e.contact_id = ? OR TRIM(LOWER(v.company_name)) = ?) AND e.is_deleted = 0
    UNION ALL
    SELECT 'Vendor Payment' as type, op.payment_date as date, op.payment_no as ref, op.amount as debit, 0 as credit
    FROM outgoing_payments op 
    LEFT JOIN expenses e ON e.id = op.expense_id
    LEFT JOIN purchases p ON p.id = op.purchase_id
    LEFT JOIN contacts v ON v.id = COALESCE(op.contact_id, e.contact_id, p.contact_id) AND v.is_vendor = 1
    WHERE (COALESCE(op.contact_id, e.contact_id, p.contact_id) = ? OR TRIM(LOWER(v.company_name)) = ?) AND COALESCE(op.is_deleted, 0) = 0
    ORDER BY date ASC
  `).all(customerMatch?.id || -1, searchName, customerMatch?.id || -1, searchName, vendorMatch?.id || -1, searchName, vendorMatch?.id || -1, searchName, vendorMatch?.id || -1, searchName);

  // Audit Timeline with Opening Balance
  const customerOB = Number(customerMatch?.opening_balance || 0);
  const vendorOB = Number(vendorMatch?.opening_balance || 0);
  const netOpening = round(customerOB - vendorOB);

  let running = round(customerOB - vendorOB); // Initial balance for the timeline
  const timelineEntries = rawTimeline.map(item => {
    running += (item.debit - item.credit);
    return { ...item, balance: round(running) };
  });

  // Prepend Opening Balance if it exists
  const timeline = [...timelineEntries];
  if (netOpening !== 0) {
    timeline.unshift({
      date: null,
      type: 'Opening Balance',
      ref: 'Master Record',
      debit: customerOB,
      credit: vendorOB,
      balance: netOpening
    });
  }
  
  const summary = { 
    customer_outstanding, 
    customer_generated,
    customer_received,
    customer_overdue,
    open_invoice_count,
    vendor_outstanding, 
    vendor_generated,
    vendor_paid,
    vendor_overdue,
    open_bill_count,
    recurring_outstanding,
    recurring_collected,
    recurring_generated,
    net: round(customer_outstanding - vendor_outstanding) 
  };
  const result = { invoices, bills, timeline: timeline.reverse(), summary };
  console.log("9. Final Party Statement Response:", { 
    invoices: invoices.length, 
    bills: bills.length, 
    timeline: timeline.length 
  });

  console.log("PARTY SUMMARY DEBUG", summary);

  return result;
}

module.exports = {
  accountsDashboard,
  getPartyStatement,
  bankingDashboard,
  bankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  bankLedger,
  createBankTransaction,
  createLedgerEntry,
  incomeLedger,
  outgoingLedger,
  manualAdjustment,
  reverseBankTransaction,
  ensureDefaultCashAccount,
  recordTransfer,
  getDetailedLedger,
  checkNarrationRequirement,
  incomeCategories,
  createIncomeCategory,
  updateIncomeCategory,
  deleteIncomeCategory,
  expenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  ensureDefaultExpenseCategories,
  getBankTransaction,
  updateBankTransaction,
  softDeleteBankTransaction,
  restoreBankTransaction,
  rebuildAllBankBalances,
};
