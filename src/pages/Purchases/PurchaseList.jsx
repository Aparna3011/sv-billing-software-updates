import { FileDown, Plus } from 'lucide-react';
import toast from '@utils/notify';
import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';
import { Link } from 'react-router-dom';
import { money, date } from '../../utils/format';
import StatusBadge from '../../components/status/StatusBadge';

export default function PurchaseList() {
  async function exportPdf(row) {
    const toastId = toast.loading('Creating purchase PDF...');
    try {
      await modules.pdf.purchase(row.id, "export");
      toast.success('Purchase PDF exported', { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return <GenericResourcePage 
    title="Purchase Bills" 
    subtitle="Vendor software, hosting, SaaS, cloud, and digital service bills" 
    api={modules.purchases} 
    searchKeys={['vendor_name', 'service_name', 'bill_no']} 
    getViewPath={(row) => `/purchases/${row.id}`}
    loadOptions={async () => ({
      vendors: (await modules.vendors.list()).map(vendor => ({ value: vendor.id, label: vendor.company_name })),
      gstRates: (await modules.gst.list()).filter(rate => rate.is_active).map(rate => ({ value: rate.rate, label: rate.label })),
      services: (await modules.services.list()).map(service => ({ value: service.id, label: service.name })),
      bankAccounts: (await modules.bankAccounts.list()).map(account => ({ value: account.id, label: `${account.account_name}${account.bank_name ? ` - ${account.bank_name}` : ''}` }))
    })}
    fields={[]} // No inline fields for GenericResourcePage
    extraAction={
      <Link to="/purchases/new" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
        <Plus size={16} /> New Purchase
      </Link>
    }
    columns={[
      { 
        key: 'bill_no', 
        label: 'Bill No', 
        render: row => (
          <div className="truncate w-24 font-mono text-[11px] font-bold text-teal-700" title={row.bill_no}>
            {row.bill_no}
          </div>
        )
      },
      // { 
      //   key: 'vendor_bill_no', 
      //   label: 'Vendor Bill', 
      //   render: row => (
      //     <div className="truncate w-24 font-mono text-[11px] text-slate-500" title={row.vendor_bill_no}>
      //       {row.vendor_bill_no || '-'}
      //     </div>
      //   )
      // },
      { key: 'bill_date', label: 'Date', render: row => <div className="whitespace-nowrap text-slate-600 text-xs">{date(row.bill_date)}</div> },
      { key: 'due_date', label: 'Due Date', render: row => <div className="whitespace-nowrap text-slate-600 text-xs">{date(row.due_date)}</div> },
      { 
        key: 'vendor_name', 
        label: 'Vendor / Service', 
        render: row => (
          <div className="flex flex-col min-w-[150px] py-1">
            <div className="font-bold text-slate-900 leading-tight">
              {row.vendor_name}
            </div>
            <div className="text-[10px] text-slate-500 font-medium leading-tight mt-1 break-words">
              - {row.service_name}
            </div>
          </div>
        )
      },
      { 
        key: 'subtotal', 
        label: <div className="text-right">Subtotal</div>, 
        render: row => <div className="text-right tabular-nums text-xs">{money(row.subtotal || row.amount)}</div> 
      },
      { 
        key: 'tax_total', 
        label: <div className="text-right">GST</div>, 
        render: row => <div className="text-right tabular-nums text-xs">{money(row.tax_total || row.gst_amount)}</div> 
      },
      { 
        key: 'grand_total', 
        label: <div className="text-right">Total</div>, 
        render: row => <div className="text-right font-bold text-slate-900 tabular-nums text-xs">{money(row.grand_total || (row.amount + row.gst_amount))}</div> 
      },
      { 
        key: 'paid_amount', 
        label: <div className="text-right">Paid</div>, 
        render: row => <div className="text-right text-emerald-600 font-bold tabular-nums text-xs">{money(row.paid_amount)}</div> 
      },
      { 
        key: 'balance_due', 
        label: <div className="text-right">Due</div>, 
        render: row => <div className="text-right text-red-600 font-bold tabular-nums text-xs">{money(row.balance_due)}</div> 
      },
      { key: 'status', label: 'Status', render: row => <StatusBadge status={row.status} /> }
    ]}
    rowActions={(row) => (
      <button title="Export PDF" onClick={() => exportPdf(row)} className="rounded p-1.5 text-teal-700 hover:bg-teal-50">
        <FileDown size={16} />
      </button>
    )}
    canEditRow={() => true} // Enable edit action
    canDeleteRow={() => true} // Enable delete action
    disableInlineEdit={true} // Disable inline editing
    editPath={(row) => `/purchases/edit/${row.id}`} // Path for edit action
  />;
}
