import InvoicePDF from "./InvoicePDF";

export default function QuotationPDF({
  quotation = {},
  company = {},
  documentMode = "export",
}) {
  const quotationDocument = {
    ...quotation,
    paid_amount: 0,
    paid_now: 0,
    total_paid: 0,
    payment_no: "",
    payment_date: "",
    payment_mode: "",
    mode: "",
  };

  return (
    <InvoicePDF
      invoice={quotationDocument}
      company={company}
      qrSrc={null}
      title="QUOTATION"
      documentMode={documentMode}
      showPaymentDetails={false}
      showTotals={false}
    />
  );
}
