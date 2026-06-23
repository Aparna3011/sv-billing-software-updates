import PDFInvoiceStrip from "./components/PDFInvoiceStrip";
import { Document, Page, View, Text } from "@react-pdf/renderer";

import { pdfStyles } from "./pdfStyles";
import { formatPdfDate } from "./pdfFormat";
import { amountToWords } from "../../utils/amountToWords";
import { formatMoney } from "./components/PDFDocumentBlocks";

import PDFHeader from "./components/PDFHeader";
import PDFCustomerCards from "./components/PDFCustomerCards";
import PDFLineItems, {
  LINE_ITEMS_LAYOUT,
  paginateInvoiceItems,
} from "./components/PDFLineItems";
import PDFTotals from "./components/PDFTotals";
import PDFBottomSection from "./components/PDFBottomSection";
import PDFBankDetails from "./components/PDFBankDetails";
import PDFSignature from "./components/PDFSignature";

export default function InvoicePDF({
  invoice = {},
  company = {},
  qrSrc = null,
  title = "INVOICE",
  documentMode = "print",
  showPaymentDetails = true,
  showTotals = true,
}) {
  const documentLabels = {
    INVOICE: {
      no: "Invoice No :",
      date: "Invoice Date :",
    },
    QUOTATION: {
      no: "Quotation No :",
      date: "Quotation Date :",
    },
  };
  const labels = documentLabels[title] || documentLabels.INVOICE;
  const isQuotation = title === "QUOTATION";

  const pages = paginateInvoiceItems({
    items: invoice.items || [],
    invoice,
    company,
    qrSrc,
    documentMode,
    title,
  });

  const pagesPerCopy = pages.length;

  const renderInvoicePage = (copyLabel, page, localPageNumber) => (
    <Page
      key={`${copyLabel}-${localPageNumber}`}
      size="A4"
      style={pdfStyles.page}
    >
      <View style={pdfStyles.invoiceOuterBorder} fixed />
      <View style={pdfStyles.invoiceContent}>
        <View>
          <PDFHeader
            title={title}
            company={company}
            copyLabel={copyLabel}
            logoDataUrl={
              invoice?.logo_base64 || company?.logo_base64 || company?.logo_path
            }
          />

          {page.isFirstPage && (
            <View style={pdfStyles.invoiceDetailsSection}>
              <View style={pdfStyles.infoRow}>
                <View style={pdfStyles.infoColumn}>
                  <View style={pdfStyles.invoiceDetailsSection}>
                    <View style={pdfStyles.detailsColumn}>
                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>{labels.no}</Text>
                        <Text style={pdfStyles.detailsValue}>
                          {invoice.document_no || invoice.invoice_no || "-"}
                        </Text>
                      </View>

                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>{labels.date}</Text>
                        <Text style={pdfStyles.detailsValue}>
                          {invoice.document_date
                            ? formatPdfDate(invoice.document_date)
                            : invoice.invoice_date
                              ? formatPdfDate(invoice.invoice_date)
                              : "—"}
                        </Text>
                      </View>

                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Due Date :</Text>
                        <Text style={pdfStyles.detailsValue}>
                          {invoice.due_date || "-"}
                        </Text>
                      </View>

                      {showPaymentDetails &&
                        Number(invoice.paid_amount || 0) > 0 &&
                        invoice.payment_no &&
                        invoice.payment_date && (
                          <>
                            <View style={pdfStyles.detailsRow}>
                              <Text style={pdfStyles.detailsLabel}>
                                Payment No :
                              </Text>
                              <Text style={pdfStyles.detailsValue}>
                                {invoice.payment_no || "-"}
                              </Text>
                            </View>

                            <View style={pdfStyles.detailsRow}>
                              <Text style={pdfStyles.detailsLabel}>
                                Payment Date :
                              </Text>
                              <Text style={pdfStyles.detailsValue}>
                                {invoice.payment_date || "-"}
                              </Text>
                            </View>
                          </>
                        )}
                    </View>
                  </View>
                </View>

                <View
                  style={{
                    flex: 1,
                    borderLeftWidth: 1,
                    borderLeftColor: "#000",
                  }}
                >
                  <PDFCustomerCards
                    document={invoice}
                    isQuotation={isQuotation}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={pdfStyles.contentBody}>
          <PDFLineItems chunks={page.chunks} invoice={invoice} />

          {page.isLastPage && (
            <>
              {showTotals && (
                <PDFTotals document={invoice} isInvoice />
              )}
              {title !== "QUOTATION" && (
                <View
                  style={{
                    marginTop: 0,
                    marginBottom: 5,
                    borderWidth: 1,
                    borderColor: "#000",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text>Total: Rs {formatMoney(invoice.grand_total || 0)}</Text>
                  <Text>Paid Now: Rs {formatMoney(invoice.paid_now || 0)}</Text>
                  <Text>
                    Total Paid: Rs {formatMoney(invoice.paid_amount || 0)}
                  </Text>
                  <Text>Due: Rs {formatMoney(invoice.balance_due || 0)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {page.isLastPage && (
          <View style={pdfStyles.footerBlock} wrap={false}>
            <PDFBottomSection
              company={company}
              qrSrc={qrSrc}
              documentMode={documentMode}
              hasNotes={!!invoice.notes?.trim()}
            />

            {invoice.notes ? (
              <View
                style={{
                  paddingTop: 4,
                  paddingBottom: 20,
                  paddingLeft: 10,
                  width: "100%",
                }}
              >
                <Text style={pdfStyles.notesLabel}>NOTES</Text>
                <Text style={pdfStyles.notesBody}>{invoice.notes}</Text>
              </View>
            ) : null}

            {documentMode === "export" && (
              <View style={pdfStyles.signCol}>
                <PDFSignature
                  documentMode={documentMode}
                  companyName={company.name || company.company_name || ""}
                />
              </View>
            )}
          </View>
        )}

        <Text
          fixed
          style={{
            position: "absolute",
            bottom: -3,
            right: 15,
            fontSize: 8,
            color: "#555",
          }}
        >
          {`Page ${localPageNumber} of ${pagesPerCopy}`}
        </Text>
      </View>
    </Page>
  );

  return (
    <Document>
      {pages.map((page, index) =>
        renderInvoicePage(
          title === "QUOTATION" ? "" : "Original Copy",
          page,
          index + 1,
        ),
      )}
    </Document>
  );
}
