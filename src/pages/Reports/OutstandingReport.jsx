import ReportTable from '../_shared/ReportTable';
import { modules } from '../../utils/api';
import { money, date } from '../../utils/format';
export default function OutstandingReport() {
  return <ReportTable title="Outstanding Report" subtitle="Unpaid invoice balances" load={modules.reports.outstanding} columns={[
    { key: 'invoice_no', label: 'Invoice' }, { key: 'company_name', label: 'Customer' }, { key: 'due_date', label: 'Due Date', render: row => date(row.due_date) },
    { key: 'grand_total', label: 'Total', render: row => money(row.grand_total) }, { key: 'paid_amount', label: 'Paid', render: row => money(row.paid_amount) }, { key: 'balance_due', label: 'Due', render: row => money(row.balance_due) }
  ]} />;
}
