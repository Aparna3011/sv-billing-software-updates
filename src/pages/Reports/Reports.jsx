import { Link } from 'react-router-dom';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';

const reports = [
  ['/reports/gst', 'GST Report', 'Taxable value, CGST, SGST, IGST, and totals'],
  ['/reports/revenue', 'Revenue Report', 'Monthly revenue and GST summary'],
  ['/reports/outstanding', 'Outstanding Report', 'Open dues and ageing inputs'],
  ['/reports/customer-ledger', 'Customer Ledger Report', 'Customer-wise invoices and receipts'],
  ['/reports/vendor-ledger', 'Vendor Ledger Report', 'Vendor purchase bills and payments'],
  ['/reports/cash-flow', 'Cash Flow Report', 'Inflows, outflows, and net cash flow'],
  ['/reports/gst-summary', 'GST Summary Report', 'Output GST, input GST, and liability'],
  ['/reports/service-income', 'Service-wise Income', 'Revenue grouped by service type'],
  ['/reports/payments', 'Payment Report', 'Receipt history'],
  ['/reports/expenses', 'Expense Report', 'Operating expenses']
];

export default function Reports() {
  return (
    <ContentArea>
      <PageHeader title="Reports" subtitle="GST, revenue, outstanding, ledger, payment, and expense reporting" />
      <div className="grid grid-cols-3 gap-4">
        {reports.map(([to, title, text]) => <Link key={to} to={to} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-600"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p></Link>)}
      </div>
    </ContentArea>
  );
}
