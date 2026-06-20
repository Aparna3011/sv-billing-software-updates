import { Text, View } from "@react-pdf/renderer";
import { pdfStyles, COLORS } from "../pdfStyles";
import { formatPdfDate } from "../pdfFormat";
import PDFSignature from "./PDFSignature";

export function formatMoney(value) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "0.00";
  return numericValue.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function cleanLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function DocumentFrame({ children, pageNumber = 1, totalPages = 1 }) {
  return (
    <>
      <View style={pdfStyles.invoiceOuterBorder} fixed />
      <View style={pdfStyles.invoiceContent}>{children}</View>
      <Text
        fixed
        style={{
          position: "absolute",
          bottom: 5,
          right: 15,
          fontSize: 8,
          color: "#555",
        }}
      >
        {`Page ${pageNumber} of ${totalPages}`}
      </Text>
    </>
  );
}

export function DetailGrid({ left = [], right = [] }) {
  return (
    <View style={pdfStyles.infoRow}>
      <View style={pdfStyles.infoColumn}>
        <View style={pdfStyles.detailsColumn}>
          {left.map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
      </View>
      <View style={[pdfStyles.infoColumn, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}>
        <View style={pdfStyles.detailsColumnLast}>
          {right.map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function DetailRow({ label, value }) {
  return (
    <View style={pdfStyles.detailsRow}>
      <Text style={pdfStyles.detailsLabel}>{label}</Text>
      <Text style={pdfStyles.detailsValue}>{value || "-"}</Text>
    </View>
  );
}

export function PartyBlock({ title = "To", party = {}, showPan = true }) {
  const address =
    [
      party.address,
      party.city,
      party.state,
      party.country,
      party.pincode,
    ]
      .filter(Boolean)
      .join(", ") || "-";
  const primaryName =
    party.company_name ||
    party.company ||
    party.name ||
    party.contact_person ||
    "-";

  return (
    <View style={pdfStyles.customerBox}>
      <Text style={pdfStyles.boxTitle}>{title}</Text>
      <Text style={pdfStyles.boxLine}>{primaryName}</Text>
      {party.contact_person && party.contact_person !== primaryName ? (
        <Text style={pdfStyles.boxLine}>Contact: {party.contact_person}</Text>
      ) : null}
      <Text style={pdfStyles.boxLine}>{address}</Text>
      {party.phone || party.email ? (
        <Text style={pdfStyles.boxLine}>
          {party.phone || ""}
          {party.phone && party.email ? "     " : ""}
          {party.email || ""}
        </Text>
      ) : null}
      {party.gstin ? <Text style={pdfStyles.boxLine}>GSTIN: {party.gstin}</Text> : null}
      {showPan && party.pan ? <Text style={pdfStyles.boxLine}>PAN: {party.pan}</Text> : null}
    </View>
  );
}

export function PartyDetailsSection({ left, right }) {
  return (
    <View style={pdfStyles.infoRow}>
      <View style={pdfStyles.infoColumn}>{left}</View>
      <View style={[pdfStyles.infoColumn, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}>
        {right}
      </View>
    </View>
  );
}

export function NotesAndSignature({ notes, companyName, documentMode = "export" }) {
  return (
    <View style={pdfStyles.notesSignRow} wrap={false}>
      <View style={pdfStyles.notesCol}>
        {notes ? (
          <>
            <Text style={pdfStyles.notesLabel}>Notes</Text>
            <Text style={pdfStyles.notesBody}>{notes}</Text>
          </>
        ) : null}
      </View>
      {documentMode === "export" ? (
        <View style={pdfStyles.signCol}>
          <Signature companyName={companyName} documentMode={documentMode} />
        </View>
      ) : null}
    </View>
  );
}

function Signature({ companyName, documentMode }) {
  return <PDFSignature companyName={companyName} documentMode={documentMode} />;
}

export function SimpleTotalBox({
  rows = [],
  grandLabel = "Grand Total",
  grandTotal = 0,
  amountWords,
}) {
  return (
    <View style={pdfStyles.totalsSection} wrap={false}>
      <View style={pdfStyles.amountInWordsFull}>
        <Text style={pdfStyles.amountWordsLabel}>AMOUNT IN WORDS</Text>
        <Text style={pdfStyles.amountWordsBody}>{amountWords || "-"}</Text>
      </View>
      <View style={pdfStyles.totalsWrapper}>
        {rows.map((row) => (
          <View key={row.label} style={pdfStyles.totalRowFull}>
            <Text style={pdfStyles.totalLabel}>{row.label}</Text>
            <Text style={pdfStyles.totalValue}>{formatMoney(row.value)}</Text>
          </View>
        ))}
        <View style={pdfStyles.grandTotalRowFull}>
          <Text style={pdfStyles.grandTotalLabel}>{grandLabel}</Text>
          <Text style={pdfStyles.grandTotalValue}>{formatMoney(grandTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

export function dateValue(value) {
  return value ? formatPdfDate(value) : "-";
}
