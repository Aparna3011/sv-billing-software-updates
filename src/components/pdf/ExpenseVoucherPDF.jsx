import { Document, Page, View } from "@react-pdf/renderer";

import { pdfStyles } from "./pdfStyles";

import PDFHeader from "./components/PDFHeader";
import PDFLineItems, { buildInvoiceItemChunks } from "./components/PDFLineItems";
import PDFTotals from "./components/PDFTotals";
import PDFSignature from "./components/PDFSignature";
import {
  DetailGrid,
  DocumentFrame,
  PartyBlock,
  PartyDetailsSection,
  dateValue,
  cleanLabel,
} from "./components/PDFDocumentBlocks";

function normalizeExpenseItems(expense) {
  const items = expense.items || [];
  if (items.length > 0) {
    return items.map((item) => ({
      ...item,
      name: item.name || item.item_name || item.description || expense.category_name || "Expense",
      qty: item.qty || 1,
      rate: item.rate ?? item.amount ?? item.line_total ?? 0,
      line_total: item.line_total ?? item.amount ?? item.total ?? 0,
    }));
  }

  return [
    {
      name: expense.category_name || expense.vendor || "Expense",
      description: expense.description || expense.notes || "",
      qty: 1,
      rate: Number(expense.subtotal || expense.amount || 0),
      line_total: Number(expense.subtotal || expense.amount || 0),
      gst_rate: Number(expense.gst_rate || 0),
    },
  ];
}

export default function ExpenseVoucherPDF({
  expense = {},
  company = {},
  documentMode = "export",
}) {
  const logoDataUrl =
    expense?.logo_base64 || company?.logo_base64 || company?.logo_path;
  const payee = {
    ...expense.vendor,
    company_name: expense.vendor?.company_name || expense.company_name || expense.vendor,
    contact_person: expense.vendor?.contact_person || expense.contact_person,
    email: expense.vendor?.email || expense.email,
    phone: expense.vendor?.phone || expense.phone,
    gstin: expense.vendor?.gstin || expense.gstin,
    address: expense.vendor?.address || expense.address,
    city: expense.vendor?.city || expense.city,
    state: expense.vendor?.state || expense.state,
  };
  const voucher = {
    ...expense,
    items: normalizeExpenseItems(expense),
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <DocumentFrame>
          <PDFHeader
            title="EXPENSE VOUCHER"
            company={company}
            copyLabel="Voucher Copy"
            logoDataUrl={logoDataUrl}
          />

          <DetailGrid
            left={[
              { label: "Voucher No :", value: expense.document_no || expense.expense_no },
              { label: "Voucher Date :", value: dateValue(expense.document_date || expense.expense_date) },
              { label: "Category :", value: expense.category_name },
              { label: "Expense Type :", value: cleanLabel(expense.expense_type) },
            ]}
            right={[
              { label: "Payment Mode :", value: cleanLabel(expense.payment_mode || expense.mode) },
              { label: "Paid From :", value: expense.bank_account_name },
              { label: "Reference :", value: expense.reference_no },
              { label: "Status :", value: cleanLabel(expense.status || "paid") },
            ]}
          />

          <PartyDetailsSection
            left={<PartyBlock title="Paid To" party={payee} />}
            right={
              <View style={pdfStyles.customerBox}>
                <DetailGrid
                  left={[
                    { label: "Taxable :", value: expense.subtotal || expense.amount || 0 },
                    { label: "GST :", value: expense.tax_total || expense.gst_amount || 0 },
                  ]}
                  right={[
                    { label: "Total Paid :", value: expense.grand_total || expense.total_amount || 0 },
                    { label: "Claimable :", value: cleanLabel(expense.is_reimbursable ? "yes" : "no") },
                  ]}
                />
              </View>
            }
          />

          <View style={pdfStyles.contentBody}>
            <PDFLineItems
              chunks={buildInvoiceItemChunks(voucher.items)}
              invoice={voucher}
            />
            <PDFTotals document={voucher} isInvoice />
          </View>

          <View style={pdfStyles.notesSignRow} wrap={false}>
            <View style={pdfStyles.notesCol} />
            <View style={pdfStyles.signCol}>
              <PDFSignature
                documentMode={documentMode}
                companyName={company.name || company.company_name || ""}
              />
            </View>
          </View>
        </DocumentFrame>
      </Page>
    </Document>
  );
}
