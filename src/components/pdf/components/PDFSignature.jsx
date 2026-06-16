import { Text, View } from '@react-pdf/renderer';
import { pdfStyles } from '../pdfStyles';

export default function PDFSignature({ documentMode = 'print', companyName = '' }) {
  if (documentMode === 'print') {
    return (
      <View style={pdfStyles.signPrintBox}>
        <Text style={pdfStyles.signPrintHeader}>AUTHORIZED SIGNATURE</Text>
        {/* <View style={pdfStyles.signPrintLine} /> */}
        {/* <Text style={pdfStyles.signPrintFooter}>Authorized Signatory</Text> */}
      </View>
    );
  }

  if (documentMode === 'export') {
    return (
      <View style={pdfStyles.digitalSignContainer}>
        <Text style={pdfStyles.signLabel}>
          This is a computer-generated document and does not require a physical signature.
        </Text>
      </View>
    );
  }

  return null;
}
