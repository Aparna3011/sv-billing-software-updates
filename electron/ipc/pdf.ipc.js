const fs = require("fs");
const path = require("path");
const React = require("react");
const QRCode = require("qrcode");

const { pdf } = require("@react-pdf/renderer");

const { getExportsDir } = require("../utils/appPaths");
const { getDb } = require("../db/database");
const { ok } = require("./helpers");
const recurring = require("../services/recurring.service");

const InvoicePDF = require("../../src/components/pdf/InvoicePDF.jsx").default;
const PDFHeader =
  require("../../src/components/pdf/components/PDFHeader.jsx").default;
const { pdfStyles } = require("../../src/components/pdf/pdfStyles.js");

const QuotationPDF =
  require("../../src/components/pdf/QuotationPDF.jsx").default;
const RecurringBillingPDF =
  require("../../src/components/pdf/RecurringBillingPDF.jsx").default;
const PurchaseBillPDF =
  require("../../src/components/pdf/PurchaseBillPDF.jsx").default;
const ExpenseVoucherPDF =
  require("../../src/components/pdf/ExpenseVoucherPDF.jsx").default;
const PaymentReceiptPDF =
  require("../../src/components/pdf/PaymentReceiptPDF.jsx").default;
const { round } = require("../services/gst.service"); // Import round function for consistent rounding

