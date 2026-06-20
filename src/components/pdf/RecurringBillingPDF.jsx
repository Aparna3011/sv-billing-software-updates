import { Document, Page, View } from "@react-pdf/renderer";

import { pdfStyles } from "./pdfStyles";

import PDFHeader from "./components/PDFHeader";
import PDFLineItems, { buildInvoiceItemChunks } from "./components/PDFLineItems";
import PDFTotals from "./components/PDFTotals";
import PDFBottomSection from "./components/PDFBottomSection";
import {
  DetailGrid,
  DocumentFrame,
  PartyBlock,
  PartyDetailsSection,
  dateValue,
  cleanLabel,
} from "./components/PDFDocumentBlocks";
import PDFSignature from "./components/PDFSignature";

export default function RecurringBillingPDF({
  recurring = {},
  company = {},
  qrSrc = null,
  title = "RECURRING BILLING",
  documentMode = "export",
}) {
  const logoDataUrl =
    recurring?.logo_base64 || company?.logo_base64 || company?.logo_path;
  const party = recurring.customer || recurring;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <DocumentFrame>
          <PDFHeader
            title={title}
            company={company}
            copyLabel="Billing Copy"
            logoDataUrl={logoDataUrl}
          />

          <DetailGrid
            left={[
              { label: "Plan No :", value: recurring.plan_no || recurring.recurring_invoice_no || recurring.document_no },
              { label: "Cycle :", value: recurring.billing_cycle_label || cleanLabel(recurring.billing_cycle) },
              { label: "Cycle Start :", value: dateValue(recurring.invoice_start_date || recurring.document_date) },
              { label: "Next Billing :", value: dateValue(recurring.next_invoice_date || recurring.due_date) },
            ]}
            right={[
              { label: "Generated Invoice :", value: recurring.generated_invoice_no || recurring.invoice_no },
              { label: "Due Date :", value: dateValue(recurring.due_date) },
              { label: "Collection Status :", value: cleanLabel(recurring.status || recurring.payment_status) },
              { label: "Balance Due :", value: recurring.balance_due },
            ]}
          />

          <PartyDetailsSection
            left={<PartyBlock title="Subscriber" party={party} />}
            right={
              <View style={pdfStyles.customerBox}>
                <DetailGrid
                  left={[
                    { label: "Total Paid :", value: recurring.total_paid || recurring.paid_amount || 0 },
                    { label: "Current Paid :", value: recurring.paid_now || recurring.current_payment || 0 },
                  ]}
                  right={[
                    { label: "Payment No :", value: recurring.payment_no },
                    { label: "Payment Date :", value: dateValue(recurring.payment_date) },
                  ]}
                />
              </View>
            }
          />

          <View style={pdfStyles.contentBody}>
            <PDFLineItems
              chunks={buildInvoiceItemChunks(recurring.items || [])}
              invoice={recurring}
            />
            <PDFTotals document={recurring} isInvoice />
          </View>

          <PDFBottomSection
            company={company}
            qrSrc={qrSrc}
            documentMode={documentMode}
          />

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
