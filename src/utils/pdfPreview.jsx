import { pdf } from "@react-pdf/renderer";

const roundAmt = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export async function buildPdfBlob(element) {
  return pdf(element).toBlob();
}

export async function runPdfPreview({ element, setUrl, setLoading }) {
  setLoading(true);
  try {
    const blob = await buildPdfBlob(element);
    setUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return URL.createObjectURL(blob);
    });
  } finally {
    setLoading(false);
  }
}

export function enrichInvoiceWithLatestPayment(invoice) {
  const latestPayment = [...(invoice.payments || [])].sort(
    (a, b) => new Date(b.payment_date) - new Date(a.payment_date),
  )[0];

  return {
    ...invoice,
    payment_no: latestPayment?.payment_no || "",
    payment_date: latestPayment?.payment_date || "",
    paid_now: Number(latestPayment?.amount || 0),
  };
}

export async function buildUpiQr(company, invoice, { amountField = "paid_now" } = {}) {
  if (!company?.upi_id) return null;

  const QRCode = (await import("qrcode")).default;
  const amount =
    Math.round(Number(invoice[amountField] ?? invoice.balance_due ?? 0) * 100) / 100;
  const docNo = invoice.invoice_no || invoice.document_no || "";

  const upiString =
    `upi://pay?pa=${company.upi_id}` +
    `&pn=${encodeURIComponent(company.name || "Business")}` +
    `&am=${amount}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(docNo)}`;

  return QRCode.toDataURL(upiString);
}

export function mapPurchaseForPdf(purchase) {
  return {
    ...purchase,
    document_no: purchase.bill_no || `BILL-${purchase.id}`,
    document_date: purchase.bill_date,
    invoice_no: purchase.bill_no || `BILL-${purchase.id}`,
    invoice_date: purchase.bill_date,
    paid_now: Number(purchase.paid_amount || 0),
    items: purchase.items || [],
    company_name: purchase.vendor_name || purchase.vendor,
    notes: [
      purchase.notes,
      purchase.vendor_bill_no ? `Vendor bill: ${purchase.vendor_bill_no}` : "",
      purchase.bank_account_name
        ? `Payment bank: ${purchase.bank_account_name}`
        : "",
    ]
      .filter(Boolean)
      .join(" | "),
  };
}

export function mapRecurringPlanForPdf({ plan, recurring, company }) {
  return {
    ...recurring,
    ...plan,
    items: plan.items || [],
    invoice_no: plan.recurring_invoice_no,
    generated_invoice_no: plan.recurring_invoice_no,
    document_no: plan.recurring_invoice_no,
    plan_no: plan.recurring_invoice_no,
    recurring_invoice_no: plan.recurring_invoice_no,
    invoice_date: plan.start_date,
    document_date: plan.start_date,
    due_date: plan.next_invoice_date || plan.start_date,
    invoice_start_date: plan.start_date,
    next_invoice_date: plan.next_invoice_date || plan.start_date,
    billing_cycle_label: String(plan.billing_cycle || "").replace(/_/g, " "),
    is_recurring: 1,
    paid_amount: Number(plan.paid_amount || 0),
    total_paid: Number(plan.paid_amount || 0),
    balance_due: Number(plan.pending_amount ?? plan.grand_total ?? 0),
    paid_now: 0,
    status: plan.status,
    company_state: company?.state,
    company_gstin: company?.gstin,
    company_name_self: company?.name,
    company_address: company?.address,
    company_phone: company?.phone,
    company_email: company?.email,
  };
}

export function mapRecurringCycleForPdf({ history, plan, recurring, company }) {
  const generatedInvoiceNo =
    history.generated_invoice_no || `Proforma-${history.id}`;

  return {
    ...recurring,
    ...plan,
    items: plan.items || [],
    invoice_no: generatedInvoiceNo,
    generated_invoice_no: generatedInvoiceNo,
    document_no: generatedInvoiceNo,
    plan_no: plan.recurring_invoice_no,
    recurring_invoice_no: plan.recurring_invoice_no,
    invoice_date: history.invoice_date || history.invoice_start_date,
    document_date: history.invoice_date || history.invoice_start_date,
    due_date: history.due_date,
    invoice_start_date: history.invoice_start_date,
    next_invoice_date: history.next_invoice_date,
    billing_cycle: plan.billing_cycle,
    billing_cycle_label: String(plan.billing_cycle || "").replace(/_/g, " "),
    is_recurring: 1,
    subtotal: history.grand_total,
    grand_total: history.grand_total,
    total: history.grand_total,
    paid_amount: Number(history.cycle_paid_amount ?? history.paid_amount ?? 0),
    total_paid: Number(history.cycle_paid_amount ?? history.paid_amount ?? 0),
    balance_due: Number(history.cycle_pending_amount ?? history.pending_amount ?? 0),
    paid_now: 0,
    status: history.cycle_collection_status || history.collection_status,
    company_state: company?.state,
    company_gstin: company?.gstin,
    company_name_self: company?.name,
    company_address: company?.address,
    company_phone: company?.phone,
    company_email: company?.email,
  };
}

