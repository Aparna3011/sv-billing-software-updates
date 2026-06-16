function calculateGst({ companyState, customerState, gstTreatment, subtotal, gstRate }) {
  if (gstTreatment === 'overseas' || Number(gstRate) === 0) {
    return { cgst: 0, sgst: 0, igst: 0, taxTotal: 0 };
  }
  const taxTotal = round(Number(subtotal || 0) * Number(gstRate || 0) / 100);
  if (String(companyState || '').toLowerCase() === String(customerState || '').toLowerCase()) {
    const cgst = round(taxTotal / 2);
    return { cgst, sgst: round(taxTotal - cgst), igst: 0, taxTotal };
  }
  return { cgst: 0, sgst: 0, igst: taxTotal, taxTotal };
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Returns rupee discount for the given mode (whole document, before GST sum). Percent is capped at 100. */
function computeDiscountAmount(subtotal, discount = 0, discountIsPercent = false) {
  const s = round(Number(subtotal) || 0);
  const raw = Number(discount);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (discountIsPercent) {
    const p = Math.min(Math.max(raw, 0), 100);
    return round(Math.min((s * p) / 100, s));
  }
  return round(Math.min(raw, s));
}

/**
 * Document-level discount is spread across lines by value share; GST is computed on each line's
 * post-discount taxable amount (matches quotation/invoice form + PDF summary).
 */
function totalsForItems(items, company, customer, discount = 0, discountIsPercent = false, isGstEnabled = true) {
  const subtotal = round(items.reduce((sum, item) => sum + Number(item.qty || 1) * Number(item.rate || 0), 0));
  const discountAmount = computeDiscountAmount(subtotal, discount, !!discountIsPercent);
  const taxable = Math.max(0, subtotal - discountAmount);

  const bases = items.map(item => round(Number(item.qty || 1) * Number(item.rate || 0)));
  const n = items.length;
  let allocatedRunning = 0;
  const allocations = bases.map((base, i) => {
    if (n === 0 || discountAmount <= 0) return 0;
    if (i === n - 1) return round(Math.max(0, discountAmount - allocatedRunning));
    const alloc = subtotal > 0 ? round(discountAmount * (base / subtotal)) : 0;
    allocatedRunning = round(allocatedRunning + alloc);
    return alloc;
  });

  const enriched = items.map((item, idx) => {
    const base = bases[idx];
    const allocatedDiscount = allocations[idx];
    const taxableLine = Math.max(0, round(base - allocatedDiscount));
    const effectiveGstRate = isGstEnabled ? (item.gst_rate ?? 0) : 0;
    const tax = calculateGst({
      companyState: company.state,
      customerState: customer.state,
      gstTreatment: customer.gst_treatment,
      subtotal: taxableLine,
      gstRate: effectiveGstRate
    });
    return { ...item, gst_rate: effectiveGstRate, line_total: base, ...tax };
  });
  const cgst = round(enriched.reduce((sum, item) => sum + item.cgst, 0));
  const sgst = round(enriched.reduce((sum, item) => sum + item.sgst, 0));
  const igst = round(enriched.reduce((sum, item) => sum + item.igst, 0));
  const taxTotal = round(cgst + sgst + igst);
  const exactTotal = round(taxable + taxTotal);
  const grandTotal = Math.round(exactTotal);
  const roundOff = round(grandTotal - exactTotal);
  return { items: enriched, subtotal, taxable, cgst, sgst, igst, taxTotal, exactTotal, roundOff, grandTotal };
}

function isTruthyPct(v) {
  if (v === true) return true;
  const n = Number(v);
  if (n === 1) return true;
  const s = typeof v === 'string' ? v.trim() : '';
  if (s === '1' || s.toLowerCase() === 'true') return true;
  return false;
}

/** From API payload (+ optional DB row fallback). 1 = percentage, 0 = rupee amount. */
function discountPct01(payload = {}, fallback = {}) {
  const v = payload.discount_is_percent;
  if (v !== undefined && v !== null && v !== '') {
    return isTruthyPct(v) ? 1 : 0;
  }
  if (fallback.discount_is_percent != null && fallback.discount_is_percent !== '')
    return isTruthyPct(fallback.discount_is_percent) ? 1 : 0;
  return 0;
}

/**
 * Reuses an existing service by name or creates a new one in the master table.
 * Prevents duplication and ensures immediate availability in future dropdowns.
 */
function ensureService(db, item) {
  if (item.service_id) return item.service_id;
  if (!item.name || !item.name.trim()) return null;

  const name = item.name.trim();
  // Requirement 7: Case-insensitive and trimmed comparison
  const existing = db.prepare("SELECT id FROM services WHERE TRIM(LOWER(name)) = LOWER(?) LIMIT 1").get(name);

  if (existing) {
    // Requirement 3: Reuse existing and ensure it's active
    db.prepare("UPDATE services SET is_deleted = 0 WHERE id = ?").run(existing.id);
    return existing.id;
  }

  // Requirement 4 & 5: Automatically create new service record
  const info = db.prepare(`
    INSERT INTO services (name, description, sac_code, billing_type, rate, gst_rate, category)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    item.description || "",
    item.sac_code || "998314",
    item.billing_type || "Fixed Price",
    Number(item.rate || 0),
    Number(item.gst_rate || 18),
    item.category || "Software Service"
  );
  return info.lastInsertRowid;
}

function listGstTreatments() {
  return [
    { value: 'registered', label: 'Registered Business' },
    { value: 'unregistered', label: 'Unregistered Business' },
    { value: 'consumer', label: 'Consumer' },
    { value: 'overseas', label: 'Overseas' },
  ];
}

module.exports = { calculateGst, totalsForItems, computeDiscountAmount, discountPct01, round, ensureService, listGstTreatments };
