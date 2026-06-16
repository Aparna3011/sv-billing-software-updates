const { ok } = require("./helpers");
const purchases = require("../services/purchase.service");

module.exports = (ipcMain) => {
  ipcMain.handle("purchases:list", ok(() => purchases.listPurchases()));
  ipcMain.handle("purchases:dashboard", ok(() => purchases.purchaseDashboard()));
  ipcMain.handle("purchases:get", ok(({ id }) => purchases.getPurchase(id)));
  ipcMain.handle("purchases:create", ok((payload) => purchases.createPurchase(payload)));
  ipcMain.handle(
    "purchases:update",
    ok((payload) => purchases.updatePurchase(payload)),
  );
  ipcMain.handle(
    "purchases:recordPayment",
    ok((payload) => purchases.recordPurchasePayment(payload)),
  );
  ipcMain.handle("purchases:delete", ok(({ id }) => purchases.deletePurchase(id)));
};
