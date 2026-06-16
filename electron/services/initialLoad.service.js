const { getDb } = require("../db/database");

async function checkDatabase() {
  try {
    console.log("Checking database...");

    const db = getDb();

    db.prepare(
      `
      SELECT 1
    `,
    ).get();
  } catch (error) {
    console.error("Database check failed:", error.message);
  }
}

async function generateRecurringInvoices() {
  try {
    console.log("Generating recurring invoices...");

    generateDueInvoices();
  } catch (error) {
    console.error("Recurring invoice failed:", error.message);
  }
}

const {
  refreshRecurringStatuses,
  generateDueInvoices,
} = require("../services/recurring.service");

async function refreshRecurringOverdue() {
  try {
    console.log("Refreshing recurring overdue statuses...");

    await refreshRecurringStatuses();
  } catch (error) {
    console.error("Recurring status refresh failed:", error.message);
  }
}

async function initialLoad() {
  try {
    console.log("Initial load started...");

    await checkDatabase();

    await refreshRecurringOverdue();

    await generateRecurringInvoices();

    console.log("Initial load completed");
  } catch (error) {
    console.error("Initial load failed:", error.message);
  }
}

module.exports = {
  initialLoad,
};
