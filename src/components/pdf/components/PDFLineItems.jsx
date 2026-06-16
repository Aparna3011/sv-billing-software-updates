import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../pdfStyles";

export const LINE_ITEMS_LAYOUT = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  pagePaddingTop: 14,
  pagePaddingBottom: 14,
  pagePaddingHorizontal: 30,
  tableHeaderHeight: 24,
  tableRowMinHeight: 24,
  tableRowVerticalPadding: 2,
  tableRowHorizontalPadding: 12,
  descCellHorizontalPadding: 4,
  itemNameFontSize: 10,
  itemNameLineHeight: 11,
  itemNameMarginBottom: 1,
  itemNameLeftPadding: 10,
  descriptionFontSize: 9,
  /** Matches pdfStyles.itemSub lineHeight: 1.2 × fontSize 9 */
  descriptionLineHeight: 11,
  descriptionBulletPaddingLeft: 40,
  footerBottomOffset: 18,
  paginationSafetyGap: 4,
};

const FONT_WIDTH_FACTOR = 0.42;

const money = (value) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "0.00";
  return numericValue.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPercent = (value) => {
  const numericValue = Number(
    String(value ?? "")
      .replace("%", "")
      .trim(),
  );
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue.toFixed(2).replace(/\.00$/, "");
};

const round = (value) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
};

const normalizeState = (state) =>
  String(state || "")
    .trim()
    .toLowerCase();

const getDescriptionPointText = (point) =>
  String(point?.point_text ?? point ?? "").trim();

export const normalizeDescriptionPoints = (item) =>
  Array.isArray(item?.descriptionPoints) && item.descriptionPoints.length > 0
    ? item.descriptionPoints
        .map(getDescriptionPointText)
        .filter((point) => point.length > 0)
    : String(item?.description || "")
        .split("\n")
        .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
        .filter(Boolean);

export function getLineItemColumnLayout(invoice = {}) {
  const isGstEnabled = Number(invoice?.is_gst_enabled ?? 1) !== 0;

  const isOverseas =
    String(invoice?.gst_treatment || "").toLowerCase() === "overseas";

  const sameState =
    normalizeState(invoice?.state) ===
    normalizeState(invoice?.company_state);

  const showCgstSgst =
    Boolean(isGstEnabled && !isOverseas && sameState);

  const showIgst =
    Boolean(isGstEnabled && !isOverseas && !sameState);

  const fixedWidth = 32; // Sum of SN(3), Qty(5), Price(10), Amount(14)
  const gstWidth =
    (showCgstSgst ? 30 : 0) +
    (showIgst ? 15 : 0);

  const descWidth = 100 - fixedWidth - gstWidth;

  return {
    isGstEnabled,
    isOverseas,
    sameState,
    showCgstSgst,
    showIgst,
    descWidth,
    descStyle: {
      width: `${descWidth}%`,
    },
  };
}

export function getLineItemDescWidths(invoice = {}) {
  const { descWidth } = getLineItemColumnLayout(invoice);
  const tableWidth =
    LINE_ITEMS_LAYOUT.pageWidth - LINE_ITEMS_LAYOUT.pagePaddingHorizontal * 2;
  const rowContentWidth =
    tableWidth - LINE_ITEMS_LAYOUT.tableRowHorizontalPadding;
  const descCellWidth =
    (rowContentWidth * descWidth) / 100 -
    LINE_ITEMS_LAYOUT.descCellHorizontalPadding;

  return {
    nameWidth: Math.max(
      1,
      descCellWidth - LINE_ITEMS_LAYOUT.itemNameLeftPadding,
    ),
    bulletWidth: Math.max(
      1,
      descCellWidth - LINE_ITEMS_LAYOUT.descriptionBulletPaddingLeft,
    ),
  };
}

