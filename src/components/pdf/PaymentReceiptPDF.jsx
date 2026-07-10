import { Document, Page, Text, View } from "@react-pdf/renderer";

import { pdfStyles } from "./pdfStyles";
import { amountToWords } from "../../utils/amountToWords";

import PDFHeader from "./components/PDFHeader";
import PDFSignature from "./components/PDFSignature";
import {
  DetailGrid,
  DocumentFrame,
  PartyBlock,
  PartyDetailsSection,
  SimpleTotalBox,
  cleanLabel,
  dateValue,
  formatMoney,
} from "./components/PDFDocumentBlocks";

export default function PaymentReceiptPDF({
  payment = {},
  company = {},
  title = "PAYMENT RECEIPT",
  partyTitle = "Received From",
  documentMode = "export",
}) {
  const logoDataUrl =
    payment?.logo_base64 || company?.logo_base64 || company?.logo_path;
  const paidNow = Number(payment.paid_now || payment.amount || payment.current_payment || 0);
  const payer = payment.customer || {
    company_name: payment.company_name || payment.customer_name,
    contact_person: payment.contact_person,
    email: payment.email,
    phone: payment.phone,
    gstin: payment.gstin,
    address: payment.address,
    city: payment.city,
    state: payment.state,
    country: payment.country,
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <DocumentFrame>
          <PDFHeader
            title={title}
            company={company}
            copyLabel="Receipt Copy"
            logoDataUrl={logoDataUrl}
          />

          <DetailGrid
            left={[
              { label: "Receipt No :", value: payment.payment_no || payment.document_no },
              { label: "Receipt Date :", value: dateValue(payment.payment_date || payment.document_date) },
              { label: "Received Amount :", value: formatMoney(paidNow) },
              { label: "Payment Mode :", value: cleanLabel(payment.payment_mode || payment.mode) },
            ]}
            right={[
              { label: "Against Invoice :", value: payment.against_invoice_no || payment.generated_invoice_no || payment.invoice_no },
              { label: "Invoice Date :", value: dateValue(payment.invoice_date) },
              { label: "Reference :", value: payment.reference_no },
              { label: "Balance Due :", value: formatMoney(payment.balance_due || 0) },
            ]}
          />

          <PartyDetailsSection
            left={<PartyBlock title={partyTitle} party={payer} />}
            right={
              <View style={pdfStyles.customerBox}>
                <Text style={pdfStyles.boxTitle}>Receipt Allocation</Text>
                <Text style={pdfStyles.boxLine}>
                  Invoice Total: {formatMoney(payment.grand_total || payment.total || 0)}
                </Text>
                <Text style={pdfStyles.boxLine}>
                  Total Received: {formatMoney(payment.paid_amount || payment.total_paid || paidNow)}
                </Text>
                <Text style={pdfStyles.boxLine}>
                  Current Receipt: {formatMoney(paidNow)}
                </Text>
              </View>
            }
          />

          <SimpleTotalBox
            rows={[
              { label: "Invoice Total", value: payment.grand_total || payment.total || 0 },
              { label: "Previously Received", value: Math.max(0, Number(payment.paid_amount || payment.total_paid || 0) - paidNow) },
              { label: "Balance Due", value: payment.balance_due || 0 },
            ]}
            grandLabel="Received"
            grandTotal={paidNow}
            amountWords={amountToWords(paidNow)}
          />

          <View style={pdfStyles.notesSignRow} wrap={false}>
            <View style={pdfStyles.notesCol}>
              {payment.notes ? (
                <>
                  <Text style={pdfStyles.notesLabel}>Notes</Text>
                  <Text style={pdfStyles.notesBody}>{payment.notes}</Text>
                </>
              ) : null}
            </View>
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
