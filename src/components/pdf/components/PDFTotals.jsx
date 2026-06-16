import { View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../pdfStyles";
import { amountToWords } from "../../../utils/amountToWords";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeDiscountRupee(subtotal, discount, isPercent) {
  const s = round2(subtotal);
  const d = Number(discount || 0);
  if (!d || d <= 0) return 0;
  if (isPercent) return Math.min(s, round2((s * Math.min(100, d)) / 100));
  return Math.min(s, round2(d));
}

function formatCurrency(n) {
  const v = Number(n || 0);

  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getGstTotals(document, isInvoice) {
  const savedCgst = Number(document.cgst_total || 0);
  const savedSgst = Number(document.sgst_total || 0);
  const savedIgst = Number(document.igst_total || 0);

  if (isInvoice && (savedCgst || savedSgst || savedIgst)) {
    return {
      cgst: Math.round(savedCgst),
      sgst: Math.round(savedSgst),
      igst: Math.round(savedIgst),
    };
  }

  const taxTotal = Number(
    document.tax_total || calculateItemTax(document.items || []),
  );
  const sameState =
    String(document.company_state || "").toLowerCase() ===
    String(document.state || "").toLowerCase();

  if (sameState) {
    const cgst = Math.round(taxTotal / 2);
    return {
      cgst,
      sgst: Math.round(taxTotal - cgst),
      igst: 0,
    };
  }

  return {
    cgst: 0,
    sgst: 0,
    igst: Math.round(taxTotal),
  };
}

function calculateItemTax(items) {
  return items.reduce((total, item) => {
    const amount = Number(item.line_total || 0);
    const rate = item.gst_rate == null ? "No GST" : Number(item.gst_rate);
    return total + (amount * rate) / 100;
  }, 0);
}

export default function PDFTotals({ document = {}, isInvoice = false }) {
  const subtotal = round2(document.subtotal);
  const disc = computeDiscountRupee(
    subtotal,
    document.discount,
    document.discount_is_percent,
  );
  const { cgst, sgst, igst } = getGstTotals(document, isInvoice);
  const grand = Math.round(Number(document.grand_total || 0));
  const roundOff = Number(document.round_off || 0);

  // Group items for GST Summary

  const items = document.items || [];
  const gstMap = {};

  const subtotalBeforeDiscount = items.reduce(
    (sum, item) => sum + Number(item.line_total || item.amount || 0),
    0,
  );

  items.forEach((item) => {
    const rate = Number(item.gst_rate || 0);

    const originalTaxable = Number(item.line_total || item.amount || 0);

    // Allocate invoice discount proportionally
    const discountShare =
      subtotalBeforeDiscount > 0
        ? (originalTaxable / subtotalBeforeDiscount) * disc
        : 0;

    const taxable = originalTaxable - discountShare;

    if (!gstMap[rate]) {
      gstMap[rate] = {
        rate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
    }

    gstMap[rate].taxable += taxable;
  });
  Object.values(gstMap).forEach((row) => {
    const tax = round2((row.taxable * row.rate) / 100);

    if (igst > 0) {
      row.igst = tax;
    } else {
      row.cgst = round2(tax / 2);
      row.sgst = round2(tax / 2);
    }

    row.total = round2(row.cgst + row.sgst + row.igst);
  });

  const gstSummaryRows = Object.values(gstMap);
  const hasIGST = gstSummaryRows.some((row) => Number(row.igst) > 0);

  return (
    <>
      <View style={pdfStyles.totalsSection} wrap={false}>
        {/* 1. Amount In Words Section */}
        <View style={pdfStyles.amountInWordsFull}>
          <Text style={pdfStyles.amountWordsLabel}>AMOUNT IN WORDS</Text>
          <Text style={pdfStyles.amountWordsBody}>{amountToWords(grand)}</Text>
          {/* 2. GST Summary Table (Full width) */}
          {document.is_gst_enabled !== 0 && (
          <View style={pdfStyles.gstSummaryTable}>
            <View style={pdfStyles.gstSummaryHeader}>
              <View style={pdfStyles.gstSummaryCol}>
                <Text style={pdfStyles.gstSummaryLabel}>Tax Rate</Text>
              </View>

              <View style={pdfStyles.gstSummaryCol}>
                <Text style={pdfStyles.gstSummaryLabel}>Taxable Amount</Text>
              </View>

              {hasIGST ? (
                <View style={pdfStyles.gstSummaryCol}>
                  <Text style={pdfStyles.gstSummaryLabel}>IGST Amt</Text>
                </View>
              ) : (
                <>
                  <View style={pdfStyles.gstSummaryCol}>
                    <Text style={pdfStyles.gstSummaryLabel}>CGST Amt</Text>
                  </View>

                  <View style={pdfStyles.gstSummaryCol}>
                    <Text style={pdfStyles.gstSummaryLabel}>SGST Amt</Text>
                  </View>
                </>
              )}

              <View style={pdfStyles.gstSummaryColLast}>
                <Text style={pdfStyles.gstSummaryLabel}>Total Tax</Text>
              </View>
            </View>

            {gstSummaryRows.map((row, i) => (
              <View
                key={i}
                style={
                  i === gstSummaryRows.length - 1
                    ? pdfStyles.gstSummaryRowLast
                    : pdfStyles.gstSummaryRow
                }
              >
                <View style={pdfStyles.gstSummaryCol}>
                  <Text
                    style={[pdfStyles.gstSummaryValue, { textAlign: "center" }]}
                  >
                    {row.rate}%
                  </Text>
                </View>

                <View style={pdfStyles.gstSummaryCol}>
                  <Text style={pdfStyles.gstSummaryValue}>
                    {formatCurrency(row.taxable)}
                  </Text>
                </View>

                {hasIGST ? (
                  <View style={pdfStyles.gstSummaryCol}>
                    <Text style={pdfStyles.gstSummaryValue}>
                      {formatCurrency(row.igst)}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={pdfStyles.gstSummaryCol}>
                      <Text style={pdfStyles.gstSummaryValue}>
                        {formatCurrency(row.cgst)}
                      </Text>
                    </View>

                    <View style={pdfStyles.gstSummaryCol}>
                      <Text style={pdfStyles.gstSummaryValue}>
                        {formatCurrency(row.sgst)}
                      </Text>
                    </View>
                  </>
                )}

                <View style={pdfStyles.gstSummaryColLast}>
                  <Text style={pdfStyles.gstSummaryValue}>
                    {formatCurrency(row.total)}
                  </Text>
                </View>
              </View>
            ))}
            <View style={pdfStyles.gstSummaryTotalRow}>
              <View style={pdfStyles.gstSummaryCol}>
                <Text style={pdfStyles.gstSummaryLabel}>Total</Text>
              </View>
              <View style={pdfStyles.gstSummaryCol}>
                <Text style={pdfStyles.gstSummaryLabel}>
                  {formatCurrency(
                    gstSummaryRows.reduce(
                      (sum, row) => sum + Number(row.taxable || 0),
                      0,
                    ),
                  )}
                </Text>
              </View>
              {hasIGST ? (
                <>
                  <View style={pdfStyles.gstSummaryCol}>
                    <Text style={pdfStyles.gstSummaryLabel}>
                      {formatCurrency(
                        gstSummaryRows.reduce(
                          (sum, row) => sum + Number(row.igst || 0),
                          0,
                        ),
                      )}
                    </Text>
                  </View>

                  <View style={pdfStyles.gstSummaryColLast}>
                    <Text style={pdfStyles.gstSummaryLabel}>
                      {formatCurrency(
                        gstSummaryRows.reduce(
                          (sum, row) => sum + Number(row.total || 0),
                          0,
                        ),
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={pdfStyles.gstSummaryCol}>
                    <Text style={pdfStyles.gstSummaryLabel}>
                      {formatCurrency(
                        gstSummaryRows.reduce(
                          (sum, row) => sum + Number(row.cgst || 0),
                          0,
                        ),
                      )}
                    </Text>
                  </View>

                  <View style={pdfStyles.gstSummaryCol}>
                    <Text style={pdfStyles.gstSummaryLabel}>
                      {formatCurrency(
                        gstSummaryRows.reduce(
                          (sum, row) => sum + Number(row.sgst || 0),
                          0,
                        ),
                      )}
                    </Text>
                  </View>

                  <View style={pdfStyles.gstSummaryColLast}>
                    <Text style={pdfStyles.gstSummaryLabel}>
                      {formatCurrency(
                        gstSummaryRows.reduce(
                          (sum, row) => sum + Number(row.total || 0),
                          0,
                        ),
                      )}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
          )}
        </View>
        
        <View style={pdfStyles.totalsWrapper}>
          {/* Intermediate Total Rows Section */}
          <View style={pdfStyles.totalRowFull}>
            <Text style={pdfStyles.totalLabel}>Subtotal</Text>
            <Text style={pdfStyles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>

          {disc > 0 && (
            <View style={pdfStyles.totalRowFull}>
              <Text style={pdfStyles.totalLabel}>Discount</Text>
              <Text style={pdfStyles.totalValue}>{formatCurrency(disc)}</Text>
            </View>
          )}

          {document.is_gst_enabled !== 0 && cgst > 0 && (
            <View style={pdfStyles.totalRowFull}>
              <Text style={pdfStyles.totalLabel}>CGST Total</Text>
              <Text style={pdfStyles.totalValue}>{formatCurrency(cgst)}</Text>
            </View>
          )}
          {document.is_gst_enabled !== 0 && sgst > 0 && (
            <View style={pdfStyles.totalRowFull}>
              <Text style={pdfStyles.totalLabel}>SGST Total</Text>
              <Text style={pdfStyles.totalValue}>{formatCurrency(sgst)}</Text>
            </View>
          )}
          {document.is_gst_enabled !== 0 && igst > 0 && (
            <View style={pdfStyles.totalRowFull}>
              <Text style={pdfStyles.totalLabel}>IGST Total</Text>
              <Text style={pdfStyles.totalValue}>{formatCurrency(igst)}</Text>
            </View>
          )}

          {/* 3. Round Off Row (Immediately after Item Table / Tax Totals) */}
          {Number(roundOff) !== 0 && (
            <View style={pdfStyles.totalRowFull}>
              <Text style={pdfStyles.totalLabel}>Rounded Off</Text>
              <Text style={pdfStyles.totalValue}>
                {formatCurrency(roundOff)}
              </Text>
            </View>
          )}

          {/* 4. Grand Total Row directly below Round Off */}
          <View style={pdfStyles.grandTotalRowFull}>
            <Text style={pdfStyles.grandTotalLabel}>Grand Total</Text>
            <Text style={pdfStyles.grandTotalValue}>
              {formatCurrency(grand)}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}
