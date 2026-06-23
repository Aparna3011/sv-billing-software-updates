import { Document, Page, View, Text } from "@react-pdf/renderer";

import { pdfStyles } from "./pdfStyles";

import PDFHeader from "./components/PDFHeader";
import PDFLineItems, {
  buildInvoiceItemChunks,
  LINE_ITEMS_LAYOUT,
  estimateCompanyHeaderHeight,
  estimateTotalsSectionHeight,
  estimateFooterHeight,
  estimateRowSegmentHeight,
  groupChunksIntoRows,
  estimateLines,
} from "./components/PDFLineItems";
import PDFTotals from "./components/PDFTotals";
import PDFBottomSection from "./components/PDFBottomSection";
import { PartyBlock, dateValue } from "./components/PDFDocumentBlocks";
import PDFSignature from "./components/PDFSignature";

function estimateCustomerDetailsHeightForRecurring(recurring) {
  const pageWidth =
    LINE_ITEMS_LAYOUT.pageWidth - LINE_ITEMS_LAYOUT.pagePaddingHorizontal * 2;
  const detailsWidth = pageWidth / 2;
  const isGstEnabled = recurring.is_gst_enabled !== 0;
  const customer = recurring.customer || {};
  const address =
    recurring.address ||
    customer.address ||
    [
      customer.city || recurring.city,
      customer.state || recurring.state,
      customer.country || recurring.country,
      customer.pincode || recurring.pincode,
    ]
      .filter(Boolean)
      .join(", ");

  const addressLines = estimateLines(address || "-", detailsWidth - 12, 9);
  const customerLines =
    1 +
    (customer.company || recurring.customer_company ? 1 : 0) +
    addressLines +
    (customer.pan || recurring.customer_pan ? 1 : 0) +
    (customer.phone || recurring.phone || customer.email || recurring.email
      ? 1
      : 0) +
    (isGstEnabled &&
    (customer.gstin || recurring.customer_gstin || recurring.gstin)
      ? 1
      : 0);

  const subscriberHeight = customerLines * 11 + 8;
  const detailsHeight = 5 * 13 + 4; // 5 rows * 13 + 4 = 69pt

  return Math.max(subscriberHeight, detailsHeight);
}

function estimatePageChunksHeight(pageChunks, invoice = {}) {
  const rows = groupChunksIntoRows(pageChunks);
  const rowsHeight = rows.reduce(
    (total, row) => total + estimateRowSegmentHeight(row, invoice),
    0,
  );
  return LINE_ITEMS_LAYOUT.tableHeaderHeight + rowsHeight;
}