export function mapRecurringFullSummaryForPdf(recurring, company) {
  const templates = (recurring.templates || []).filter(
    (t) => t.is_active === 1 || t.is_active === undefined,
  );
  const allItems = [];
  let subtotal = 0;
  let discountAgg = 0;
  let taxTotal = 0;
  let grandTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  templates.forEach((t) => {
    const tSubtotal = Number(t.subtotal || 0);
    const tDiscountAmount = t.discount_is_percent
      ? (tSubtotal * Number(t.discount || 0)) / 100
      : Number(t.discount || 0);

    const items = (t.items || []).map((item) => ({
      ...item,
      name:
        templates.length > 1 && t.billing_cycle
          ? `${item.name} (${String(t.billing_cycle).replace("_", " ")})`
          : item.name,
    }));

    allItems.push(...items);
    subtotal += tSubtotal;
    discountAgg += tDiscountAmount;
    taxTotal += Number(t.tax_total || 0);
    grandTotal += Number(t.grand_total || 0);
    cgstTotal += Number(t.cgst_total || 0);
    sgstTotal += Number(t.sgst_total || 0);
    igstTotal += Number(t.igst_total || 0);
  });

  let totalPaid = 0;
  let totalPending = 0;

  templates.forEach((t) => {
    if (!t.is_stopped) {
      totalPaid += Number(t.paid_amount || 0);
      totalPending += Number(
        t.pending_amount ??
          Math.max(0, Number(t.grand_total || 0) - Number(t.paid_amount || 0)),
      );
    }
  });

  const recurringNo = templates[0]?.recurring_invoice_no || `REC-${recurring.id}`;
  const latestPayment = [...(recurring.payments || [])].sort(
    (a, b) => new Date(b.payment_date) - new Date(a.payment_date),
  )[0];

  let overallStatus = "pending";
  if (totalPending <= 0) {
    overallStatus = "completed";
  } else if (totalPaid > 0) {
    overallStatus = "partially_paid";
  }

  return {
    ...recurring,
    items: allItems,
    invoice_no: recurringNo,
    generated_invoice_no: recurringNo,
    document_no: recurringNo,
    plan_no: recurringNo,
    recurring_invoice_no: recurringNo,
    is_recurring: 1,
    subtotal: roundAmt(subtotal),
    discount: roundAmt(discountAgg),
    discount_is_percent: 0,
    tax_total: roundAmt(taxTotal),
    total: roundAmt(grandTotal),
    grand_total: roundAmt(grandTotal),
    cgst_total: roundAmt(cgstTotal),
    sgst_total: roundAmt(sgstTotal),
    igst_total: roundAmt(igstTotal),
    total_paid: totalPaid,
    paid_amount: totalPaid,
    paid_now: Number(latestPayment?.amount || 0),
    balance_due: totalPending,
    payment_no: latestPayment?.payment_no || "",
    payment_date: latestPayment?.payment_date || "",
    status: overallStatus,
    billing_cycle:
      templates.length === 1 ? templates[0]?.billing_cycle : "Multiple Plans",
    billing_cycle_label:
      templates.length === 1
        ? String(templates[0]?.billing_cycle || "").replace(/_/g, " ")
        : "Multiple Plans",
    company_state: company?.state,
    company_gstin: company?.gstin,
    company_name_self: company?.name,
    company_address: company?.address,
    company_phone: company?.phone,
    company_email: company?.email,
  };
}

export function PdfPreviewSection({ title = "PDF Preview", loading, url }) {
  return (
    <div className="mt-6 rounded-lg border bg-white p-4">
      <div className="mb-3 text-lg font-semibold">{title}</div>
      {loading && (
        <div className="py-10 text-center text-slate-500">
          Generating PDF preview...
        </div>
      )}
      {!loading && url && (
        <iframe
          title={title}
          src={url}
          className="h-[900px] w-full rounded-md border border-slate-200"
        />
      )}
    </div>
  );
}
