export async function call(channel, payload = {}) {
  const result = await window.electronAPI.invoke(channel, payload);
  if (result?.error) throw new Error(result.error);
  return result?.data;
}

export const modules = {
  dashboard: (payload) => call("dashboard:metrics", payload),
  login: (payload) => call("auth:login", payload),
  company: {
    get: () => call("company:get", {}),
    update: (payload) => call("company:update", payload),
    uploadLogo: (payload) => call("company:uploadLogo", payload),
  },
  customers: crud("customers"),
  services: crud("services"),
  quotations: {
    ...crud("quotations"),
    approve: (id) => call("quotations:approve", { id }),
    reject: (id) => call("quotations:reject", { id }),
    convert: (id) => call("quotations:convert", { id }),
  },
  invoices: {
    ...crud("invoices"),
    cancel: (id, role) => call("invoices:cancel", { id, role }),
    listByCustomer: (customerId) => call("invoices:listByCustomer", { customerId }),
  },
  payments: {
    list: () => call("payments:list", {}),

    create: (payload) => call("payments:create", payload),

    update: (payload) => call("payments:update", payload),
  },
  outgoingPayments: crud("outgoingPayments"),
  recurring: {
    ...crud("recurring"),
    get: (id, options = {}) =>
      call(
        "recurring:get",
        typeof id === "object" && id !== null ? id : { id, ...options },
      ),
    getPlan: (id) => call("recurring:getPlan", { id }),
    history: (recurringId) =>
      call(
        "recurring:history",
        typeof recurringId === "object" && recurringId !== null
          ? recurringId
          : { recurringId },
      ),
    historyAll: () => call("recurring:historyAll"),
    generateDue: () => call("recurring:generateDue"),
    stopPlan: (payload) => call("recurring:stopPlan", payload),
    resumePlan: (payload) => call("recurring:resumePlan", payload),
    stopRecurring: (payload) => call("recurring:stopRecurring", payload),
    resumeRecurring: (payload) => call("recurring:resumeRecurring", payload),
  },
  expenses: {
    ...crud("expenses"),
    dashboard: () => call("expenses:dashboard"),
    recordPayment: (data) => call("expenses:recordPayment", data),
  },
  purchases: {
    ...crud("purchases"),
    dashboard: () => call("purchases:dashboard"),
    recordPayment: (payload) => call("purchases:recordPayment", payload),
  },
  vendors: crud("vendors"),
  expenseCategories: {
    ...crud("expenseCategories"),
    ensureDefaults: () => call("expenseCategories:ensureDefaults"),
  },
  incomeCategories: crud("incomeCategories"),
  bankAccounts: {
    list: () => call("bankAccounts:list"),
    create: (payload) => call("bankAccounts:create", payload),
    ensureDefaultCash: () => call("bankAccounts:ensureDefaultCash"),
  },
  bankTransactions: {
    list: (payload) => call("bankTransactions:list", payload),
    dashboard: (payload) => call("bankTransactions:dashboard", payload),
    manualAdjustment: (payload) =>
      call("bankTransactions:manualAdjustment", payload),
    transfer: (payload) => call("bankTransactions:transfer", payload),
  },
  banking: {
    recordEntry: (payload) => call("banking:recordEntry", payload),
  },
  accounts: {
    dashboard: () => call("accounts:dashboard"),
    getPartyStatement: (companyName) => call("accounts:getPartyStatement", { companyName }),
    incomeLedger: () => call("accounts:incomeLedger"),
  },
  gst: {
    list: (payload = {}) => call("gst:list", payload),
    listGstTreatments: () => call("gst:listGstTreatments", {}),
    create: (payload) => call("gst:create", payload),
    update: (payload) => call("gst:update", payload),
    delete: (id) => call("gst:delete", { id }),
  },
  users: {
    list: () => call("users:list"),
    create: (payload) => call("users:create", payload),
    update: (payload) => call("users:update", payload),
    delete: (id) => call("users:delete", { id }),
  },
  settings: {
    list: () => call("settings:list"),

    set: (payload) => call("settings:set", payload),

    update: (payload) => call("settings:update", payload),

    get: (payload) => call("settings:get", payload),
  },
  backup: {
    list: () => call("backup:list"),
    create: (label) => call("backup:create", { label }),
    restore: (path) => call("backup:restore", { path }),
  },
  reports: {
    gst: () => call("reports:gst"),
    outstanding: () => call("reports:outstanding"),
    revenue: () => call("reports:revenue"),
    serviceIncome: () => call("reports:serviceIncome"),
    expenses: (payload) => call("reports:expenses", payload),
    purchases: (payload) => call("reports:purchases", payload),
    customerLedger: (payload) => call("reports:customerLedger", payload),
    vendorLedger: (payload) => call("reports:vendorLedger", payload),
    cashFlow: (payload) => call("reports:cashFlow", payload),
    gstSummary: (payload) => call("reports:gstSummary", payload),
    exportPdf: (payload) => call("reports:exportPdf", payload),
    exportExcel: (payload) => call("reports:exportExcel", payload),
  },
  activity: {
    list: () => call("activitylog:list"),
  },
  pdf: {
    invoice: (id, documentMode = "export") =>
      call("pdf:invoice", { id, documentMode }),
    quotation: (id, documentMode = "export") =>
      call("pdf:quotation", { id, documentMode }),
    expense: (id, documentMode = "export") =>
      call("pdf:expense", { id, documentMode }),
    purchase: (id, documentMode = "export") =>
      call("pdf:purchase", { id, documentMode }),
    purchasePaymentReceipt: (id, documentMode = "export") =>
      call("pdf:purchasePaymentReceipt", { id, documentMode }),
    bankStatement: (payload) => call("pdf:bankStatement", payload),
    paymentReceipt: (id, documentMode = "export") =>
      call(
        "pdf:paymentReceipt",
        typeof id === "object" && id !== null
          ? { ...id, documentMode }
          : { id, documentMode },
      ),
    recurring: (id, documentMode = "export") =>
      call(
        "pdf:recurring",
        typeof id === "object" && id !== null
          ? { ...id, documentMode }
          : { id, documentMode },
      ),
    recurringPlan: (payload, documentMode = "export") =>
      call("pdf:recurringPlan", { ...payload, documentMode }),
    recurringInvoice: (historyId, documentMode = "export") =>
      call(
        "pdf:recurringInvoice",
        typeof historyId === "object" && historyId !== null
          ? { ...historyId, documentMode }
          : { historyId, documentMode },
      ),
  },
  numbering: {
    nextQuotationNo: (date) => call("numbering:nextQuotationNo", { date }),
    nextInvoiceNo: (date) => call("numbering:nextInvoiceNo", { date }),
    nextBillNo: (date) => call("numbering:nextBillNo", { date }), // Re-add this
    nextExpenseNo: (date) => call("numbering:nextExpenseNo", { date }), // Re-add this
    nextRecurringInvoiceNo: (date) =>
      call("numbering:nextRecurringInvoiceNo", { date }),
  },
};

function crud(name) {
  return {
    list: (payload = {}) => call(`${name}:list`, payload),
    get: (id) => call(`${name}:get`, { id }),
    create: (payload) => call(`${name}:create`, payload),
    update: (payload) => call(`${name}:update`, payload),
    delete: (id) => call(`${name}:delete`, { id }),
  };
}
