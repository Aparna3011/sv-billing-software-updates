import { View, Text, Image } from "@react-pdf/renderer";
import { pdfStyles } from "../pdfStyles";

function initials(name) {
  if (!name || typeof name !== "string") return "SV";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PDFHeader({
  company = {},
  title = "TAX INVOICE",
  logoDataUrl,
  copyLabel = "Original Copy",
}) {
  const path = company?.logo_path && String(company.logo_path).trim();
  const dataUrl = logoDataUrl && String(logoDataUrl).trim();
  const imageSrc = dataUrl || path;
  const hasImage = Boolean(imageSrc);
  const phone = company.phone || "";
  const email = company.email || "";
  const website = company.website || "";
  const address = company.address || "";
  const pan = company.pan || "";

  return (
    <View style={pdfStyles.headerContainer}>
      {/* GSTIN + Copy */}
      <View style={pdfStyles.topInfoRow}>
        <View>
          {company?.gstin?.trim() && (
            <Text style={pdfStyles.gstinText}>GSTIN : {company.gstin}</Text>
          )}
        </View>

        <View>
          <Text style={pdfStyles.originalCopy}>{copyLabel}</Text>
        </View>
      </View>

      {/* Logo + Company Info */}
      <View style={pdfStyles.headerRow}>
        {/* Logo */}
        <View style={pdfStyles.logoSection}>
          {hasImage ? (
            <Image src={imageSrc} style={pdfStyles.logo} />
          ) : (
            <View style={pdfStyles.logoFallback}>
              <Text style={pdfStyles.logoFallbackText}>
                {initials(company.name)}
              </Text>
            </View>
          )}
        </View>

        {/* Company Details */}
        <View style={pdfStyles.companySection}>
          <Text style={pdfStyles.docTitle}>{title}</Text>

          <Text style={pdfStyles.companyName}>
            {(company.name || "Company Name").toUpperCase()}
          </Text>

          {address && <Text style={pdfStyles.companyInfo}>{address}</Text>}

          {pan && <Text style={pdfStyles.companyInfo}>PAN: {pan}</Text>}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            {phone && <Text style={pdfStyles.companyInfoBold}>☎ {phone}</Text>}

            <Text style={{ marginHorizontal: 8 }}>|</Text>

            {email && <Text style={pdfStyles.companyInfoBold}>✉ {email}</Text>}

            {website && (
              <>
                <Text style={{ marginHorizontal: 8 }}>|</Text>

                <Text style={pdfStyles.companyInfoBold}>
                  🌐 {website.replace(/^https?:\/\//, "")}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
