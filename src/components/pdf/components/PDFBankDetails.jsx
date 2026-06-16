import { Text, View, Image } from "@react-pdf/renderer";
import { pdfStyles } from "../pdfStyles";


function Row({ label, value }) {
  if (!value) return null;
  return (
    <View style={pdfStyles.bankGridRow}>
      <Text style={pdfStyles.bankLabel}>{label}</Text>
      <Text style={pdfStyles.bankValue}>{value}</Text>
    </View>
  );
}

export default function PDFBankDetails({
  company = {},
  documentMode = "export",
  qrSrc = null,
}) {
  const branch = company.bank_branch || company.city || "";

  if (documentMode === "print") {
  return (
    <View style={pdfStyles.bankPrintContainer}>
      <View style={pdfStyles.bankPrintLabel}>
        <Text style={pdfStyles.bankPrintLabelText}>BANK DETAILS</Text>
      </View>

      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Existing Bank Details */}
        <View style={pdfStyles.bankPrintInfo}>
          <View style={pdfStyles.bankPrintRow}>
            <View style={pdfStyles.bankPrintCol}>
              <Text style={pdfStyles.bankPrintText}>
                Bank Name & Branch :
                <Text style={pdfStyles.bankPrintValue}>
                  SHAHUPURI, KOLHAPUR
                </Text>
              </Text>
            </View>

            <View style={pdfStyles.bankPrintColLast}>
              <Text style={pdfStyles.bankPrintText}>
                A/C No :
                <Text style={pdfStyles.bankPrintValue}>
                  {" "}
                  {company.bank_account}
                </Text>
              </Text>
            </View>
          </View>

          <View style={pdfStyles.bankPrintRowLast}>
            <View style={pdfStyles.bankPrintCol}>
              <Text style={pdfStyles.bankPrintText}>
                IFSC Code :
                <Text style={pdfStyles.bankPrintValue}>
                  {" "}
                  {company.ifsc}
                </Text>
              </Text>
            </View>

            <View style={pdfStyles.bankPrintColLast}>
              <Text style={pdfStyles.bankPrintText}>
                UPI :
                <Text style={pdfStyles.bankPrintValue}>
                  {" "}
                  {company.upi_id}
                </Text>
              </Text>
            </View>
          </View>
        </View>

        {/* QR Code */}
        {company.upi_id && qrSrc && (
          <View
            style={{
              width: 100,
              borderLeftWidth: 1,
              borderLeftColor: "#000",
              justifyContent: "center",
              alignItems: "center",
              padding: 4,
            }}
          >
            <Image
              src={qrSrc}
              style={{
                width: 70,
                height: 70,
              }}
            />

            <Text
              style={{
                fontSize: 6,
                marginTop: 2,
                textAlign: "center",
              }}
            >
              {company.upi_id}
            </Text>

            <Text
              style={{
                fontSize: 6,
                textAlign: "center",
              }}
            >
              Scan to Pay
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

  return (
    <View>
      <Row label="Name" value="SV IT HUB" />
      <Row label="Bank" value={company.bank_name} />
      <Row label="A/C No." value={company.bank_account} />
      <Row label="IFSC" value={company.ifsc} />
      <Row label="Branch" value="SHAHUPURI, KOLHAPUR" />
      <Row label="UPI" value={company.upi_id} />
      {!company.bank_name &&
      !company.bank_account &&
      !company.ifsc &&
      !company.upi_id &&
      !branch ? (
        <Text style={pdfStyles.bottomLine}>—</Text>
      ) : null}
    </View>
  );
}