function estimateWrappedLines(text, width, fontSize) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 1;

  const usableChars = Math.max(
    1,
    Math.floor(width / (fontSize * FONT_WIDTH_FACTOR)),
  );

  return normalized.split(/\s+/).reduce(
    (state, word) => {
      const wordLength = word.length;
      const hardLines = Math.max(1, Math.ceil(wordLength / usableChars));

      if (hardLines > 1) {
        return {
          lines: state.lines + hardLines - (state.current === 0 ? 1 : 0),
          current: wordLength % usableChars || usableChars,
        };
      }

      const nextLength =
        state.current === 0 ? wordLength : state.current + 1 + wordLength;

      if (nextLength <= usableChars) {
        return { lines: state.lines, current: nextLength };
      }

      return { lines: state.lines + 1, current: wordLength };
    },
    { lines: 1, current: 0 },
  ).lines;
}

export function getServiceDisplayName(item) {
  return item?.name || item?.item_name || "-";
}

export function buildInvoiceItemChunks(items = []) {
  const chunks = [];

  items.forEach((item, itemIndex) => {
    chunks.push({
      type: "service-header",
      item,
      itemIndex,
    });

    normalizeDescriptionPoints(item).forEach((pointText, pointIndex) => {
      chunks.push({
        type: "description-point",
        item,
        itemIndex,
        pointIndex,
        pointText,
      });
    });
  });

  return chunks;
}

/** Height of one visual table row (name + bullets grouped together) */
export function estimateRowSegmentHeight(row, invoice = {}) {
  const { nameWidth, bulletWidth } = getLineItemDescWidths(invoice);
  let textHeight = 0;

  if (row.showServiceName) {
    const nameLines = estimateWrappedLines(
      getServiceDisplayName(row.item),
      nameWidth,
      LINE_ITEMS_LAYOUT.itemNameFontSize,
    );
    textHeight +=
      nameLines * LINE_ITEMS_LAYOUT.itemNameLineHeight +
      LINE_ITEMS_LAYOUT.itemNameMarginBottom;
  }

  for (const point of row.descriptionPoints || []) {
    const pointLines = estimateWrappedLines(
      `- ${point}`,
      bulletWidth,
      LINE_ITEMS_LAYOUT.descriptionFontSize,
    );
    textHeight += pointLines * LINE_ITEMS_LAYOUT.descriptionLineHeight;
  }

  return Math.max(
    LINE_ITEMS_LAYOUT.tableRowMinHeight,
    Math.ceil(textHeight + LINE_ITEMS_LAYOUT.tableRowVerticalPadding * 2 + 2),
  );
}

export function groupChunksIntoRows(chunks = []) {
  const rows = [];
  let current = null;

  for (const chunk of chunks) {
    if (chunk.type === "service-header") {
      if (current) rows.push(current);
      current = {
        item: chunk.item,
        itemIndex: chunk.itemIndex,
        showServiceName: true,
        showNumericColumns: true,
        descriptionPoints: [],
        isContinuation: false,
      };
      continue;
    }

    if (chunk.type === "description-point") {
      if (!current || current.itemIndex !== chunk.itemIndex) {
        if (current) rows.push(current);
        current = {
          item: chunk.item,
          itemIndex: chunk.itemIndex,
          showServiceName: true,
          showNumericColumns: false,
          descriptionPoints: [],
          isContinuation: true,
        };
      }
      current.descriptionPoints.push(chunk.pointText);
    }
  }

  if (current) rows.push(current);
  return rows;
}

function estimatePageChunksHeight(pageChunks, invoice = {}) {
  const rows = groupChunksIntoRows(pageChunks);
  const rowsHeight = rows.reduce(
    (total, row) => total + estimateRowSegmentHeight(row, invoice),
    0,
  );

  return LINE_ITEMS_LAYOUT.tableHeaderHeight + rowsHeight;
}

// function isContinuationOnlyPage(pageChunks) {
//   const rows = groupChunksIntoRows(pageChunks);
//   return rows.some((row) => row.isContinuation);
// }

// function wouldStartNewServiceAfterContinuation(pageChunks, nextChunk) {
//   if (nextChunk.type !== "service-header" || pageChunks.length === 0) {
//     return false;
//   }

