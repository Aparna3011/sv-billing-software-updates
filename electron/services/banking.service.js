const accounting = require("./accounting.service");
const expenses = require("./expense.service");
const payments = require("./payment.service");
const purchases = require("./purchase.service");
const { getDb } = require("../db/database");

function paymentMode(payload) {
  return payload.mode || "bank_transfer";
}

function referenceNo(payload) {
  return payload.reference_no || payload.cheque_no || "";
}

function partyNote(payload) {
  const name = String(payload.party_name || "").trim();
  return name ? `Party: ${name}` : "";
}

function combinedNotes(payload, fallback = "") {
  return [partyNote(payload), payload.notes || fallback].filter(Boolean).join(" | ");
}

function recordBankingEntry(payload = {}) {
  accounting.checkNarrationRequirement(getDb(), payload.notes);

  const direction = payload.direction || payload.type;
  const referenceType = payload.reference_type || "standalone";
  const amount = Number(payload.amount || 0);
  if (amount <= 0) throw new Error("Amount must be greater than zero");

  if (direction === "contra") {
    return accounting.recordTransfer({
      from_account_id: Number(payload.bank_account_id),
      to_account_id: Number(payload.to_account_id),
      transaction_date: payload.transaction_date,
      amount,
      reference_no: referenceNo(payload),
      notes: payload.notes || "",
    });
  }

  if (!payload.bank_account_id) throw new Error("Bank account is required");

  if (direction === "receipt") {
    if (referenceType === "invoice") {
      if (!payload.invoice_id) throw new Error("Invoice is required");
      return payments.recordPayment({
        invoice_id: Number(payload.invoice_id),
        customer_id: payload.customer_id ? Number(payload.customer_id) : null,
        payment_date: payload.transaction_date,
        amount,
        mode: paymentMode(payload),
        reference_no: referenceNo(payload),
        notes: combinedNotes(payload, "Invoice payment received from banking"),
        bank_account_id: Number(payload.bank_account_id),
        category_id: null, // rule: linked payments have no category
      });
    }

    if (referenceType === "recurring") {
      if (!payload.recurring_invoice_id) throw new Error("Recurring plan is required");
      return payments.recordPayment({
        recurring_invoice_id: Number(payload.recurring_invoice_id),
        customer_id: payload.customer_id ? Number(payload.customer_id) : null,
        payment_date: payload.transaction_date,
        amount,
        mode: paymentMode(payload),
        reference_no: referenceNo(payload),
        notes: combinedNotes(payload, "Recurring payment received from banking"),
        bank_account_id: Number(payload.bank_account_id),
        category_id: null, // rule: linked payments have no category
      });
    }

    return payments.recordPayment({
      bank_account_id: Number(payload.bank_account_id),
      payment_date: payload.transaction_date,
      customer_id: payload.customer_id || 1, // Fallback to General Customer if needed
      amount,
      mode: paymentMode(payload),
      reference_no: referenceNo(payload),
      category_id: payload.category_id || null,
      notes: combinedNotes(payload, "Standalone receipt recorded from banking"),
    });
  }

  if (direction === "payment") {
    if (referenceType === "purchase") {
      if (!payload.purchase_id) throw new Error("Purchase is required");
      return purchases.recordPurchasePayment({
        purchase_id: Number(payload.purchase_id),
        vendor_id: payload.vendor_id ? Number(payload.vendor_id) : null,
        payment_date: payload.transaction_date,
        amount,
        mode: paymentMode(payload),
        reference_no: referenceNo(payload),
        notes: combinedNotes(payload, "Purchase payment from banking"),
        bank_account_id: Number(payload.bank_account_id),
        category_id: null, // rule: linked payments have no category
      });
    }

    if (referenceType === "expense") {
      // Now records payment against an existing expense, not creates a new one
      if (!payload.expense_id) throw new Error("Expense is required");
      return expenses.recordExpensePayment({
        expense_id: Number(payload.expense_id),
        vendor_id: payload.vendor_id ? Number(payload.vendor_id) : null,
        category_id: payload.category_id ? Number(payload.category_id) : null,
        payment_date: payload.transaction_date,
        amount,
        mode: paymentMode(payload),
        reference_no: referenceNo(payload),
        notes: combinedNotes(payload, "Expense payment from banking"),
        bank_account_id: Number(payload.bank_account_id),
      });
    }

    return purchases.recordPurchasePayment({
      bank_account_id: Number(payload.bank_account_id),
      payment_date: payload.transaction_date,
      vendor_id: payload.vendor_id || 1, // Fallback to General Vendor
      amount,
      mode: paymentMode(payload),
      reference_no: referenceNo(payload),
      category_id: payload.category_id || null,
      notes: combinedNotes(payload, "Standalone payment recorded from banking"),
    });
  }

  throw new Error("Unsupported banking entry type");
}

module.exports = { recordBankingEntry };