function paginateRecurringItems({
  items = [],
  recurring = {},
  company = {},
  qrSrc = null,
  documentMode = "export",
}) {
  const chunks = buildInvoiceItemChunks(items);

  const pageHeight = LINE_ITEMS_LAYOUT.pageHeight;
  const verticalPadding =
    LINE_ITEMS_LAYOUT.pagePaddingTop + LINE_ITEMS_LAYOUT.pagePaddingBottom;
  const tableHeaderHeight = LINE_ITEMS_LAYOUT.tableHeaderHeight;
  const safetyGap = LINE_ITEMS_LAYOUT.paginationSafetyGap;
  const footerReserve = 25;

  const companyHeaderHeight = estimateCompanyHeaderHeight(company);
  const customerDetailsHeight =
    estimateCustomerDetailsHeightForRecurring(recurring);

  const totalsSectionHeight = estimateTotalsSectionHeight(recurring, "INVOICE");
  const footerHeight = estimateFooterHeight({
    invoice: recurring,
    company,
    qrSrc,
    documentMode,
    isQuotation: false,
  });

  const pages = [];
  let cursor = 0;
  let pageIndex = 0;

  while (cursor < chunks.length) {
    const isFirstPage = pageIndex === 0;
    const remainingChunks = chunks.slice(cursor);
    const remainingItemsHeight =
      estimatePageChunksHeight(remainingChunks, recurring) - tableHeaderHeight;

    const currentHeaderHeight =
      companyHeaderHeight + (isFirstPage ? customerDetailsHeight : 0);
    const totalSpaceNeeded =
      remainingItemsHeight +
      tableHeaderHeight +
      totalsSectionHeight +
      footerHeight +
      footerReserve;
    const availableHeightForLastPage =
      pageHeight - verticalPadding - currentHeaderHeight - safetyGap;

    if (totalSpaceNeeded <= availableHeightForLastPage) {
      pages.push({
        chunks: remainingChunks,
        isFirstPage,
        isLastPage: true,
      });
      break;
    }

    const availableHeightForItems =
      pageHeight -
      verticalPadding -
      currentHeaderHeight -
      tableHeaderHeight -
      safetyGap -
      footerReserve;
    const pageChunks = [];

    while (cursor < chunks.length) {
      const nextChunk = chunks[cursor];
      const isLastChunk = cursor === chunks.length - 1;
      if (isLastChunk && pageChunks.length > 0) {
        break;
      }
      const tentativeChunks = [...pageChunks, nextChunk];
      const tentativeHeight = estimatePageChunksHeight(
        tentativeChunks,
        recurring,
      );

      if (tentativeHeight > availableHeightForItems && pageChunks.length > 0) {
        break;
      }

      pageChunks.push(nextChunk);
      cursor += 1;
    }

    if (pageChunks.length === 0 && cursor < chunks.length) {
      pageChunks.push(chunks[cursor]);
      cursor += 1;
    }

    pages.push({
      chunks: pageChunks,
      isFirstPage,
      isLastPage: false,
    });

    pageIndex += 1;
  }

  if (pages.length === 0) {
    pages.push({
      chunks: [],
      isFirstPage: true,
      isLastPage: true,
    });
  }

  return pages;
}

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

  const pages = paginateRecurringItems({
    items: recurring.items || [],
    recurring,
    company,
    qrSrc,
    documentMode,
  });

  const pagesPerCopy = pages.length;

  const renderRecurringPage = (copyLabel, page, localPageNumber) => (
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
            logoDataUrl={logoDataUrl}
          />

          {page.isFirstPage && (
            <View style={pdfStyles.invoiceDetailsSection}>
              <View style={pdfStyles.infoRow}>
                <View style={pdfStyles.infoColumn}>
                  <View style={pdfStyles.invoiceDetailsSection}>
                    <View style={pdfStyles.detailsColumn}>
                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>
                          Recurring No :
                        </Text>
                        <Text style={pdfStyles.detailsValue}>
                          {recurring.plan_no ||
                            recurring.recurring_invoice_no ||
                            recurring.document_no ||
                            "-"}
                        </Text>
                      </View>

                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>
                          Recurring Date :
                        </Text>
                        <Text style={pdfStyles.detailsValue}>
                          {dateValue(
                            recurring.invoice_start_date ||
                              recurring.document_date,
                          )}
                        </Text>
                      </View>

                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Due Date :</Text>
                        <Text style={pdfStyles.detailsValue}>
                          {dateValue(recurring.due_date)}
                        </Text>
                      </View>

                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Payment No :</Text>
                        <Text style={pdfStyles.detailsValue}>
                          {recurring.payment_no || "-"}
                        </Text>
                      </View>

                      <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>
                          Payment Date :
                        </Text>
                        <Text style={pdfStyles.detailsValue}>
                          {dateValue(recurring.payment_date)}
                        </Text>
                      </View>
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
                  <View style={pdfStyles.customerBoxesRow}>
                    <PartyBlock
                      title="TO"
                      party={party}
                      showPan={false}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={pdfStyles.contentBody}>
          <PDFLineItems chunks={page.chunks} invoice={recurring} />

          {page.isLastPage && <PDFTotals document={recurring} isInvoice />}
        </View>

        {page.isLastPage && (
          <PDFBottomSection
            company={company}
            qrSrc={qrSrc}
            documentMode={documentMode}
          />
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
        renderRecurringPage("Billing Copy", page, index + 1),
      )}
    </Document>
  );
}