//   return isContinuationOnlyPage(pageChunks);
// }

export function estimateInvoiceItemHeight(item, invoice = {}) {
  return estimateRowSegmentHeight(
    {
      item,
      showServiceName: true,
      showNumericColumns: true,
      descriptionPoints: normalizeDescriptionPoints(item),
    },
    invoice,
  );
}

export function paginateInvoiceItems({
  items = [],
  invoice = {},
  itemAreaHeight,
  totalsHeight = 0,
}) {
  const chunks = buildInvoiceItemChunks(items);
  const normalCapacity = Math.max(
    1,
    itemAreaHeight -
      LINE_ITEMS_LAYOUT.tableHeaderHeight -
      LINE_ITEMS_LAYOUT.paginationSafetyGap,
  );
  const lastPageCapacity = Math.max(
    1,
    normalCapacity - totalsHeight - LINE_ITEMS_LAYOUT.paginationSafetyGap,
  );

  const remainingHeightFrom = (index) =>
    estimatePageChunksHeight(chunks.slice(index), invoice) -
    LINE_ITEMS_LAYOUT.tableHeaderHeight;

  const pages = [];
  let cursor = 0;

  while (cursor < chunks.length) {
    const remaining = remainingHeightFrom(cursor);

    if (remaining <= lastPageCapacity) {
      pages.push({
        chunks: chunks.slice(cursor),
        isLastPage: true,
      });
      break;
    }

    const pageChunks = [];

    while (cursor < chunks.length) {
      const nextChunk = chunks[cursor];

      // if (wouldStartNewServiceAfterContinuation(pageChunks, nextChunk)) {
      //   break;
      // }

      const tentativeChunks = [...pageChunks, nextChunk];
      const tentativeHeight = estimatePageChunksHeight(
        tentativeChunks,
        invoice,
      );
      const isLastPossiblePage =
        remainingHeightFrom(cursor) <= lastPageCapacity;

      const capacity = isLastPossiblePage
        ? lastPageCapacity + LINE_ITEMS_LAYOUT.tableHeaderHeight
        : normalCapacity + LINE_ITEMS_LAYOUT.tableHeaderHeight;

      // const restFitsOnFinalPage =
      //   remainingHeightFrom(cursor) <= lastPageCapacity;

      // if (pageChunks.length > 0 && restFitsOnFinalPage) {
      //   break;
      // }

      if (tentativeHeight > capacity && pageChunks.length > 0) {
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
      isLastPage: false,
    });
  }

  if (pages.length === 0) {
    pages.push({ chunks: [], isLastPage: true });
  }

  let normalizedPages = pages.map((page, index) => ({
    ...page,
    isLastPage: index === pages.length - 1,
  }));

  const maxLastPageHeight =
    lastPageCapacity + LINE_ITEMS_LAYOUT.tableHeaderHeight;

  if (normalizedPages.length > 1) {
    const lastPage = normalizedPages[normalizedPages.length - 1];
    const overflowChunks = [];

    while (lastPage.chunks.length > 0) {
      const currentHeight = estimatePageChunksHeight(lastPage.chunks, invoice);
      if (currentHeight <= maxLastPageHeight) break;

      overflowChunks.unshift(lastPage.chunks.pop());
    }

    if (overflowChunks.length > 0) {
      lastPage.isLastPage = false;

      if (lastPage.chunks.length === 0) {
        normalizedPages.pop();
      }

      normalizedPages.push({
        chunks: overflowChunks,
        isLastPage: true,
      });
    }
  }

  return normalizedPages.map((page, index) => ({
    ...page,
    isLastPage: index === normalizedPages.length - 1,
  }));
}

