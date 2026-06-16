const numbering = require("../services/numbering.service");
const { ok } = require("./helpers");

const dateFromPayload = (payload = {}) => new Date(payload.date || new Date());

module.exports = (ipcMain) => {
  ipcMain.handle(
    "numbering:nextQuotationNo",
    ok((payload) => numbering.nextQuotationNo(dateFromPayload(payload))),
  );
  ipcMain.handle(
    "numbering:nextInvoiceNo",
    ok((payload) => numbering.nextInvoiceNo(dateFromPayload(payload))),
  );
  ipcMain.handle(
    "numbering:nextBillNo",
    ok((payload) => numbering.nextBillNo(dateFromPayload(payload))),
  );
  ipcMain.handle( // Add missing handler for nextExpenseNo
    "numbering:nextExpenseNo",
    ok((payload) => numbering.nextExpenseNo(dateFromPayload(payload))),
  );
  ipcMain.handle(
    "numbering:nextRecurringInvoiceNo",

    ok((payload) => numbering.nextRecurringInvoiceNo(dateFromPayload(payload))),
  );
};