function roundAmount(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function toSafeFileName(name) {
  return String(name || "").replace(/[/\\:*?"<>|]/g, "-");
}

async function getPdfBuffer(document) {
  const pdfInstance = pdf(document);
  const stream = await pdfInstance.toBuffer();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function processPdfOutput(file, documentMode, shell) {
  console.log(
    `[PDF IPC] processPdfOutput: documentMode received = "${documentMode}"`,
  );

  if (documentMode === "print") {
    console.log("[PDF IPC] Opening PDF in system viewer for print preview");

    // Opens PDF in Edge / Adobe / default PDF viewer
    await shell.openPath(file);

    return;
  }

  console.log("[PDF IPC] Entering export branch");
  await shell.openPath(file);
}

module.exports = (ipcMain, _getWindow, shell) => {
  // =========================================
  // INVOICE PDF
  // =========================================

  ipcMain.handle(
    "pdf:invoice",
    ok(async ({ id, documentMode = "export" }) => {
      let invoice = getInvoice(id);

      // FORCE RECALCULATE
      invoice.balance_due =
        Number(invoice.grand_total || 0) - Number(invoice.paid_amount || 0);

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const company = getDb()
        .prepare("SELECT * FROM company WHERE id = 1")
        .get();

      let qrSrc = null;

      if (company.upi_id) {
        const paidNow = Number(invoice.paid_now || 0).toFixed(2);

        const upiString =
          `upi://pay?pa=${company.upi_id}` +
          `&pn=${encodeURIComponent(company.name || "Business")}` +
          `&am=${paidNow}` +
          `&cu=INR` +
          `&tn=${encodeURIComponent(invoice.invoice_no)}`;

        qrSrc = await QRCode.toDataURL(upiString);
      }

      const document = React.createElement(InvoicePDF, {
        invoice,
        company,
        qrSrc,
        title: "INVOICE",
        documentMode,
      });

      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `invoice_${toSafeFileName(invoice.invoice_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);

      // WRITE FILE
      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);

      return file;
    }),
  );

  // =========================================
  // QUOTATION PDF
  // =========================================

  ipcMain.handle(
    "pdf:quotation",
    ok(async ({ id, documentMode = "export" }) => {
      const doc = getQuotationPdfData(id);
      console.log("PRINT QUOTATION DATA", doc);

      if (!doc) {
        throw new Error("Quotation not found");
      }

      const company = getDb()
        .prepare("SELECT * FROM company WHERE id = 1")
        .get();

      const document = React.createElement(QuotationPDF, {
        quotation: doc,
        company,
        documentMode,
      });

      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `quotation_${toSafeFileName(doc.quotation_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);

      // WRITE FILE
      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);

      return file;
    }),
  );

  // =========================================
  // RECURRING INVOICE PDF (Granular Cycle-wise)
  // =========================================
  ipcMain.handle(
    "pdf:recurringInvoice",
    ok(async ({ historyId, documentMode = "export" }) => {
      const db = getDb();
      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const doc = buildRecurringDocument(db, { historyId });
      const document = React.createElement(RecurringBillingPDF, {
        recurring: doc,
        company,
        qrSrc: await buildUpiQr(company, doc),
        title: "RECURRING INVOICE",
        documentMode,
      });

      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `${toSafeFileName(doc.generated_invoice_no || doc.invoice_no || doc.plan_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);

      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  // =========================================
  // PAYMENT RECEIPT PDF (Reuses Invoice Layout)
  // =========================================
  ipcMain.handle(
    "pdf:paymentReceipt",
    ok(async ({ id, documentMode = "export" }) => {
      const db = getDb();
      const payment = db
        .prepare("SELECT * FROM incoming_payments WHERE id = ?")
        .get(id);

      if (!payment) throw new Error("Payment record not found");

      let invoice;
      if (payment.invoice_id) {
        invoice = getInvoice(payment.invoice_id);
        if (invoice?.is_recurring) {
          const history =
            latestHistoryForPayment(db, id) ||
            db
              .prepare(
                `
                SELECT *
                FROM recurring_invoice_history
                WHERE recurring_invoice_id = ?
                  AND invoice_start_date = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
              `,
              )
              .get(invoice.recurring_id, invoice.invoice_date);

          invoice.plan_id = invoice.recurring_id;
          invoice.generated_invoice_no = invoice.invoice_no;
          invoice.against_invoice_no = invoice.invoice_no;
          invoice.invoice_start_date =
            history?.invoice_start_date || invoice.invoice_date;
          invoice.next_invoice_date =
            history?.next_invoice_date || invoice.due_date;
          invoice.payment_status = history?.collection_status || invoice.status;
          invoice.status = history?.collection_status || invoice.status;
          invoice.balance_due =
            history?.pending_amount !== undefined
              ? Number(history.pending_amount || 0)
              : Number(invoice.balance_due || 0);
          invoice.total_paid =
            history?.paid_amount !== undefined
              ? Number(history.paid_amount || 0)
              : Number(invoice.total_paid || 0);
          invoice.paid_amount = invoice.total_paid;
          invoice.billing_cycle_label = billingCycleLabel(
            invoice.billing_cycle,
          );
        }
      } else if (payment.recurring_invoice_id) {
        invoice = buildRecurringDocument(db, { paymentId: id });
      }

      if (!invoice)
        throw new Error("Associated invoice or recurring plan not found");

      invoice.document_no = payment.payment_no;
      invoice.document_date = payment.payment_date;
      invoice.is_payment_receipt = 1;
      invoice.payment_no = payment.payment_no;
      invoice.payment_date = payment.payment_date;
      invoice.paid_now = Number(payment.amount || 0);
      invoice.paid_amount = Number(
        invoice.paid_amount || invoice.total_paid || payment.amount || 0,
      );
      invoice.payment_mode = payment.mode;
      invoice.mode = payment.mode;
      if (payment.notes) invoice.notes = payment.notes;

      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();

      const document = React.createElement(PaymentReceiptPDF, {
        payment: invoice,
        company,
        title: "PAYMENT RECEIPT",
        partyTitle: "Received From",
        documentMode,
      });

      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `receipt_${toSafeFileName(payment.payment_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);

      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  // =========================================
  // ACCOUNTING PDFS
  // =========================================
  ipcMain.handle(
    "pdf:expense",
    ok(async ({ id, documentMode = "export" }) => {
      const db = getDb();
      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const expense = buildExpenseDocument(db, id);
      const document = React.createElement(ExpenseVoucherPDF, {
        expense,
        company,
        documentMode,
      });
      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `expense_${toSafeFileName(expense.document_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);
      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  ipcMain.handle(
    "pdf:purchase",
    ok(async ({ id, documentMode = "export" }) => {
      const db = getDb();
      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const purchase = buildPurchaseDocument(db, id);
      const document = React.createElement(PurchaseBillPDF, {
        purchase,
        company,
        documentMode,
      });
      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `purchase_${toSafeFileName(purchase.document_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);
      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  ipcMain.handle(
    "pdf:purchasePaymentReceipt",
    ok(async ({ id, documentMode = "export" }) => {
      const db = getDb();
      const payment = db
        .prepare("SELECT * FROM outgoing_payments WHERE id = ?")
        .get(id);
      if (!payment) throw new Error("Purchase payment not found");
      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const isExpense = Boolean(payment.expense_id);
      const doc = isExpense
        ? buildExpenseDocument(db, payment.expense_id)
        : buildPurchaseDocument(db, payment.purchase_id);

      doc.document_no = payment.payment_no;
      doc.document_date = payment.payment_date;
      doc.paid_now = Number(payment.amount || 0);
      doc.payment_no = payment.payment_no;
      doc.payment_date = payment.payment_date;
      doc.payment_mode = payment.mode;
      doc.notes = payment.notes || doc.notes;

      const document = React.createElement(PaymentReceiptPDF, {
        payment: doc,
        company,
        title: isExpense
          ? "EXPENSE PAYMENT RECEIPT"
          : "PURCHASE PAYMENT RECEIPT",
        partyTitle: "Paid To",
        documentMode,
      });
      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `purchase_receipt_${toSafeFileName(payment.payment_no)}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);
      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  ipcMain.handle(
    "pdf:bankStatement",
    ok(async ({ bank_account_id, documentMode = "export" } = {}) => {
      const db = getDb();
      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const rows = db
        .prepare(
          `
          SELECT bt.*, ba.account_name, ba.bank_name
          FROM bank_transactions bt
          LEFT JOIN bank_accounts ba ON ba.id = bt.bank_account_id
          WHERE (? IS NULL OR bt.bank_account_id = ?)
          ORDER BY bt.transaction_date, bt.id
        `,
        )
        .all(bank_account_id || null, bank_account_id || null);

      const title = "BANK STATEMENT";
      const { Document, Page, Text, View } = require("@react-pdf/renderer");
      const document = React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: "A4", style: pdfStyles.page },
          React.createElement(PDFHeader, { title, company }),
          React.createElement(
            View,
            { style: { marginTop: 16 } },
            rows.map((row) =>
              React.createElement(
                Text,
                { key: row.id, style: { fontSize: 9, marginBottom: 5 } },
                `${row.transaction_date} | ${row.account_name || ""} | ${row.source_type || ""} | ${row.reference_no || ""} | Debit ${row.type === "debit" ? row.amount : 0} | Credit ${row.type === "credit" ? row.amount : 0} | Balance ${row.balance_after}`,
              ),
            ),
          ),
        ),
      );
      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(exportsDir, "bank_statement.pdf");
      const pdfBuffer = await getPdfBuffer(document);
      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  // =========================================
  // RECURRING PLAN PDF (Plan-wise)
  // =========================================
  ipcMain.handle(
    "pdf:recurringPlan",
    ok(async ({ id, templateId, documentMode = "export" }) => {
      const db = getDb();
      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const invoice = buildRecurringDocument(db, {
        recurringId: id,
        templateId,
      });

      const document = React.createElement(RecurringBillingPDF, {
        recurring: invoice,
        company,
        qrSrc: await buildUpiQr(company, invoice),
        title: "RECURRING BILLING",
        documentMode,
      });

      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const file = path.join(
        exportsDir,
        `${toSafeFileName(invoice.plan_no || `REC-${id}`)}_PLAN-${templateId}.pdf`,
      );
      const pdfBuffer = await getPdfBuffer(document);

      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);
      return file;
    }),
  );

  // =========================================
  // RECURRING BILLING PDF
  // =========================================

  ipcMain.handle(
    "pdf:recurring",
    ok(async ({ id, templateId, documentMode = "export" }) => {
      const db = getDb();

      let recurringData;
      let templates;

      if (templateId) {
        // Performance Optimization: Load only required plan and its customer header
        recurringData = db
          .prepare(
            `
SELECT r.*,
       c.company_name,
       c.contact_person,
       c.email,
       c.phone,
       c.gstin,
       c.address,
       c.city,
       c.state,
       c.gst_treatment,
       c.country,
       co.state as company_state
       FROM recurring r
          JOIN contacts c ON c.id = r.contact_id
          CROSS JOIN company co ON co.id = 1
          WHERE r.id = ?
        `,
          )
          .get(id);

        const template = db
          .prepare(`SELECT * FROM recurring_invoices WHERE id = ?`)
          .get(templateId);
        if (template) {
          template.items = db
            .prepare(
              `SELECT * FROM recurring_items WHERE recurring_invoice_id = ?`,
            )
            .all(templateId);
          const lastH = db
            .prepare(
              `
            SELECT collection_status, next_invoice_date, pending_amount, paid_amount 
            FROM recurring_invoice_history 
            WHERE recurring_invoice_id = ? 
            ORDER BY id DESC LIMIT 1
          `,
            )
            .get(templateId);
          template.status = lastH?.collection_status || "pending";
          template.next_invoice_date =
            lastH?.next_invoice_date || template.start_date;
          template.pending_amount =
            lastH?.pending_amount ?? template.grand_total;
          template.paid_amount = lastH?.paid_amount ?? 0;
          templates = [template];
        }
      } else {
        recurringData = recurring.getRecurring(id);
        templates = recurringData?.templates || [];
      }

      if (!recurringData) throw new Error("Recurring billing not found");

      const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
      const allItems = [];
      let subtotal = 0,
        discount_agg = 0,
        tax_total = 0,
        grand_total = 0,
        cgst_total = 0,
        sgst_total = 0,
        igst_total = 0;

      templates.forEach((t) => {
        const tSubtotal = Number(t.subtotal || 0);
        const tDiscountAmount = t.discount_is_percent
          ? (tSubtotal * Number(t.discount || 0)) / 100
          : Number(t.discount || 0);

        const items = (t.items || []).map((item) => {
          let descriptionPoints =
            item.descriptionPoints && item.descriptionPoints.length > 0
              ? item.descriptionPoints
              : item.service_id
                ? db
                    .prepare(
                      "SELECT * FROM description_points WHERE service_id = ? ORDER BY point_order",
                    )
                    .all(item.service_id)
                : [];

          if (!descriptionPoints || descriptionPoints.length === 0) {
            descriptionPoints = String(item.description || "")
              .split("\n")
              .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
              .filter(Boolean)
              .map((text) => ({ point_text: text }));
          }

          return {
            ...item,
            descriptionPoints,
            name:
              templates.length > 1 && t.billing_cycle
                ? `${item.name} (${t.billing_cycle.replace("_", " ")})`
                : item.name,
          };
        });

        allItems.push(...items);
        subtotal += tSubtotal;
        discount_agg += tDiscountAmount;
        tax_total += Number(t.tax_total || 0);
        grand_total += Number(t.grand_total || 0);
        cgst_total += Number(t.cgst_total || 0);
        sgst_total += Number(t.sgst_total || 0);
        igst_total += Number(t.igst_total || 0);
      });

      let totalPaidAcrossActiveCycles = 0;
      let totalPendingAcrossActiveCycles = 0;
      let overallCollectionStatus = "pending";

      // Aggregate paid/pending status for the summary section
      templates.forEach((t) => {
        if (!t.is_stopped) {
          // Identify the current cycle start date for this plan template
          let cycleStartDate = null;

          {
            // Otherwise, get the latest cycle start date from history
            const latest = db
              .prepare(
                `SELECT invoice_start_date FROM recurring_invoice_history WHERE recurring_invoice_id = ? ORDER BY id DESC LIMIT 1`,
              )
              .get(t.id);
            cycleStartDate = latest?.invoice_start_date;
          }

          // Calculate total paid by summing actual history amounts for THIS specific billing cycle
          const paymentsSum = db
            .prepare(
              `
            SELECT SUM(amount) as total
            FROM recurring_invoice_history
            WHERE recurring_invoice_id = ?
              AND action_type = 'payment_received'
              AND invoice_start_date = ?
              AND payment_id IS NOT NULL
          `,
            )
            .get(t.id, cycleStartDate);

          const tPaid = roundAmount(paymentsSum.total || 0);
          const tPending = Math.max(
            0,
            roundAmount(Number(t.grand_total || 0) - tPaid),
          );

          // Debug log for calculation auditing
          // console.log({
          //   recurring_invoice_id: t.id,
          //   invoice_start_date: cycleStartDate,
          //   total_paid: tPaid,
          //   remaining_due: tPending,
          //   grand_total: t.grand_total,
          // });

          totalPaidAcrossActiveCycles += tPaid;
          totalPendingAcrossActiveCycles += tPending;
        }
      });

      if (totalPendingAcrossActiveCycles <= 0) {
        overallCollectionStatus = "completed";
      } else if (totalPaidAcrossActiveCycles > 0) {
        overallCollectionStatus = "partially_paid";
      }

      // Fetch the latest cycle details for the "Invoice Details" section of the PDF
      const latestCycleDetails = db
        .prepare(
          `
        SELECT 
          rih.invoice_start_date,
          rih.next_invoice_date,
          rih.due_date,
          inv.invoice_no AS generated_invoice_no
        FROM recurring_invoice_history rih
        JOIN recurring_invoices ri ON ri.id = rih.recurring_invoice_id
        LEFT JOIN invoices inv
          ON inv.recurring_id = ri.id
          AND inv.invoice_date = rih.invoice_start_date
          AND inv.is_deleted = 0
        WHERE ri.recurring_id = ?
          AND rih.action_type IN ('cycle_generated', 'payment_received', 'pending')
        ORDER BY rih.created_at DESC, rih.id DESC
        LIMIT 1
      `,
        )
        .get(id);

      const currentCycleStartDate =
        latestCycleDetails?.invoice_start_date || recurringData.created_at;
      const currentCycleNextDate =
        latestCycleDetails?.due_date ||
        latestCycleDetails?.next_invoice_date ||
        recurringData.created_at;
      const recurringNo = templates[0]?.recurring_invoice_no || `REC-${id}`;
      const generatedInvoiceNo =
        latestCycleDetails?.generated_invoice_no ||
        (templates.length === 1 ? recurringNo : "Multiple Plans");

      const latestPayment = latestPaymentForRecurring(db, id);
      const paidNowAmount = Number(latestPayment?.amount || 0);
      const paymentNo = latestPayment?.payment_no || "";
      const paymentDate = latestPayment?.payment_date || "";

      const invoiceProxy = {
        ...recurringData,
        items: allItems,
        is_gst_enabled: company.enable_outgoing_gst ? 1 : 0,
        invoice_no: recurringNo,
        generated_invoice_no: generatedInvoiceNo,
        document_no: recurringNo,
        invoice_date: currentCycleStartDate,
        document_date: currentCycleStartDate,
        due_date: currentCycleNextDate,
        invoice_start_date: currentCycleStartDate,
        next_invoice_date:
          latestCycleDetails?.next_invoice_date || currentCycleNextDate,
        plan_no: recurringNo,
        recurring_invoice_no: recurringNo,
        billing_cycle:
          templates.length === 1
            ? templates[0]?.billing_cycle
            : "Multiple Plans",
        billing_cycle_label:
          templates.length === 1
            ? billingCycleLabel(templates[0]?.billing_cycle)
            : "Multiple Plans",
        is_recurring: 1,
        subtotal: roundAmount(subtotal),
        discount: roundAmount(discount_agg),
        discount_is_percent: 0, // Keep as 0 for aggregated view
        tax_total: roundAmount(tax_total),
        total: roundAmount(grand_total),
        grand_total: roundAmount(grand_total),
        cgst_total: roundAmount(cgst_total),
        sgst_total: roundAmount(sgst_total),
        igst_total: roundAmount(igst_total),
        notes: templates
          .map((t) => t.notes)
          .filter(Boolean)
          .join(" | "),
        // Map company metadata to ensure GST logic (state comparison) works correctly in the PDF
        company_state: company.state,
        company_gstin: company.gstin,
        company_name_self: company.name,
        company_address: company.address,
        company_phone: company.phone,
        company_email: company.email,

        total_paid: totalPaidAcrossActiveCycles, // Total paid against active cycles
        paid_amount: totalPaidAcrossActiveCycles,
        paid_now: paidNowAmount,
        balance_due: totalPendingAcrossActiveCycles, // Remaining balance for the entire recurring plan
        payment_no: paymentNo,
        payment_date: paymentDate,
        status: overallCollectionStatus, // Overall status of the recurring plan
      };

      // Process Logo (consistent with getInvoice/getQuotation logic)
      if (company.logo_path) {
        try {
          const imageBuffer = fs.readFileSync(company.logo_path);
          const base64 = imageBuffer.toString("base64");
          const extension = path.extname(company.logo_path).replace(".", "");
          invoiceProxy.logo_base64 = `data:image/${extension};base64,${base64}`;
        } catch (err) {
          console.log("Logo load failed:", err);
        }
      }

      let qrSrc = null;
      if (company.upi_id) {
        try {
          const upiString =
            `upi://pay?pa=${company.upi_id}` +
            `&pn=${encodeURIComponent(company.name || "Business")}` +
            `&am=${Number(invoiceProxy.balance_due || 0).toFixed(2)}` + // QR code should be for the balance due
            `&cu=INR` +
            `&tn=${encodeURIComponent(invoiceProxy.document_no)}`;

          qrSrc = await QRCode.toDataURL(upiString);
        } catch (err) {
          console.log("QR generation failed:", err);
        }
      }

      const document = React.createElement(RecurringBillingPDF, {
        recurring: invoiceProxy,
        company,
        qrSrc,
        title: "RECURRING BILLING",
        documentMode,
      });

      const exportsDir = getExportsDir();
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const fileName = `${recurringNo}_FULL_SUMMARY.pdf`;
      const file = path.join(exportsDir, fileName);
      const pdfBuffer = await getPdfBuffer(document);

      await fs.promises.writeFile(file, pdfBuffer);
      await processPdfOutput(file, documentMode, shell);

      return file;
    }),
  );
};

function billingCycleLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function buildUpiQr(company, document) {
  if (!company?.upi_id || Number(document?.balance_due || 0) <= 0) return null;

  try {
    const upiString =
      `upi://pay?pa=${company.upi_id}` +
      `&pn=${encodeURIComponent(company.name || "Business")}` +
      `&am=${Number(document.balance_due || 0).toFixed(2)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(document.document_no || document.invoice_no || "")}`;

    return QRCode.toDataURL(upiString);
  } catch (err) {
    console.log("QR generation failed:", err);
    return null;
  }
}

function loadRecurringPlanContext(db, templateId, recurringId) {
  const plan = db
    .prepare(
      `
      SELECT
        ri.*,
        r.id AS recurring_id,
        r.contact_id,

        c.company_name,
        c.contact_person,
        c.email,
        c.phone,
        c.gstin,
        c.address,
        c.city,
        c.state,
        c.country,
        c.gst_treatment
      FROM recurring_invoices ri
      JOIN recurring r
        ON r.id = ri.recurring_id
      JOIN contacts c
        ON c.id = r.contact_id
      WHERE ri.id = ?
        AND (? IS NULL OR r.id = ?)
    `,
    )
    .get(templateId, recurringId || null, recurringId || null);

  if (!plan) throw new Error("Recurring plan not found");
  return plan;
}

function findGeneratedInvoice(db, recurringInvoiceId, invoiceStartDate) {
  if (!invoiceStartDate) return null;

  return db
    .prepare(
      `
      SELECT id, invoice_no, invoice_date, due_date
      FROM invoices
      WHERE recurring_id = ?
        AND invoice_date = ?
        AND is_deleted = 0
      ORDER BY id DESC
      LIMIT 1
    `,
    )
    .get(recurringInvoiceId, invoiceStartDate);
}

function latestHistoryForPlan(db, recurringInvoiceId) {
  return db
    .prepare(
      `
      SELECT *
      FROM recurring_invoice_history
      WHERE recurring_invoice_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(recurringInvoiceId);
}

function latestHistoryForPayment(db, paymentId) {
  return db
    .prepare(
      `
      SELECT *
      FROM recurring_invoice_history
      WHERE payment_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(paymentId);
}

function paymentSummaryForCycle(db, recurringInvoiceId, invoiceStartDate) {
  const summary = db
    .prepare(
      `
      SELECT
        IFNULL(SUM(amount), 0) AS total_paid
      FROM recurring_invoice_history
      WHERE recurring_invoice_id = ?
        AND invoice_start_date = ?
        AND action_type = 'payment_received'
        AND payment_id IS NOT NULL
    `,
    )
    .get(recurringInvoiceId, invoiceStartDate);

  const latestPayment = db
    .prepare(
      `
    SELECT
      id as payment_id,
      payment_no,
      payment_date,
      amount,
      mode
    FROM incoming_payments
    WHERE recurring_invoice_id = ?
    ORDER BY payment_date DESC, id DESC
    LIMIT 1
  `,
    )
    .get(recurringInvoiceId);

  console.log("Recurring Plan Payment Debug");
  console.log("recurringInvoiceId:", recurringInvoiceId);
  console.log("invoiceStartDate:", invoiceStartDate);
  console.log("latestPayment:", latestPayment);

  console.log({
    totalPaid: Number(summary?.total_paid || 0),
    paidNow: Number(latestPayment?.amount || 0),
    paymentId: latestPayment?.payment_id || null,
    paymentNo: latestPayment?.payment_no || "",
    paymentDate: latestPayment?.payment_date || "",
    paymentMode: latestPayment?.mode || "",
  });

  return {
    totalPaid: Number(summary?.total_paid || 0),
    paidNow: Number(latestPayment?.amount || 0),
    paymentId: latestPayment?.payment_id || null,
    paymentNo: latestPayment?.payment_no || "",
    paymentDate: latestPayment?.payment_date || "",
    paymentMode: latestPayment?.mode || "",
  };
}

function latestPaymentForRecurring(db, recurringId) {
  return db
    .prepare(
      `
      SELECT
        h.amount,
        p.payment_no,
        p.payment_date,
        p.mode
      FROM recurring_invoice_history h
      JOIN incoming_payments p
        ON p.id = h.payment_id
      JOIN recurring_invoices ri
        ON ri.id = h.recurring_invoice_id
      WHERE ri.recurring_id = ?
        AND h.action_type = 'payment_received'
        AND h.payment_id IS NOT NULL
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT 1
    `,
    )
    .get(recurringId);
}

function buildRecurringDocument(
  db,
  { recurringId, templateId, historyId, paymentId },
) {
  let history = null;
  let payment = null;

  if (historyId) {
    history = db
      .prepare("SELECT * FROM recurring_invoice_history WHERE id = ?")
      .get(historyId);
    if (!history) throw new Error("History record not found");
    templateId = history.recurring_invoice_id;
  }

  if (paymentId) {
    payment = db
      .prepare("SELECT * FROM incoming_payments WHERE id = ?")
      .get(paymentId);
    if (!payment) throw new Error("Payment record not found");
    templateId = payment.recurring_invoice_id;
    history = latestHistoryForPayment(db, paymentId) || history;
  }

  const plan = loadRecurringPlanContext(db, templateId, recurringId);
  const company = db.prepare("SELECT * FROM company WHERE id = 1").get();
  const currentHistory = history || latestHistoryForPlan(db, plan.id) || {};
  const invoiceRecord = findGeneratedInvoice(
    db,
    plan.id,
    currentHistory.invoice_start_date || plan.start_date,
  );
  const cycleStartDate = currentHistory.invoice_start_date || plan.start_date;
  const cyclePayment = paymentSummaryForCycle(db, plan.id, cycleStartDate);

  let paidAmount = Number(currentHistory.paid_amount || 0);
  let balanceDue =
    currentHistory.pending_amount === null ||
    currentHistory.pending_amount === undefined
      ? Number(plan.grand_total || 0)
      : Number(currentHistory.pending_amount || 0);

  if (payment) {
    paidAmount = Number(currentHistory.paid_amount || payment.amount || 0);
    balanceDue = Number(currentHistory.pending_amount || 0);
  }

  const generatedInvoiceNo =
    invoiceRecord?.invoice_no ||
    currentHistory.generated_invoice_no ||
    (historyId ? `Proforma-${currentHistory.id}` : plan.recurring_invoice_no);

  const invoiceBase = invoiceRecord ? getInvoice(invoiceRecord.id) : {};
  const invoice = {
    ...plan,
    ...invoiceBase,
    id: invoiceRecord?.id || invoiceBase.id || plan.id,
    items: invoiceRecord
      ? invoiceBase.items || []
      : recurring.loadRecurringItems(db, plan.id),
    invoice_no: generatedInvoiceNo,
    generated_invoice_no: generatedInvoiceNo,
    document_no: payment?.payment_no || generatedInvoiceNo,
    invoice_date:
      payment?.payment_date ||
      invoiceRecord?.invoice_date ||
      currentHistory.invoice_start_date ||
      plan.start_date,
    document_date:
      payment?.payment_date ||
      invoiceRecord?.invoice_date ||
      currentHistory.invoice_start_date ||
      plan.start_date,
    due_date:
      invoiceRecord?.due_date ||
      currentHistory.due_date ||
      currentHistory.next_invoice_date ||
      plan.start_date,
    invoice_start_date: currentHistory.invoice_start_date || plan.start_date,
    next_invoice_date: currentHistory.next_invoice_date || plan.start_date,
    plan_id: plan.id,
    plan_no: plan.recurring_invoice_no,
    recurring_invoice_no: plan.recurring_invoice_no,
    billing_cycle_label: billingCycleLabel(plan.billing_cycle),
    is_recurring: 1,
    generated_invoice_id: invoiceRecord?.id || null,
    against_invoice_no: generatedInvoiceNo,
    total_paid: payment ? paidAmount : cyclePayment.totalPaid || paidAmount,
    paid_amount: payment ? paidAmount : cyclePayment.totalPaid || paidAmount,
    paid_now: payment ? Number(payment.amount || 0) : cyclePayment.paidNow,
    current_payment: payment
      ? Number(payment.amount || 0)
      : cyclePayment.paidNow,
    balance_due: balanceDue,
    status: currentHistory.collection_status || "pending",
    payment_status: currentHistory.collection_status || "pending",
    payment_no: payment?.payment_no || cyclePayment.paymentNo || "",
    payment_date: payment?.payment_date || cyclePayment.paymentDate || "",
    payment_mode: payment?.mode || cyclePayment.paymentMode || "",
    mode: payment?.mode || cyclePayment.paymentMode || "",
    reference_no: payment?.reference_no || "",

    company_state: company.state,
    company_gstin: company.gstin,
    company_name_self: company.name,
    company_address: company.address,
    company_phone: company.phone,
    company_email: company.email,
  };

  if (payment) {
    invoice.notes = [
      payment.notes,
      `Plan ID: ${plan.id}`,
      `Paid Amount: ${roundAmount(payment.amount)}`,
      `Remaining Due: ${roundAmount(balanceDue)}`,
    ]
      .filter(Boolean)
      .join(" | ");
  } else if (!historyId) {
    const payments = db
      .prepare(
        `
        SELECT payment_no, payment_date, amount, mode
        FROM incoming_payments
        WHERE recurring_invoice_id = ?
        ORDER BY payment_date DESC, id DESC
        LIMIT 5
      `,
      )
      .all(plan.id);

    const paymentSummary = payments
      .map(
        (row) =>
          `${row.payment_no} - ${row.payment_date} - Rs ${roundAmount(row.amount)} - ${String(row.mode || "").replace(/_/g, " ")}`,
      )
      .join("; ");

    invoice.notes = [
      plan.notes,
      paymentSummary ? `Payment History: ${paymentSummary}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (company.logo_path) {
    try {
      const imageBuffer = fs.readFileSync(company.logo_path);
      const base64 = imageBuffer.toString("base64");
      const extension = path.extname(company.logo_path).replace(".", "");
      invoice.logo_base64 = `data:image/${extension};base64,${base64}`;
    } catch (err) {
      console.log("Logo load failed:", err);
    }
  }

  return invoice;
}

function buildExpenseDocument(db, id) {
  const document = db
    .prepare(
      `
      SELECT
        e.*,
        COALESCE(v.company_name, e.vendor) AS company_name,
        v.contact_person,
        v.email,
        v.phone,
        v.gstin,
        v.state,
        v.address,
        ec.name AS category_name,
        ba.account_name AS bank_account_name,

        co.name company_name_self,
        co.legal_name,
        co.gstin company_gstin,
        co.email company_email,
        co.phone company_phone,
        co.address company_address,
        co.state company_state,
        co.bank_name,
        co.bank_account,
        co.ifsc,
        co.upi_id,
        co.logo_path,
        co.term1,
        co.term2,
        co.term3,
        co.term4,
        co.term5,
        co.invoice_footer,
        co.tagline
      FROM expenses e
      LEFT JOIN contacts v ON v.id = e.contact_id
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
      JOIN company co ON co.id = 1
      WHERE e.id = ?
    `,
    )
    .get(id);

  if (!document) throw new Error("Expense not found");

  document.document_no = document.expense_no || `EXP-${document.id}`;
  document.document_date = document.expense_date;
  document.invoice_no = document.document_no;
  document.invoice_date = document.expense_date;
  document.due_date = document.expense_date;
  document.subtotal = Number(document.subtotal || document.amount || 0);
  document.tax_total = Number(document.tax_total || document.gst_amount || 0);
  document.cgst_total = Number(document.cgst_total || 0);
  document.sgst_total = Number(document.sgst_total || 0);
  document.igst_total = Number(document.igst_total || 0);
  document.grand_total = Number(
    document.total_amount || document.amount + document.gst_amount || 0,
  );
  document.balance_due = 0;
  document.paid_amount = document.grand_total;
  document.items = db
    .prepare("SELECT * FROM expense_items WHERE expense_id = ? ORDER BY id")
    .all(id);
  document.notes = [
    document.notes,
    document.payment_mode
      ? `Mode: ${String(document.payment_mode).replace(/_/g, " ")}`
      : "",
    document.bank_account_name ? `Bank: ${document.bank_account_name}` : "",
    document.reference_no ? `Reference: ${document.reference_no}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  attachLogo(document);
  return document;
}

function buildPurchaseDocument(db, id) {
  const document = db
    .prepare(
      `
      SELECT
        p.*,
        COALESCE(v.company_name, p.vendor) AS company_name,
        v.contact_person,
        v.email,
        v.phone,
        v.gstin,
        v.state,
        v.address,
        ba.account_name AS bank_account_name,

        co.name company_name_self,
        co.legal_name,
        co.gstin company_gstin,
        co.email company_email,
        co.phone company_phone,
        co.address company_address,
        co.state company_state,
        co.bank_name,
        co.bank_account,
        co.ifsc,
        co.upi_id,
        co.logo_path,
        co.term1,
        co.term2,
        co.term3,
        co.term4,
        co.term5,
        co.invoice_footer,
        co.tagline
      FROM purchases p
      LEFT JOIN contacts v ON v.id = p.contact_id
      LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
      JOIN company co ON co.id = 1
      WHERE p.id = ?
    `,
    )
    .get(id);

  if (!document) throw new Error("Purchase not found");

  document.document_no = document.bill_no || `BILL-${document.id}`;
  document.document_date = document.bill_date;
  document.invoice_no = document.document_no;
  document.invoice_date = document.bill_date;
  document.due_date = document.due_date || document.bill_date;
  document.items = db
    .prepare("SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id")
    .all(id);
  document.balance_due = Number(document.balance_due || 0);
  document.paid_now = Number(document.paid_amount || 0);
  document.notes = [
    document.notes,
    document.vendor_bill_no ? `Vendor bill: ${document.vendor_bill_no}` : "",
    document.bank_account_name
      ? `Payment bank: ${document.bank_account_name}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");
  attachLogo(document);
  return document;
}

function attachLogo(document) {
  if (!document.logo_path) return;
  try {
    const imageBuffer = fs.readFileSync(document.logo_path);
    const base64 = imageBuffer.toString("base64");
    const extension = path.extname(document.logo_path).replace(".", "");
    document.logo_base64 = `data:image/${extension};base64,${base64}`;
  } catch (err) {
    document.logo_base64 = null;
  }
}

// ======================================================
// GET INVOICE
// ======================================================

function getInvoice(id) {
  const db = getDb();

  const document = db
    .prepare(
      `
    SELECT 
      i.*,
      ri.recurring_invoice_no as plan_no,
      ri.billing_cycle,
c.company_name,
c.contact_person,
c.email,
c.phone,
c.gstin,
c.address,
c.city,
c.state,
c.country,

      co.name company_name_self,
      co.legal_name,
      co.gstin company_gstin,
      co.email company_email,
      co.phone company_phone,
      co.address company_address,
      co.state company_state,
      co.bank_name,
      co.bank_account,
      co.ifsc,
      co.upi_id,
      co.logo_path,
      co.term1,
      co.term2,
      co.term3,
      co.term4,
      co.term5,
      co.invoice_footer,
      co.tagline

    FROM invoices i

    JOIN contacts c
      ON c.id = i.contact_id

    JOIN company co
      ON co.id = 1

    LEFT JOIN recurring_invoices ri
      ON ri.id = i.recurring_id

    WHERE i.id = ?
  `,
    )
    .get(id);

  if (!document) {
    return null;
  }

  // Flag as recurring if it's linked to a plan
  if (document.recurring_id) {
    document.is_recurring = 1;
  }

  document.document_no = document.invoice_no;

  document.document_date = document.invoice_date;

  document.items = db
    .prepare(
      `
      SELECT *
      FROM invoice_items
      WHERE invoice_id = ?
    `,
    )
    .all(id);

  document.items.forEach((item) => {
    item.descriptionPoints = db
      .prepare(
        `
      SELECT *
      FROM description_points
      WHERE invoice_item_id = ?
      ORDER BY point_order
    `,
      )
      .all(item.id);
  });

  const paymentSummary = db
    .prepare(
      `
    SELECT
      IFNULL(SUM(amount), 0) as total_paid
    FROM incoming_payments
    WHERE invoice_id = ?
  `,
    )
    .get(id);

  document.total_paid = Number(paymentSummary.total_paid || 0);

  const latestPayment = db
    .prepare(
      `
    SELECT
      payment_no,
      payment_date,
      amount
    FROM incoming_payments
    WHERE invoice_id = ?
    ORDER BY payment_date DESC, id DESC
    LIMIT 1
  `,
    )
    .get(id);

  document.paid_now = Number(latestPayment?.amount || 0);

  document.payment_no = latestPayment?.payment_no || "";

  document.payment_date = latestPayment?.payment_date || "";

  document.balance_due =
    Number(document.grand_total || 0) - document.total_paid;

  if (document.logo_path) {
    try {
      const imageBuffer = fs.readFileSync(document.logo_path);

      const base64 = imageBuffer.toString("base64");

      const extension = path.extname(document.logo_path).replace(".", "");

      document.logo_base64 = `data:image/${extension};base64,${base64}`;
    } catch (err) {
      console.log("Logo load failed:", err);

      document.logo_base64 = null;
    }
  }

  return document;
}

// ======================================================
// GET QUOTATION
// ======================================================

function getQuotationPdfData(id) {
  const db = getDb();

  const document = db
    .prepare(
      `
    SELECT 
      q.*,
      c.company_name,
      c.contact_person,
      c.email,
      c.phone,
      c.gstin,
      c.address,
      c.city,
      c.state,
      c.country,
      c.gst_treatment,

      co.name company_name_self,
      co.legal_name,
      co.gstin company_gstin,
      co.email company_email,
      co.phone company_phone,
      co.address company_address,
      co.state company_state,
      co.bank_name,
      co.bank_account,
      co.ifsc,
      co.upi_id,
      co.logo_path,
      co.term1,
      co.term2,
      co.term3,
      co.term4,
      co.term5,
      co.invoice_footer,
      co.tagline

    FROM quotations q

    JOIN contacts c
      ON c.id = q.contact_id

    JOIN company co
      ON co.id = 1

    WHERE q.id = ?
  `,
    )
    .get(id);

  if (!document) {
    return null;
  }

  document.document_no = document.quotation_no;

  document.document_date = document.quotation_date;

  document.invoice_no = document.quotation_no;

  document.invoice_date = document.quotation_date;

  document.due_date = document.valid_until;

  document.items = db
    .prepare(
      `
      SELECT *
      FROM quotation_items
      WHERE quotation_id = ?
    `,
    )
    .all(id);

  document.items.forEach((item) => {
    item.descriptionPoints = db
      .prepare(
        `
      SELECT *
      FROM description_points
      WHERE quotation_item_id = ?
      ORDER BY point_order
    `,
      )
      .all(item.id);
  });

  if (document.logo_path) {
    try {
      const imageBuffer = fs.readFileSync(document.logo_path);

      const base64 = imageBuffer.toString("base64");

      const extension = path.extname(document.logo_path).replace(".", "");

      document.logo_base64 = `data:image/${extension};base64,${base64}`;
    } catch (err) {
      console.log("Logo load failed:", err);

      document.logo_base64 = null;
    }
  }
  const sameState =
    String(document.company_state || "")
      .trim()
      .toLowerCase() ===
    String(document.state || "")
      .trim()
      .toLowerCase();

  const taxTotal = roundAmount(document.tax_total);

  if (sameState) {
    document.cgst_total = roundAmount(taxTotal / 2);

    document.sgst_total = roundAmount(taxTotal - document.cgst_total);

    document.igst_total = 0;
  } else {
    document.cgst_total = 0;

    document.sgst_total = 0;

    document.igst_total = taxTotal;
  }

  return document;
}
