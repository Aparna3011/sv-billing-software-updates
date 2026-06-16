const { getDb } = require('../db/database');

function log(
  action,
  {
    actorUserId = null,
    entityType = null,
    entityId = null,
    message = '',
    oldData = null,
    newData = null,
  } = {}
) {

  getDb().prepare(`
    INSERT INTO activity_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      message,
      old_data,
      new_data
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    actorUserId,
    action,
    entityType,
    entityId,
    message,

    oldData
      ? JSON.stringify(oldData)
      : null,

    newData
      ? JSON.stringify(newData)
      : null
  );

}

module.exports = { log };