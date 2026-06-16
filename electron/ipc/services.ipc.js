const { getDb } = require('../db/database');
const { ok, insert, update } = require('./helpers');
const allowed = ['name', 'description', 'sac_code', 'billing_type', 'rate', 'gst_rate', 'category'];
const activity =
  require('../services/activitylog.service');

module.exports = ipcMain => {
  ipcMain.handle(
  'services:list',
  ok(() => {

    const db = getDb();

    const services = db
      .prepare(`
        SELECT *
        FROM services
        WHERE is_deleted = 0
        ORDER BY name
      `)
      .all();

    services.forEach(service => {

      service.descriptionPoints =
        db.prepare(`
          SELECT *
          FROM description_points
          WHERE service_id = ?
          ORDER BY point_order
        `).all(service.id);

    });

    return services;

  })
);
  ipcMain.handle('services:get', ok(({ id }) => getDb().prepare('SELECT * FROM services WHERE id = ?').get(id)));
  ipcMain.handle('services:create', ok(data => {

  const db = getDb();

  // INSERT SERVICE
  const result =
    insert(
      'services',
      data,
      allowed
    );

  const serviceId =
    result.lastInsertRowid;

  // INSERT DESCRIPTION POINTS
  (data.descriptionPoints || [])
    .forEach((point, index) => {

      db.prepare(`
        INSERT INTO description_points (
          service_id,
          point_order,
          point_text
        )
        VALUES (?, ?, ?)
      `).run(
        serviceId,
        index + 1,
        point
      );

    });

  return result;

}));
  ipcMain.handle(
  'services:update',
  ok(({ id, ...data }) => {

    const db = getDb();

    // OLD DATA
    const oldData =
      db.prepare(`
        SELECT *
        FROM services
        WHERE id = ?
      `).get(id);

    // UPDATE SERVICE
    const result =
      update(
        'services',
        id,
        data,
        allowed
      );

    // DELETE OLD POINTS
    db.prepare(`
      DELETE FROM description_points
      WHERE service_id = ?
    `).run(id);

    // INSERT NEW POINTS
    (data.descriptionPoints || [])
      .forEach((point, index) => {

        db.prepare(`
          INSERT INTO description_points (
            service_id,
            point_order,
            point_text
          )
          VALUES (?, ?, ?)
        `).run(
          id,
          index + 1,
          point
        );

      });

    // NEW DATA
    const newData =
      db.prepare(`
        SELECT *
        FROM services
        WHERE id = ?
      `).get(id);

    // LOAD NEW DESCRIPTION POINTS
    newData.descriptionPoints =
      db.prepare(`
        SELECT *
        FROM description_points
        WHERE service_id = ?
        ORDER BY point_order
      `).all(id);

      activity.log(
  'service:updated',
  {
    entityType: 'service',
    entityId: id,
    message: 'Service updated',

    oldData,
    newData,
  }
);

    return result;

  })
);
  ipcMain.handle('services:delete', ok(({ id }) => getDb().prepare('UPDATE services SET is_deleted = 1 WHERE id = ?').run(id)));
};
