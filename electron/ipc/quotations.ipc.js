const { getDb } = require("../db/database");
const { ok } = require("./helpers");
const quotations = require("../services/quotation.service");
const activity = require("../services/activitylog.service");

module.exports = (ipcMain) => {
  ipcMain.handle(
    "quotations:list",
    ok(() =>
      getDb()
        .prepare(
          `
    SELECT
      q.*,
      c.company_name,
      c.contact_person,

      (
        SELECT GROUP_CONCAT(name, '||')
        FROM (
          SELECT qi.name
          FROM quotation_items qi
          WHERE qi.quotation_id = q.id
          LIMIT 3
        )
      ) AS service_items

    FROM quotations q
    JOIN contacts c ON c.id = q.contact_id

    WHERE q.is_deleted = 0

    ORDER BY q.id DESC
  `,
        )
        .all(),
    ),
  );
  ipcMain.handle(
    "quotations:get",
    ok(({ id }) => quotations.getQuotation(id)),
  );
  ipcMain.handle(
    "quotations:create",
    ok((payload) => quotations.createQuotation(payload)),
  );
  ipcMain.handle(
    "quotations:update",
    ok((payload) => quotations.updateQuotation(payload)),
  );
  ipcMain.handle(
    "quotations:approve",
    ok(({ id }) => {
      getDb()
        .prepare(
          "UPDATE quotations SET status = 'accepted' WHERE id = ? AND status != 'converted'",
        )
        .run(id);
      activity.log("quotation:approved", {
        entityType: "quotation",
        entityId: id,
      });
      return quotations.getQuotation(id);
    }),
  );
  ipcMain.handle(
    "quotations:reject",
    ok(({ id }) => {
      getDb()
        .prepare(
          "UPDATE quotations SET status = 'declined' WHERE id = ? AND status != 'converted'",
        )
        .run(id);
      activity.log("quotation:rejected", {
        entityType: "quotation",
        entityId: id,
      });
      return quotations.getQuotation(id);
    }),
  );
  ipcMain.handle(
    "quotations:delete",
    ok(({ id }) =>
      getDb()
        .prepare("UPDATE quotations SET is_deleted = 1 WHERE id = ?")
        .run(id),
    ),
  );
};
