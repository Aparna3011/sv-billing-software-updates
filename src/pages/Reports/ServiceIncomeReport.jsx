import ReportTable from '../_shared/ReportTable';
import { modules } from '../../utils/api';
import { money } from '../../utils/format';

export default function ServiceIncomeReport() {
  return <ReportTable title="Service-wise Income" subtitle="Revenue grouped by software service" load={modules.reports.serviceIncome} columns={[
    { key: 'service_name', label: 'Service' },
    { key: 'lines', label: 'Billings' },
    { key: 'income', label: 'Income', render: row => money(row.income) },
    { key: 'gst', label: 'GST', render: row => money(row.gst) }
  ]} />;
}
