import { useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import toast from '@utils/notify';
import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';
import { Link } from 'react-router-dom';
import { money, date } from '../../utils/format';
import StatusBadge from '../../components/status/StatusBadge';

export default function ExpenseList() {
  async function exportPdf(row) {
    const toastId = toast.loading('Creating expense PDF...');
    try {
      await modules.pdf.expense(row.id, "export");
      toast.success('Expense PDF exported', { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return <GenericResourcePage title="Expenses" subtitle="Direct business expenses, utility payments, and miscellaneous operating costs" api={modules.expenses} searchKeys={['vendor_name', 'category_name', 'expense_no']} getViewPath={(row) => `/expenses/${row.id}`} editPath={(row) => `/expenses/edit/${row.id}`} loadOptions={async () => ({
    vendors: (await modules.vendors?.list?.() || []).map(vendor => ({ value: vendor.id, label: vendor.company_name })),
    categories: await (async () => {
       const res = await modules.expenseCategories?.list?.() || [];
       const list = Array.isArray(res) ? res : (res?.list || []);
       return list.map(c => ({ value: c.id, label: c.name }));
    })(),
    gstRates: await (async () => {
      const res = await modules.gst?.list?.() || [];
      const list = Array.isArray(res) ? res : (res?.list || []);
      return list.filter(rate => rate.is_active).map(rate => ({ value: rate.rate, label: rate.label }));
    })(),
    bankAccounts: await (async () => {
      const res = await modules.bankAccounts?.list?.() || [];
      const list = Array.isArray(res) ? res : (res?.list || []);
      return list.map(account => ({ value: account.id, label: `${account.account_name}${account.bank_name ? ` - ${account.bank_name}` : ''}` }));
    })()
  })}
  fields={[]} // Remove the fields prop to disable modal forms
  extraAction={ // Add extraAction to provide a Link for "New Expense"
    <Link to="/expenses/new" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
      <Plus size={16} /> New Expense
    </Link>
  }
  columns={[
    { 
      key: 'expense_no', 
      label: 'Voucher No', 
      render: row => (
        <div className="truncate w-24 font-mono text-[11px] font-bold text-teal-700" title={row.expense_no}>
          {row.expense_no}
        </div>
      )
    },
    { key: 'expense_date', label: 'Date', render: row => <div className="whitespace-nowrap text-slate-600 text-xs">{date(row.expense_date)}</div> },
    { key: 'due_date', label: 'Due Date', render: row => <div className="whitespace-nowrap text-slate-600 text-xs">{date(row.due_date)}</div> },
    { 
      key: 'vendor_name', 
      label: 'Vendor / Category', 
      render: row => (
        <div className="flex flex-col min-w-[150px] py-1">
          <div className="font-bold text-slate-900 leading-tight">
            {row.vendor_name}
          </div>
          <div className="text-[10px] text-slate-500 font-medium leading-tight mt-1 break-words">
            - {row.category_name || row.category}
          </div>
        </div>
      )
    },
    { 
      key: 'amount', 
      label: <div className="text-right">Subtotal</div>, 
      render: row => <div className="text-right tabular-nums text-xs">{money(row.amount)}</div> 
    },
    { 
      key: 'gst_amount', 
      label: <div className="text-right">GST</div>, 
      render: row => <div className="text-right tabular-nums text-xs">{money(row.gst_amount)}</div> 
    },
    { 
      key: 'total_amount', 
      label: <div className="text-right">Total</div>, 
      render: row => <div className="text-right font-bold text-slate-900 tabular-nums text-xs">{money(row.total_amount)}</div> 
    },
    { key: 'paid_amount', label: <div className="text-right">Paid</div>, render: row => <div className="text-right text-emerald-600 font-bold tabular-nums text-xs">{money(row.paid_amount)}</div> },
    { key: 'balance_due', label: <div className="text-right">Due</div>, render: row => <div className="text-right text-red-600 font-bold tabular-nums text-xs">{money(row.balance_due)}</div> },
    { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> }
  ]} rowActions={(row) => (
    <button title="Export PDF" onClick={() => exportPdf(row)} className="rounded p-1.5 text-teal-700 hover:bg-teal-50">
      <FileDown size={16} />
    </button>
  )} />;
}
