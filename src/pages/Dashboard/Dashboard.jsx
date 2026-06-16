import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from '@utils/notify';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import StatusBadge from '../../components/status/StatusBadge';
import { modules } from '../../utils/api';
import { money, date } from '../../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { modules.dashboard().then(setData).catch(error => toast.error(error.message)); }, []);
  const metrics = [
    ['Total Sales', money(data?.revenue)],
    ['This Month', money(data?.monthlyRevenue)],
    ['Pending Payments', money(data?.outstanding)],
    ['Unpaid Invoices', data?.unpaidInvoices || 0],
    ['Active Clients', data?.customers || 0],
    ['Active AMC Clients', data?.activeRecurringClients || 0]
  ];
  return (
    <ContentArea>
      <PageHeader title="Dashboard" subtitle="GST billing, receivables, and service revenue at a glance" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>)}
      </div>

      <div className="mt-6">
        <h2 className="mb-4 font-semibold text-slate-800 uppercase tracking-wider text-xs">Recurring Billing Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Active Plans</div>
            <div className="mt-2 text-2xl font-bold text-green-600">{data?.activePlans || 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Overdue Plans</div>
            <div className="mt-2 text-2xl font-bold text-red-600">{data?.overduePlans || 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Due This Month</div>
            <div className="mt-2 text-2xl font-bold text-blue-600">{data?.dueThisMonth || 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Recurring Revenue</div>
            <div className="mt-2 text-2xl font-bold text-teal-600">{money(data?.recurringRevenue)}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-semibold text-slate-800 uppercase tracking-wider text-xs">Overdue Recurrings</h2>
        <DataTable data={data?.overdueRecurrings || []} columns={[
          { accessorKey: 'recurring_invoice_no', header: 'Recurring No' },
          { accessorKey: 'company_name', header: 'Customer' },
          { accessorKey: 'next_invoice_date', header: 'Due Date', cell: info => date(info.getValue()) },
          { accessorKey: 'pending_amount', header: 'Pending', cell: info => money(info.getValue()) },
          { accessorKey: 'overdue_days', header: 'Days' },
          { accessorKey: 'collection_status', header: 'Status', cell: info => <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase">{info.getValue()}</span> },
          { 
            id: 'action', 
            header: 'Action', 
            cell: ({ row }) => (
              <Link to={`/recurring/${row.original.recurring_id}`} className="text-teal-700 hover:text-teal-900 font-medium text-xs">View</Link>
            ) 
          }
        ]} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-semibold text-slate-800 uppercase tracking-wider text-xs">Upcoming Renewals (Next 7 Days)</h2>
        <DataTable data={data?.upcomingRenewals || []} columns={[
          { accessorKey: 'recurring_invoice_no', header: 'Recurring No' },
          { accessorKey: 'company_name', header: 'Customer' },
          { accessorKey: 'renewal_date', header: 'Renewal Date', cell: info => date(info.getValue()) },
          { accessorKey: 'amount', header: 'Amount', cell: info => money(info.getValue()) },
          { accessorKey: 'billing_cycle', header: 'Cycle', cell: info => <span className="capitalize">{info.getValue().replace('_', ' ')}</span> },
          { accessorKey: 'auto_generate', header: 'Auto', cell: info => <span className={info.getValue() ? 'text-green-600 font-bold' : 'text-slate-400'}>{info.getValue() ? 'Yes' : 'No'}</span> },
          { 
            id: 'action', 
            header: 'Action', 
            cell: ({ row }) => (
              <Link to={`/recurring/${row.original.recurring_id}`} className="text-teal-700 hover:text-teal-900 font-medium text-xs">View</Link>
            ) 
          }
        ]} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-semibold">Recent invoices</h2>
        <DataTable data={data?.recentInvoices || []} columns={[
          { accessorKey: 'invoice_no', header: 'Invoice' },
          { accessorKey: 'company_name', header: 'Customer' },
          { accessorKey: 'invoice_date', header: 'Date', cell: info => date(info.getValue()) },
          { accessorKey: 'grand_total', header: 'Total', cell: info => money(info.getValue()) },
          { accessorKey: 'status', header: 'Status', cell: info => <StatusBadge status={info.getValue()} /> }
        ]} />
      </div>
    </ContentArea>
  );
}
