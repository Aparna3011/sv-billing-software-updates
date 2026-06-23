import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../pdfStyles";

export default function PDFSignature({
  documentMode = "print",
  companyName = "",
}) {
  if (documentMode === "print") {
    return (
      <View style={pdfStyles.signPrintBox}>
        <Text style={pdfStyles.signPrintHeader}>AUTHORIZED SIGNATURE</Text>
        {/* <View style={pdfStyles.signPrintLine} /> */}
        {/* <Text style={pdfStyles.signPrintFooter}>Authorized Signatory</Text> */}
      </View>
    );
  }

  if (documentMode === "export") {
    return (
      <View
        style={{
          width: "100%",
          alignItems: "center",
          marginTop: 5,
          paddingBottom: 30,
        }}
      >
        <Text
          style={{
            fontSize: 8,
            textAlign: "center",
          }}
        >
          This is a computer-generated document and does not require a physical
          signature.
        </Text>
      </View>
    );
  }

  return null;
}