function resolveItemTax(item, invoice, isOverseas, sameState) {
  const gstRate =
    Number(
      String(item.gst_rate ?? "")
        .replace("%", "")
        .trim(),
    ) || 0;
  const amount = round(item.line_total ?? item.total ?? 0);

  const cgstAmount = round(item.cgst || 0);
  const sgstAmount = round(item.sgst || 0);
  const igstAmount = round(item.igst || 0);
  const hasSavedTax = cgstAmount > 0 || sgstAmount > 0 || igstAmount > 0;

  let resolvedCgst = cgstAmount;
  let resolvedSgst = sgstAmount;
  let resolvedIgst = igstAmount;

  if (!hasSavedTax && gstRate > 0 && !isOverseas && amount > 0) {
    if (sameState) {
      const taxTotal = round((amount * gstRate) / 100);
      resolvedCgst = round(taxTotal / 2);
      resolvedSgst = round(taxTotal - resolvedCgst);
    } else {
      resolvedIgst = round((amount * gstRate) / 100);
    }
  }

  return {
    amount,
    cgstRate: resolvedCgst > 0 ? gstRate / 2 : 0,
    sgstRate: resolvedSgst > 0 ? gstRate / 2 : 0,
    igstRate: resolvedIgst > 0 ? gstRate : 0,
    resolvedCgst,
    resolvedSgst,
    resolvedIgst,
  };
}

function ThCell({ style, textStyle, children }) {
  return (
    <View style={style}>
      <Text style={textStyle || pdfStyles.thText}>{children}</Text>
    </View>
  );
}

