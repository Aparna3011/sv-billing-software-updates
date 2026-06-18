const { formatISO } = require('date-fns');
const { getDb } = require('../db/database');
const numbering = require('./numbering.service');
const { totalsForItems, discountPct01, ensureService } = require('./gst.service');
const invoices = require('./invoice.service');
const activity = require('./activitylog.service');

function normalizeDescriptionPoints(points = []) {
  return points
    .map(point => (typeof point === 'string' ? point : point?.point_text || ''))
    .map(point => point.trim())
    .filter(point => point && point !== '[object Object]');
}

function createQuotation(payload) {
  const db = getDb();
  return db.transaction(() => {
    const customer = db.prepare('SELECT * FROM contacts WHERE id = ? AND is_deleted = 0 AND is_customer = 1').get(payload.contact_id);
    if (!customer) throw new Error('Customer not found');
    const company = db.prepare('SELECT * FROM company WHERE id = 1').get();
    const quotationDate = payload.quotation_date || formatISO(new Date(), { representation: 'date' });
    const outgoingSetting = db.prepare("SELECT value FROM settings WHERE key = 'gst_enabled_outgoing'").get();
    const isGstEnabled = payload.is_gst_enabled !== undefined ? (payload.is_gst_enabled ? 1 : 0) : (outgoingSetting?.value !== '0' ? 1 : 0);

    const pct = discountPct01(payload, null);
    const totals = totalsForItems(payload.items || [], company, customer, payload.discount || 0, pct === 1, isGstEnabled === 1);
    const quotationNo = payload.quotation_no || numbering.nextQuotationNo(new Date(quotationDate)); // This is fine
    const info = db.prepare(`
      INSERT INTO quotations (quotation_no, contact_id, quotation_date, valid_until, status, is_gst_enabled, subtotal, discount, discount_is_percent, tax_total, grand_total, round_off, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(quotationNo, payload.contact_id, quotationDate, payload.valid_until || null, payload.status || 'draft', isGstEnabled, totals.subtotal, payload.discount || 0, pct, totals.taxTotal, totals.grandTotal, totals.roundOff, payload.notes || '');
    totals.items.forEach(item => {
      const itemResult = db.prepare(`
        INSERT INTO quotation_items (quotation_id, service_id, name, description, sac_code, qty, billing_type, rate, gst_rate, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(info.lastInsertRowid, ensureService(db, item), item.name, item.description || '', item.sac_code || " ", item.qty || 1, item.billing_type || 'Service', item.rate || 0, item.gst_rate ?? null, item.line_total);

      normalizeDescriptionPoints(item.descriptionPoints || [])
        .forEach((point, index) => {
          db.prepare(`
            INSERT INTO description_points (
              quotation_item_id,
              point_order,
              point_text
            )
            VALUES (?, ?, ?)
          `).run(
            itemResult.lastInsertRowid,
            index + 1,
            point
          );
        });
    });
    activity.log('quotation:created', { entityType: 'quotation', entityId: info.lastInsertRowid, message: quotationNo });
    return getQuotation(info.lastInsertRowid);
  })();
}

