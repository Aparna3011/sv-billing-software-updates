import { View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../pdfStyles";

export default function PDFCustomerCards({
  document = {},
  isQuotation = false,
}) {
  const nested = document.customer || {};
  const contact = document.contact_person;
  const custCompany = document.company_name;

  const companyName =
    nested.company || document.customer_company || custCompany || "";

  const name = !companyName
    ? nested.name || contact || document.customer_name || "—"
    : "";

  const gstin = nested.gstin || document.customer_gstin || document.gstin || "";
  const phone = nested.phone || document.phone || "";
  const email = nested.email || document.email || "";
  const addr =
    [
      nested.address || document.address,
      nested.city || document.city,
      nested.state || document.state,
      nested.country || document.country,
      nested.pincode || document.pincode,
    ]
      .filter(Boolean)
      .join(", ") || "—";
  const pan = nested.pan || document.customer_pan || "";
  return (
    <View style={pdfStyles.customerBoxesRow}>
      {/* Billed To Box */}
      <View style={pdfStyles.customerBox}>
        <Text style={pdfStyles.boxTitle}>To</Text>
        <Text style={pdfStyles.boxLine}>{companyName || name}</Text>
        <Text style={pdfStyles.boxLine}>{addr}</Text>
        {(phone || email) && (
          <Text style={pdfStyles.boxLine}>
            {phone ? ` ${phone}` : ""}
            {phone && email ? "     " : ""}
            {email ? `${email}` : ""}
          </Text>
        )}
        {gstin ? <Text style={pdfStyles.boxLine}>GSTIN: {gstin}</Text> : null}
        {!isQuotation && pan ? (
          <Text style={pdfStyles.boxLine}>PAN: {pan}</Text>
        ) : null}
      </View>

      {/* Shipped To Box */}
      {/* <View style={pdfStyles.customerBoxLast}>
        <Text style={pdfStyles.boxTitle}>Shipped To</Text>
        <Text style={pdfStyles.boxLine}>{name}</Text>
        {companyName && <Text style={pdfStyles.boxLine}>{companyName}</Text>}
        <Text style={pdfStyles.boxLine}>{addr}</Text>
        {pan && <Text style={pdfStyles.boxLine}>PAN: {pan}</Text>}
        {phone && <Text style={pdfStyles.boxLine}>Phone: {phone}</Text>}
        {gstin && <Text style={pdfStyles.boxLine}>GSTIN/UIN: {gstin}</Text>}
      </View> */}
    </View>
  );
}