function TdCell({ style, children, right, center }) {
  return (
    <View style={style}>
      <Text
        style={[
          pdfStyles.tdText,
          right && pdfStyles.tdTextRight,
          center && pdfStyles.tdTextCenter,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

function EmptyTdCell({ style }) {
  return <View style={style} />;
}

function LineItemRow({
  row,
  invoice,
  showCgstSgst,
  showIgst,
  descStyle,
  isOverseas,
  sameState,
}) {
  const {
    item,
    itemIndex,
    showServiceName,
    showNumericColumns,
    descriptionPoints,
  } = row;
  const {
    amount,
    cgstRate,
    sgstRate,
    igstRate,
    resolvedCgst,
    resolvedSgst,
    resolvedIgst,
  } = resolveItemTax(item, invoice, isOverseas, sameState);

  return (
    <View style={pdfStyles.tableBodyRow} wrap={false}>
      <TdCell style={pdfStyles.cCellSN} center>
        {showNumericColumns ? itemIndex + 1 : ""}
      </TdCell>
      <View style={[pdfStyles.cCellDesc, descStyle]}>
        {showServiceName ? (
          <Text style={pdfStyles.itemName}>{getServiceDisplayName(item)}</Text>
        ) : null}
        {descriptionPoints.map((point, idx) => (
          <Text key={idx} style={pdfStyles.itemSub}>
            - {point}
          </Text>
        ))}
      </View>
      {showNumericColumns ? (
        <>
          {/* <TdCell style={pdfStyles.cCellHSN} center>
            {item.hsn_code || item.sac_code || "-"}
          </TdCell> */}
          <TdCell style={pdfStyles.cCellQty} center>
            {String(item.qty ?? "")}
          </TdCell>
          <TdCell style={pdfStyles.cCellPrice} right>
            {money(item.rate)}
          </TdCell>
          {showCgstSgst && (
            <>
              <TdCell style={pdfStyles.cCellCGSTRate} center>
                {formatPercent(cgstRate)}
              </TdCell>
              <TdCell style={pdfStyles.cCellCGSTAmt} right>
                {money(resolvedCgst)}
              </TdCell>
              <TdCell style={pdfStyles.cCellSGSTRate} center>
                {formatPercent(sgstRate)}
              </TdCell>
              <TdCell style={pdfStyles.cCellSGSTAmt} right>
                {money(resolvedSgst)}
              </TdCell>
            </>
          )}
          {showIgst && (
            <>
              <TdCell style={pdfStyles.cCellIGSTRate} center>
                {formatPercent(igstRate)}
              </TdCell>
              <TdCell style={pdfStyles.cCellIGSTAmt} right>
                {money(resolvedIgst)}
              </TdCell>
            </>
          )}
          <TdCell style={pdfStyles.cCellAmount} right>
            {money(amount)}
          </TdCell>
        </>
      ) : (
        <>
          {/* <EmptyTdCell style={pdfStyles.cCellHSN} /> */}
          <EmptyTdCell style={pdfStyles.cCellQty} />
          <EmptyTdCell style={pdfStyles.cCellPrice} />
          {showCgstSgst && (
            <>
              <EmptyTdCell style={pdfStyles.cCellCGSTRate} />
              <EmptyTdCell style={pdfStyles.cCellCGSTAmt} />
              <EmptyTdCell style={pdfStyles.cCellSGSTRate} />
              <EmptyTdCell style={pdfStyles.cCellSGSTAmt} />
            </>
          )}
          {showIgst && (
            <>
              <EmptyTdCell style={pdfStyles.cCellIGSTRate} />
              <EmptyTdCell style={pdfStyles.cCellIGSTAmt} />
            </>
          )}
          <EmptyTdCell style={pdfStyles.cCellAmount} />
        </>
      )}
    </View>
  );
}

export default function PDFLineItems({ chunks = [], invoice = {} }) {
  const { isOverseas, sameState, showCgstSgst, showIgst, descStyle } =
    getLineItemColumnLayout(invoice);
  const rows = groupChunksIntoRows(chunks);

  return (
    <View style={pdfStyles.tableOuterGST}>
      <View style={pdfStyles.tableHeaderRow}>
        <ThCell style={pdfStyles.hCellSN} textStyle={pdfStyles.thTextCenter}>
          SN
        </ThCell>
        <ThCell
          style={[pdfStyles.hCellDesc, descStyle]}
          textStyle={pdfStyles.thTextCenter}
        >
          Services Details
        </ThCell>
        {/* <ThCell style={pdfStyles.hCellHSN} textStyle={pdfStyles.thTextCenter}>
          SAC
        </ThCell> */}
        <ThCell style={pdfStyles.hCellQty} textStyle={pdfStyles.thTextCenter}>
          Qty
        </ThCell>
        <ThCell style={pdfStyles.hCellPrice} textStyle={pdfStyles.thTextRight}>
          Price
        </ThCell>
        {showCgstSgst && (
          <>
            <ThCell
              style={pdfStyles.hCellCGSTRate}
              textStyle={pdfStyles.thTextCenter}
            >
              CGST %
            </ThCell>
            <ThCell
              style={pdfStyles.hCellCGSTAmt}
              textStyle={pdfStyles.thTextRight}
            >
              CGST Amt
            </ThCell>
            <ThCell
              style={pdfStyles.hCellSGSTRate}
              textStyle={pdfStyles.thTextCenter}
            >
              SGST %
            </ThCell>
            <ThCell
              style={pdfStyles.hCellSGSTAmt}
              textStyle={pdfStyles.thTextRight}
            >
              SGST Amt
            </ThCell>
          </>
        )}
        {showIgst && (
          <>
            <ThCell
              style={pdfStyles.hCellIGSTRate}
              textStyle={pdfStyles.thTextCenter}
            >
              IGST %
            </ThCell>
            <ThCell
              style={pdfStyles.hCellIGSTAmt}
              textStyle={pdfStyles.thTextRight}
            >
              IGST Amt
            </ThCell>
          </>
        )}
        <ThCell style={pdfStyles.hCellAmount} textStyle={pdfStyles.thTextRight}>
          Amount
        </ThCell>
      </View>

      {rows.map((row, rowIndex) => (
        <LineItemRow
          key={`line-${row.itemIndex}-${rowIndex}-${row.isContinuation ? "c" : "h"}`}
          row={row}
          invoice={invoice}
          showCgstSgst={showCgstSgst}
          showIgst={showIgst}
          descStyle={descStyle}
          isOverseas={isOverseas}
          sameState={sameState}
        />
      ))}
    </View>
  );
}
