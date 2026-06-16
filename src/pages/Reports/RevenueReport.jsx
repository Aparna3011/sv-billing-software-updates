import ReportTable from '../_shared/ReportTable';
import { modules } from '../../utils/api';
import { money } from '../../utils/format';
export default function RevenueReport() {
  return <ReportTable title="Revenue Report" subtitle="Monthly billed revenue" load={modules.reports.revenue} columns={[
    { key: 'month', label: 'Month' }, { key: 'invoices', label: 'Invoices' }, { key: 'revenue', label: 'Revenue', render: row => money(row.revenue) }, { key: 'gst', label: 'GST', render: row => money(row.gst) }
  ]} />;
}
