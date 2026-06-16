import { View, Text, Image } from '@react-pdf/renderer';

import { pdfStyles, COLORS } from '../pdfStyles';
import PDFBankDetails from './PDFBankDetails';
import PDFTerms from './PDFTerms';
import PDFSignature from './PDFSignature';

export default function PDFBottomSection({
  company = {},
  qrSrc = null,
  documentMode = 'export',
}) {
  const hasQr = Boolean(qrSrc);
  const isPrint = documentMode === 'print';

  return (
    <View style={pdfStyles.bottomSectionOuter} wrap={false}>
      {isPrint ? (
        <View style={{ flexDirection: "column", width: "100%" }}>
          {/* Row 1: Terms - Full Width */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4 }}>
            <Text style={pdfStyles.bottomSectionTitle}>Terms & Conditions</Text>
            <PDFTerms company={company} />
          </View>

          {/* Row 2: Bank | QR | Signature */}
          <View style={{ flexDirection: "row", width: "100%", alignItems: "stretch" }}>
            <View style={pdfStyles.bottomColThird}>
              <Text style={pdfStyles.bottomSectionTitle}>Bank Details</Text>
              <PDFBankDetails company={company} documentMode="export" />
            </View>

            {hasQr && (
              <View style={pdfStyles.bottomColThird}>
                <Text style={pdfStyles.bottomSectionTitle}>QR Code</Text>
                <View style={[pdfStyles.bottomColQr, { marginTop: 2 }]}>
                  <View style={pdfStyles.qrBox}>
                    <Image src={qrSrc} style={pdfStyles.qrImage} />
                  </View>
                  <Text style={pdfStyles.qrHint}>Scan to Pay</Text>
                </View>
              </View>
            )}

            <View style={pdfStyles.bottomColThirdLast}>
              <PDFSignature documentMode="print" />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "column" }}>
          {/* Existing EXPORT Layout remains untouched below */}
          <View style={pdfStyles.bottomCol}>
            <Text style={pdfStyles.bottomSectionTitle}>Terms & Conditions</Text>
            <PDFTerms company={company} />
          </View>
          <View style={pdfStyles.bottomColLast}>
            <Text style={pdfStyles.bottomSectionTitle}>Bank Details</Text>
            <PDFBankDetails company={company} documentMode="export" />
            {hasQr && (
              <View style={pdfStyles.bottomColQr}>
                <Text style={pdfStyles.bottomSectionTitle}>QR Code</Text>
                <View style={pdfStyles.qrBox}>
                  <Image src={qrSrc} style={pdfStyles.qrImage} />
                </View>
                <Text style={pdfStyles.qrHint}>Scan to Pay</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}