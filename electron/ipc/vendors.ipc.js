const { getDb } = require("../db/database");
const { ok, insert, update } = require("./helpers");

const allowed = [
  "company_name",
  "contact_person",
  "phone",
  "email",
  "gstin",
  "address",
  "city",
  "state",
  "country",
  "opening_balance",
  "current_balance",
  "payment_terms",
  "notes",
  "is_vendor",
  "is_customer",
];

function normalize(data, isUpdate = false) {
  const clean = { ...data };
  clean.company_name = String(clean.company_name || "").trim();

  clean.opening_balance = Number(clean.opening_balance || 0);
  clean.current_balance =
    clean.current_balance === undefined
      ? clean.opening_balance
      : Number(clean.current_balance || 0);
  clean.payment_terms = Number(clean.payment_terms || 15);

  if (!clean.company_name) throw new Error("Vendor name is required");
  return clean;
}

module.exports = (ipcMain) => {
  ipcMain.handle(
    "vendors:list",
    ok(() =>
      getDb()
        .prepare(
          `
          SELECT
            v.id, v.company_name, v.contact_person, v.email, v.phone, v.gstin, v.address, v.city, v.state, v.country, v.payment_terms, v.opening_balance, v.notes, v.is_active, v.is_deleted, v.created_at, v.updated_at,
            ROUND(
              v.opening_balance +
              IFNULL((
                SELECT SUM(p.balance_due)
                FROM purchases p
                WHERE p.contact_id = v.id
                  AND p.is_deleted = 0
              ), 0), 
              2
            ) AS current_balance -- This calculation is for the vendor's balance, not the contact's global balance
          FROM contacts v
          WHERE v.is_vendor = 1 AND v.is_deleted = 0
          ORDER BY company_name
        `,
        )
        .all(),
    ),
  );

  ipcMain.handle(
    "vendors:get",
    ok(
      ({ id }) =>
        getDb()
          .prepare("SELECT * FROM contacts WHERE id = ? AND is_vendor = 1")
          .get(id), // MUST CHANGE
    ),
  );

  ipcMain.handle(
    "vendors:create",
    ok((data) => {
      const db = getDb();
      const normalized = normalize(data, false);
      const existing = db.prepare('SELECT id FROM contacts WHERE TRIM(LOWER(company_name)) = LOWER(?)').get(normalized.company_name);

      if (existing) {
        // Update existing record to be a vendor, preserving is_customer if it was 1
        const row = update('contacts', existing.id, { ...normalized, is_vendor: 1 }, allowed);
        return row;
      }

      return insert(
        "contacts",
        {
          ...normalized,
          is_vendor: 1,
          is_customer: 0,
        },
        allowed,
      );
    }),
  );

  ipcMain.handle(
    "vendors:update",
    ok(({ id, ...data }) => {
      const db = getDb();
      console.log("[Backend] Vendor Update Request - ID:", id);
      console.log("[Backend] Raw Incoming Data:", data);

      // Fetch existing record to verify state before update
      const existing = db
        .prepare("SELECT id FROM contacts WHERE id = ? AND is_vendor = 1")
        .get(id); // MUST CHANGE
      if (!existing) throw new Error("Vendor not found");

      const normalized = normalize(data, true); // This is fine
      console.log("[SQL] Final Update Payload (excluding ID):", normalized);

      try {
        const result = update("contacts", id, normalized, allowed);
        console.log("[Backend] Update successful for ID:", id);
        return result;
      } catch (error) {
        console.error("[Backend] Vendor Update CRASHED!");
        console.error("[Backend] Error Message:", error.message); // Error message will no longer reference vendor_code
        throw error;
      }
    }),
  );

  ipcMain.handle(
    "vendors:delete",
    ok(({ id }) =>
      getDb()
        .prepare("UPDATE contacts SET is_deleted = 1 WHERE id = ?")
        .run(id),
    ),
  );
};
