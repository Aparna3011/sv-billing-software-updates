import { Text, View } from '@react-pdf/renderer';
import { pdfStyles } from '../pdfStyles';

export default function PDFTerms({ company = {} }) {
  const terms = [company.term1, company.term2, company.term3, company.term4, company.term5].filter(
    (t) => t && String(t).trim()
  );

  return (
    <View>
      {terms.length === 0 ? (
        <Text style={pdfStyles.termsBullet}>• Payment as per agreed schedule. Taxes as applicable.</Text>
      ) : (
        terms.map((t, i) => (
          <Text key={i} style={pdfStyles.termsBullet}>
            • {t}
          </Text>
        ))
      )}
    </View>
  );
}
