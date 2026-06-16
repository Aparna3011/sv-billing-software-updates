import InvoicePDF from './InvoicePDF';

export default function QuotationPDF({
  quotation = {},
  company = {},
  qrSrc = null,
  documentMode = "export",
}) {
  return (
    <InvoicePDF
      invoice={quotation}
      company={company}
      qrSrc={qrSrc}
      title="QUOTATION"
      documentMode={documentMode}
    />
  );
}
