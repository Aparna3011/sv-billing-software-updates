import { StyleSheet } from "@react-pdf/renderer";
import { Bold } from "lucide-react";

export const COLORS = {
  primary: "#000000",
  secondary: "#000000",
  dark: "#000000",
  light: "#FFFFFF",
  border: "#000000",
  white: "#FFFFFF",
  text: "#000000",
  muted: "#000000",
};

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
    position: "relative",
  },

  invoiceOuterBorder: {
    position: "absolute",
    top: 14,
    left: 30,
    right: 30,
    bottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "solid",
    zIndex: 0,
  },

  invoiceContent: {
    width: "100%",
    flexDirection: "column",
    minHeight: "100%",
    flexGrow: 1,
    zIndex: 1,
  },

  contentBody: {
    flexGrow: 1,
  },

  footerBlock: {
    position: "absolute",
    width: "100%",
    bottom: 30,
    backgroundColor: COLORS.white,
    flexDirection: "column",
  },

  // ===== HEADER SECTION =====
  topInfoRow: {
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 2,
    paddingBottom: 2,
  },

  gstinText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },

  originalCopy: {
    fontSize: 10,
    // fontWeight: "bold",
  },

  headerContainer: {
    // borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 3,
    marginBottom: 0,
    minHeight: 100,
  },

  headerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },

  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    width: 100,
    height: 100,
    flexShrink: 0,
    paddingRight: 8,
    justifyContent: "center",
  },

  logoWrap: {
    position: "relative",
  },

  logo: {
    width: 100,
    height: 100,
    objectFit: "contain",
  },

  logoFallback: {
    width: 100,
    height: 100,
    // borderWidth: 1,
    borderBottomWidth: 1,

    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: COLORS.white,
  },

  logoFallbackText: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: 900,
  },

  companySection: {
    flex: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 2,
    paddingTop: 24,
  },

  companyName: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    marginBottom: 1,
    textAlign: "center",
  },

  docTitle: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    textAlign: "center",
    textDecoration: "underline",

  },

  companyInfo: {
    fontSize: 11,
    color: COLORS.text,
    marginBottom: 0,
    textAlign: "center",
    lineHeight: 1.3,
  },
  companyInfoBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  // ===== INVOICE DETAILS SECTION =====
  invoiceDetailsSection: {
    // borderBottomWidth: 1,
    // borderColor: COLORS.border,
    flexDirection: "row",
    marginBottom: 0,
  },

  detailsColumn: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  detailsColumnLast: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  detailsRow: {
    flexDirection: "row",
    marginBottom: 1,
    // borderBottomWidth: 1,
    // borderBottomColor: COLORS.border,
    paddingBottom: 1,
  },

  detailsLabel: {
    width: "40%",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },

  detailsValue: {
    width: "60%",
    fontSize: 9,
    color: COLORS.text,
  },

  infoRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  infoColumn: {
    flex: 1,
  },

  // ===== CUSTOMER BOXES SECTION =====
  customerBoxesRow: {
    flexDirection: "row",
    // borderWidth: 1,
    // borderColor: COLORS.border,
    marginBottom: 2,
  },

  customerBox: {
    flex: 1,
    // borderRightWidth: 1,
    // borderRightColor: COLORS.border,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },

  customerBoxLast: {
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },

  boxTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
    textTransform: "uppercase",
  },

  boxLine: {
    fontSize: 9,
    marginBottom: 1,
    lineHeight: 1.2,
  },

  // ===== TABLE STYLES =====
  tableOuter: {
    // borderBottomWidth: 1,
    // borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 2,
    backgroundColor: COLORS.white,
  },

  tableOuterGST: {
    // borderBottomWidth: 1,
    // borderTopWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 0,
    marginTop: 0,
    backgroundColor: COLORS.white,
    borderBottomWidth: 0,
  },

  tableHeaderRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
    backgroundColor: "#EEEEEE",
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 24,
  },

  // Item table headers (13 columns for GST invoice)
  hCellSN: {
    width: "3%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellDesc: {
    width: "35%",
    paddingHorizontal: 4,
    paddingLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  // hCellHSN: {
  //   width: "8%",
  //   paddingHorizontal: 1,
  //   justifyContent: "center",
  //   alignItems: "center",
  // },

  hCellQty: {
    width: "5%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellPrice: {
    width: "10%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellCGSTRate: {
    width: "6%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellCGSTAmt: {
    width: "9%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellSGSTRate: {
    width: "6%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellSGSTAmt: {
    width: "9%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellIGSTRate: {
    width: "6%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellIGSTAmt: {
    width: "9%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  hCellAmount: {
    width: "14%",
    paddingHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  thText: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    textAlign: "center",
  },

  thTextCenter: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    textAlign: "center",
  },

  thTextRight: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    textAlign: "center",
  },

  tableBodyRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 1,
    paddingHorizontal: 6,
    backgroundColor: COLORS.white,
    minHeight: 24,
    flexWrap: "wrap",
  },

  tableDescriptionRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 1,
    paddingHorizontal: 6,
    backgroundColor: COLORS.white,
    flexWrap: "wrap",
  },

  // Item table cells
  cCellSN: {
    width: "3%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellDesc: { width: "35%", padding: 2, justifyContent: "flex-start" },
  // cCellHSN: {
  //   width: "8%",
  //   padding: 2,
  //   justifyContent: "flex-start",
  //   alignItems: "center",
  // },
  cCellQty: {
    width: "5%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellPrice: {
    width: "10%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellCGSTRate: {
    width: "6%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellCGSTAmt: {
    width: "9%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellSGSTRate: {
    width: "6%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellSGSTAmt: {
    width: "9%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellIGSTRate: {
    width: "6%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellIGSTAmt: {
    width: "9%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  cCellAmount: {
    width: "14%",
    padding: 2,
    justifyContent: "flex-start",
    alignItems: "center",
  },

  tdText: {
    fontSize: 9,
    color: COLORS.text,
    width: "100%",
  },

  tdTextRight: {
    textAlign: "right",
  },

  tdTextCenter: {
    textAlign: "center",
  },

  itemName: {
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.text,
    marginBottom: 1,
    width: "100%",
    paddingLeft: 10,
  },

  itemSub: {
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.2,
    paddingLeft: 40,
  },

  // ===== GST SUMMARY TABLE =====
  gstSummaryTable: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: "gray",
    marginBottom: 0,
    marginTop: 0,
  },

  gstSummaryTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },

  gstSummaryHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "gray",
    minHeight: 15,
    alignItems: "center",
    backgroundColor: "#EEEEEE",
  },

  gstSummaryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 1,
    minHeight: 15,
    alignItems: "center",
  },

  gstSummaryRowLast: {
    flexDirection: "row",
    paddingVertical: 1,
    minHeight: 15,
    alignItems: "center",
  },

  gstSummaryCol: {
    flex: 1,
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  gstSummaryColLast: {
    flex: 1,
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  gstSummaryLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },

  gstSummaryValue: {
    fontSize: 7,
  },

  // ===== TOTALS SECTION =====

  bottomMainRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderColor: COLORS.border,
    borderTopWidth: 0,
  },

  bottomLeftCol: {
    flex: 1,
    padding: 5,
    // borderRightWidth: 1,
    // borderRightColor: COLORS.border,
  },

  totalsSection: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "stretch",
    marginTop: 40, // for the space btween the service table and total section
  },

  amountInWordsFull: {
    width: "60%",
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    // justifyContent: "center",
  },

  totalsWrapper: {
    width: "40%",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    marginTop: 0,
    alignSelf: "stretch",
  },

  totalRowFull: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  grandTotalRowFull: {
    flexDirection: "row",
    justifyContent: "space-between",
    // borderTopWidth: 1,
    // borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  amountWordsLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textTransform: "uppercase",
    paddingLeft: 8,
  },

  amountWordsBody: {
    fontSize: 9,
    fontWeight: "bold",
    lineHeight: 1.4,
    paddingLeft: 8,
  },

  totalsBox: {
    width: 200,
    flexShrink: 0,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },

  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  totalLineGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 3,
    backgroundColor: COLORS.white,
    borderTopWidth: 2,
    borderTopColor: COLORS.border,
  },

  totalLabel: {
    fontSize: 9,
    color: COLORS.text,
    fontWeight: "bold",
  },

  totalValue: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.dark,
    textAlign: "right",
  },

  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },

  grandTotalValue: {
    fontSize: 12,
    fontWeight: 900,
    color: COLORS.text,
    textAlign: "right",
  },

  // ===== BOTTOM SECTION (Bank, Terms, QR) =====
  bottomSectionOuter: {
    marginTop: 2,
    backgroundColor: COLORS.white,
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom:0,
      borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  bottomTwoCol: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  bottomCol: {
    width: "50%",
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },

  bottomColLast: {
    width: "50%",
    paddingHorizontal: 4,
  },

  bottomColThird: {
    width: "33.33%",
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },

  bottomColThirdLast: {
    width: "33.33%",
    paddingHorizontal: 4,
  },

  bottomColQr: {
    alignItems: "center",
    marginTop: 8,
  },

  bottomSectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 2,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    // paddingBottom: 1,
    paddingTop: 8,
  },

  bottomLine: {
    fontSize: 9,
    color: COLORS.text,
    marginBottom: 1,
    lineHeight: 1.3,
  },

  bankGridRow: {
    flexDirection: "row",
    marginBottom: 1,
    alignItems: "flex-start",
  },

  bankLabel: {
    width: "35%",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
  },

  bankValue: {
    flex: 1,
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.2,
  },

  // ===== PRINT MODE SPECIFIC BANK STYLES =====
  bankPrintContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 0,
    minHeight: 45,
    width: "100%",
  },

  bankPrintLabel: {
    width: "20%",
    borderRightWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },

  bankPrintLabelText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    padding: 4,
  },

  bankPrintInfo: {
    flex: 1,
    textAlign: "center",
  },

  bankPrintRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 28,
  },

  bankPrintRowLast: {
    flexDirection: "row",
    minHeight: 28,
  },
  bankPrintCol: {
    width: "50%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },

  bankPrintColLast: {
    width: "50%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  bankPrintText: {
    fontSize: 9,
  },

  bankPrintValue: {
    fontFamily: "Helvetica-Bold",
  },

  termsBullet: {
    fontSize: 9,
    color: COLORS.text,
    marginBottom: 1,
    lineHeight: 1.2,
    paddingLeft: 2,
  },

  qrBox: {
    width: 90,
    height: 90,
    // borderWidth: 1,
    // borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    backgroundColor: COLORS.white,
  },

  qrImage: {
    width: 90,
    height: 90,
    objectFit: "contain",
  },

  qrHint: {
    fontSize: 9,
    color: COLORS.text,
    textAlign: "center",
    fontWeight: 600,
  },

  // ===== NOTES AND SIGNATURE =====
  notesSignRow: {
    // flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    paddingTop: 30,
    textAlign: "center",
  },

  notesCol: {
    flex: 1,
    maxWidth: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  notesLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 1,
    textTransform: "uppercase",
    justifyContent: "center",
    textAlign: "center",
  },

  notesBody: {
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.3,
    textAlign: "center",
  },

  signCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  signLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.text,
    marginTop: 2,
    // borderTopWidth: 1,
    // borderTopColor: COLORS.border,
    paddingTop: 2,
    textAlign: "center",
  },
  digitalSignContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // ===== PRINT MODE SIGNATURE =====
