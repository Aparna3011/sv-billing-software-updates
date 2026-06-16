import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles } from './pdfStyles';
import PDFHeader from './components/PDFHeader';
import PDFSignature from './components/PDFSignature';

export default function PaymentReceiptPDF({
  payment = {},
  company = {},
  documentMode = 'print',
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader title="PAYMENT RECEIPT" company={company} />
        
        {/* Payment Details Section */}
        <View style={pdfStyles.invoiceDetailsSection}>
          <View style={pdfStyles.detailsColumn}>
            <View style={pdfStyles.detailsRow}>
              <Text style={pdfStyles.detailsLabel}>Payment No</Text>
              <Text style={pdfStyles.detailsValue}>{payment.payment_no || '—'}</Text>
            </View>
            <View style={pdfStyles.detailsRow}>
              <Text style={pdfStyles.detailsLabel}>Payment Date</Text>
              <Text style={pdfStyles.detailsValue}>{payment.payment_date || '—'}</Text>
            </View>
            <View style={pdfStyles.detailsRow}>
              <Text style={pdfStyles.detailsLabel}>Amount</Text>
              <Text style={pdfStyles.detailsValue}>Rs {payment.amount || '—'}</Text>
            </View>
          </View>
          <View style={pdfStyles.detailsColumnLast}>
            <View style={pdfStyles.detailsRow}>
              <Text style={pdfStyles.detailsLabel}>Mode</Text>
              <Text style={pdfStyles.detailsValue}>{String(payment.mode || '—').replace(/_/g, ' ')}</Text>
            </View>
            <View style={pdfStyles.detailsRow}>
              <Text style={pdfStyles.detailsLabel}>Reference</Text>
              <Text style={pdfStyles.detailsValue}>{payment.reference_no || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Footer Section */}
        <View style={pdfStyles.notesSignRow} wrap={false}>
          <View style={pdfStyles.notesCol}>
            <Text style={pdfStyles.notesLabel}>Notes</Text>
            <Text style={pdfStyles.notesBody}>{payment.notes || 'Payment received'}</Text>
          </View>
          <View style={pdfStyles.signCol}>
          <PDFSignature
            documentMode={documentMode}
            companyName={company.name || company.company_name || ""}
          />
        </View>
        </View>
      </Page>
    </Document>
  );
}