function updateQuotation(payload) {
  const db = getDb();
  const oldData = getQuotation(payload.id);
  return db.transaction(() => {
    const quotation = getQuotation(payload.id);
    if (!quotation) throw new Error('Quotation not found');
    if (quotation.status === 'converted') throw new Error('Converted quotation cannot be edited'); // This is fine
    const customer = db.prepare('SELECT * FROM contacts WHERE id = ? AND is_deleted = 0 AND is_customer = 1').get(payload.contact_id || quotation.contact_id);
    if (!customer) throw new Error('Customer not found'); // This is fine
    const company = db.prepare('SELECT * FROM company WHERE id = 1').get();
    const isGstEnabled = payload.is_gst_enabled !== undefined ? (payload.is_gst_enabled ? 1 : 0) : (quotation.is_gst_enabled ?? 1);

    let nextStatus = payload.status || quotation.status;
    // Rule: If an accepted quotation is edited, reset it to draft
    if (quotation.status === 'accepted' && !payload.status) {
      nextStatus = 'draft';
      activity.log('quotation:status_reset', { entityType: 'quotation', entityId: payload.id, message: `Quotation ${quotation.quotation_no} reset to draft due to edit.` });
    }

    const pct = discountPct01(payload, quotation);
    const totals = totalsForItems(payload.items || quotation.items, company, customer, payload.discount || 0, pct === 1, isGstEnabled === 1);
    db.prepare(`
      UPDATE quotations SET contact_id = ?, quotation_date = ?, valid_until = ?, status = ?, is_gst_enabled = ?, discount = ?, discount_is_percent = ?, subtotal = ?, tax_total = ?, grand_total = ?, round_off = ?, notes = ?
      WHERE id = ?
    `).run(
      payload.contact_id || quotation.contact_id,
      payload.quotation_date || quotation.quotation_date,
      payload.valid_until || null,
      nextStatus,
      isGstEnabled,
      payload.discount || 0,
      pct,
      totals.subtotal,
      totals.taxTotal,
      totals.grandTotal,
      totals.roundOff,
      payload.notes || '',
      payload.id
    );
    
     db.prepare(`
  DELETE FROM description_points
  WHERE quotation_item_id IN (
    SELECT id
    FROM quotation_items
    WHERE quotation_id = ?
  )
`).run(payload.id);
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(payload.id);
   totals.items.forEach(item => {

  const itemResult = db.prepare(`
    INSERT INTO quotation_items (
      quotation_id,
      service_id,
      name,
      description,
      sac_code,
      qty,
      billing_type,
      rate,
      gst_rate,
      line_total
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.id,
    ensureService(db, item),
    item.name,
    item.description || '',
    item.sac_code || '',
    item.qty || 1,
    item.billing_type || 'Service',
    item.rate || 0,
    item.gst_rate ?? null,
    item.line_total
  );

  const quotationItemId =
    itemResult.lastInsertRowid;

  normalizeDescriptionPoints(item.descriptionPoints || [])
    .forEach((point, index) => {

      db.prepare(`
        INSERT INTO description_points (
          quotation_item_id,
          point_order,
          point_text
        )
        VALUES (?, ?, ?)
      `).run(
        quotationItemId,
        index + 1,
        point
      );

    });

});
    const newData =
  getQuotation(payload.id);

activity.log(
  'quotation:updated',
  {
    entityType: 'quotation',
    entityId: payload.id,
    message: quotation.quotation_no,

    oldData,
    newData,
  }
);
    return getQuotation(payload.id);
  })();
}

function getQuotation(id) {
  const db = getDb();
  const quotation = db.prepare(`
  SELECT
    q.*,
    c.company_name,
    c.email,
    c.phone,
    c.gstin,
    c.address,
    c.city,
    c.state,
    c.country,
    c.gst_treatment,
    company.state AS company_state
  FROM quotations q
  JOIN contacts c ON c.id = q.contact_id AND c.is_customer = 1
  LEFT JOIN company ON company.id = 1
  WHERE q.id = ?
`).get(id);

if (!quotation) return null;

  quotation.document_no = quotation.quotation_no;
  quotation.document_date = quotation.quotation_date;
  quotation.due_date = quotation.valid_until;

  quotation.items = db.prepare(`
    SELECT *
    FROM quotation_items
    WHERE quotation_id = ?
  `).all(id);

(quotation.items || []).forEach(item => {

  item.descriptionPoints =
    db.prepare(`
      SELECT *
      FROM description_points
      WHERE quotation_item_id = ?
      ORDER BY point_order
    `).all(item.id);

});
  return quotation;
}

module.exports = { createQuotation, updateQuotation, getQuotation };