signPrintBox: {
  width: 340,
  // backgroundColor:"red",
  flexDirection: "column",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  paddingTop: 4,
},

signPrintHeader: {
  fontSize: 9,
  fontFamily: "Helvetica-Bold",
  marginBottom: 15,
  paddingTop: 6,
  // backgroundColor:"blue",
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
  textAlign: "right",
},

  signPrintLine: {
    //   borderTopWidth: 1,
    //   borderColor: COLORS.border,
    width: "100%",
    marginBottom: 2,
  },

  signPrintFooter: {
    fontSize: 8,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 1,
  },

  // Backward compatibility
  contactRow: {
    flexDirection: "column",
    marginTop: 0,
  },

  contactItem: {
    marginBottom: 0,
  },

  contactLabel: {
    fontSize: 0,
    fontWeight: 700,
    color: COLORS.secondary,
    marginBottom: 0,
  },

  contactValue: {
    fontSize: 0,
    color: COLORS.dark,
    lineHeight: 0,
  },

  stripText: {
    color: COLORS.text,
    fontSize: 6,
    fontWeight: 700,
  },

  customerSingleCard: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: "space-between",
  },

  customerHalf: {
    width: "50%",
    paddingHorizontal: 2,
  },

  customerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 0,
    borderStyle: "solid",
    borderBottomWidth: 0,
    borderBottomColor: COLORS.border,
    paddingBottom: 0,
  },

  customerCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginHorizontal: 0,
    minHeight: 0,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0,
  },

  cardLineBold: {
    color: COLORS.text,
    fontSize: 6,
    fontWeight: 700,
    marginBottom: 1,
  },

  cardLine: {
    color: COLORS.text,
    fontSize: 6,
    marginBottom: 1,
    lineHeight: 1.2,
    latterSpacing: 0,
  },

  paymentTopStrip: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
    marginLeft: 0,
    gap: 0,
  },

  paymentStripItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  paymentStripLabel: {
    color: COLORS.text,
    fontSize: 6,
    fontWeight: 700,
    marginRight: 2,
  },

  paymentStripValue: {
    color: COLORS.text,
    fontSize: 6,
    fontWeight: 700,
  },

  invoiceStrip: {
    backgroundColor: COLORS.white,
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 0,
  },

  receiptBody: {
    marginTop: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: -2,
    marginLeft: "55%",
    gap: 12,
  },
});
