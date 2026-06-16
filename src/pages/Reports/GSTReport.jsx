import ReportTable from '../_shared/ReportTable';
import { modules } from '../../utils/api';
import { money, date } from '../../utils/format';
export default function GSTReport() {
  return <ReportTable title="GST Report" subtitle="Invoice-wise tax summary" load={modules.reports.gst} columns={[
    { key: 'invoice_no', label: 'Invoice' }, { key: 'invoice_date', label: 'Date', render: row => date(row.invoice_date) }, { key: 'company_name', label: 'Customer' },
    { key: 'taxable_value', label: 'Taxable', render: row => money(row.taxable_value) }, { key: 'cgst_total', label: 'CGST', render: row => money(row.cgst_total) },
    { key: 'sgst_total', label: 'SGST', render: row => money(row.sgst_total) }, { key: 'igst_total', label: 'IGST', render: row => money(row.igst_total) }, { key: 'grand_total', label: 'Total', render: row => money(row.grand_total) }
  ]} />;
}
