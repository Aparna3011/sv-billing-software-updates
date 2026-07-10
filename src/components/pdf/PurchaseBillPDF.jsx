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

export default function PurchaseBillPDF({
  purchase = {},
  company = {},
  documentMode = "export",
}) {
  const logoDataUrl =
    purchase?.logo_base64 || company?.logo_base64 || company?.logo_path;
  const vendor = {
    ...purchase.vendor,
    company_name: purchase.vendor?.company_name || purchase.company_name || purchase.vendor,
    contact_person: purchase.vendor?.contact_person || purchase.contact_person,
    email: purchase.vendor?.email || purchase.email,
    phone: purchase.vendor?.phone || purchase.phone,
    gstin: purchase.vendor?.gstin || purchase.gstin,
    address: purchase.vendor?.address || purchase.address,
    city: purchase.vendor?.city || purchase.city,
    state: purchase.vendor?.state || purchase.state,
    country: purchase.vendor?.country || purchase.country,
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <DocumentFrame>
          <PDFHeader
            title="PURCHASE BILL"
            company={company}
            copyLabel="Accounts Copy"
            logoDataUrl={logoDataUrl}
          />

          <DetailGrid
            left={[
              { label: "Purchase No :", value: purchase.document_no || purchase.bill_no },
              { label: "Purchase Date :", value: dateValue(purchase.document_date || purchase.bill_date) },
              { label: "Vendor Bill :", value: purchase.vendor_bill_no },
              { label: "Due Date :", value: dateValue(purchase.due_date) },
            ]}
            right={[
              { label: "Payment Status :", value: cleanLabel(purchase.status || purchase.payment_status) },
              { label: "Payment Mode :", value: cleanLabel(purchase.payment_mode || purchase.mode) },
              { label: "Paid Amount :", value: purchase.paid_amount || 0 },
              { label: "Balance Due :", value: purchase.balance_due || 0 },
            ]}
          />

          <PartyDetailsSection
            left={<PartyBlock title="Vendor Details" party={vendor} />}
            right={
              <View style={pdfStyles.customerBox}>
                <DetailGrid
                  left={[
                    { label: "Purchase Type :", value: cleanLabel(purchase.purchase_type) },
                    { label: "Bank Account :", value: purchase.bank_account_name },
                  ]}
                  right={[
                    { label: "Reference :", value: purchase.reference_no },
                    { label: "GST Treatment :", value: purchase.gst_treatment },
                  ]}
                />
              </View>
            }
          />

          <View style={pdfStyles.contentBody}>
            <PDFLineItems
              chunks={buildInvoiceItemChunks(purchase.items || [])}
              invoice={purchase}
            />
            <PDFTotals document={purchase} isInvoice />
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
