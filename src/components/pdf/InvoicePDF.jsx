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

const TEXT_WIDTH_FACTOR = 0.52;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateLines(text, width, fontSize) {
  const normalized = normalizeText(text);
  if (!normalized) return 1;

  const charsPerLine = Math.max(
    1,
    Math.floor(width / (fontSize * TEXT_WIDTH_FACTOR)),
  );

  return normalized.split(/\s+/).reduce(
    (state, word) => {
      const wordLength = word.length;
      const hardLines = Math.max(1, Math.ceil(wordLength / charsPerLine));

      if (hardLines > 1) {
        return {
          lines: state.lines + hardLines - (state.current === 0 ? 1 : 0),
          current: wordLength % charsPerLine || charsPerLine,
        };
      }

      const nextLength =
        state.current === 0 ? wordLength : state.current + 1 + wordLength;

      if (nextLength <= charsPerLine) {
        return { lines: state.lines, current: nextLength };
      }

      return { lines: state.lines + 1, current: wordLength };
    },
    { lines: 1, current: 0 },
  ).lines;
}

function estimateInvoiceHeaderHeight(invoice = {}, company = {}) {
  const pageWidth =
    LINE_ITEMS_LAYOUT.pageWidth - LINE_ITEMS_LAYOUT.pagePaddingHorizontal * 2;
  const detailsWidth = pageWidth / 2;
  const isGstEnabled = invoice.is_gst_enabled !== 0;
  const customer = invoice.customer || {};
  const address =
    invoice.address ||
    customer.address ||
    [
      customer.city || invoice.city,
      customer.state || invoice.state,
      customer.country || invoice.country,
      customer.pincode || invoice.pincode,
    ]
      .filter(Boolean)
      .join(", ");

  const addressLines = estimateLines(address || "-", detailsWidth - 12, 9);
  const customerLines =
    1 +
    (customer.company || invoice.customer_company ? 1 : 0) +
    addressLines +
    (customer.pan || invoice.customer_pan ? 1 : 0) +
    (customer.phone || invoice.phone || customer.email || invoice.email
      ? 1
      : 0) +
    (isGstEnabled && (customer.gstin || invoice.customer_gstin || invoice.gstin)
      ? 1
      : 0);
  const invoiceDetailRows = Number(invoice.paid_amount || 0) > 0 ? 5 : 3;
  const detailsHeight = Math.max(
    customerLines * 11 + 8,
    invoiceDetailRows * 13 + 4,
  );

  const companyAddressLines = estimateLines(
    company.address || "",
    pageWidth - 120,
    11,
  );
  const headerHeight = Math.max(112, 104 + companyAddressLines * 4);

  return headerHeight + detailsHeight;
}

function estimateFooterHeight({
  invoice = {},
  company = {},
  qrSrc,
  documentMode,
}) {
  const hasQr = Boolean(qrSrc);
  const terms = [
    company.term1,
    company.term2,
    company.term3,
    company.term4,
    company.term5,
  ].filter((term) => normalizeText(term));
  const termLines = Math.max(1, terms.length || 1);
  const termsHeight = 20 + termLines * 11;
  const qrHeight = hasQr ? 118 : 0;
  const bankHeight = documentMode === "print" ? 58 : 70;
  const signatureHeight = documentMode === "print" ? 58 : 18;
  const bottomSectionHeight =
    2 + Math.max(termsHeight, qrHeight, bankHeight, signatureHeight);
  const bankPrintHeight = documentMode === "print" ? 58 : 0;
  const notesLines = invoice.notes
    ? estimateLines(
        invoice.notes,
        LINE_ITEMS_LAYOUT.pageWidth -
          LINE_ITEMS_LAYOUT.pagePaddingHorizontal * 2 -
          16,
        9,
      )
    : 0;
  const notesHeight = invoice.notes ? 18 + notesLines * 12 : 12;

  return (
    bankPrintHeight +
    bottomSectionHeight +
    notesHeight +
    LINE_ITEMS_LAYOUT.footerBottomOffset +
    LINE_ITEMS_LAYOUT.paginationSafetyGap
  );
}

function estimateTotalsHeight(invoice = {}) {
  const isGstEnabled = invoice.is_gst_enabled !== 0;
  const items = invoice.items || [];
  const gstRates = isGstEnabled
    ? new Set(items.map((item) => Number(item.gst_rate || 0)))
    : new Set();
  const gstSummaryRows = isGstEnabled ? Math.max(1, gstRates.size) : 0;
  const totalRows =
    2 +
    (Number(invoice.discount || 0) > 0 ? 1 : 0) +
    (isGstEnabled && Number(invoice.cgst_total || 0) > 0 ? 1 : 0) +
    (isGstEnabled && Number(invoice.sgst_total || 0) > 0 ? 1 : 0) +
    (isGstEnabled && Number(invoice.igst_total || 0) > 0 ? 1 : 0) +
    (Number(invoice.round_off || 0) !== 0 ? 1 : 0);
  const rightHeight = totalRows * 25;
  const amountWordsLines = estimateLines(
    amountToWords(Math.round(Number(invoice.grand_total || 0))),
    310,
    9,
  );
  const leftHeight =
    16 + amountWordsLines * 13 + (isGstEnabled ? 16 + gstSummaryRows * 16 : 0);

  return Math.max(78, rightHeight, leftHeight);
}

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
  const footerReserve = 25;

  const availableBodyHeight =
    LINE_ITEMS_LAYOUT.pageHeight -
    LINE_ITEMS_LAYOUT.pagePaddingTop -
    LINE_ITEMS_LAYOUT.pagePaddingBottom -
    estimateInvoiceHeaderHeight(invoice, company) -
    estimateFooterHeight({
      invoice,
      company,
      qrSrc,
      documentMode,
    }) -
    footerReserve;

  const pages = paginateInvoiceItems({
    items: invoice.items || [],
    invoice,
    itemAreaHeight: Math.max(80, availableBodyHeight),
    totalsHeight: estimateTotalsHeight(invoice),
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
        </View>

        <View style={pdfStyles.contentBody}>
          <PDFLineItems chunks={page.chunks} invoice={invoice} />

          {showTotals && page.isLastPage && (
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
        </View>

        <View style={pdfStyles.footerBlock} wrap={false}>
          <PDFBottomSection
            company={company}
            qrSrc={qrSrc}
            documentMode={documentMode}
            hasNotes={!!hasNotes}
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
  const hasNotes = invoice.notes?.trim();

  return (
    <Document>
      {pages.map((page, index) =>
        renderInvoicePage(
          title === "QUOTATION" ? "" : "Original Copy",
          page,
          index + 1,
        ),
      )}
      {/* {pages.map((page, index) =>
        renderInvoicePage(
        title === "QUOTATION" ? "" : "Customer Copy", 
        page, 
        index + 1),
      )} */}
    </Document>
  );
}
