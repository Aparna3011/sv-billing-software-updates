import React from 'react';
import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';
import { money, date } from '../../utils/format';
import { CreditCard } from 'lucide-react';

export default function OutgoingPaymentList() {
  return (
    <GenericResourcePage
      title="Outgoing Payments"
      subtitle="Vendor payments, expense payments, and outgoing transaction history"
      api={modules.outgoingPayments}
      onRowClick={(event, row) => {
        const isInteractive = event?.target?.closest("button, a, input, select, textarea, svg, [role='button'], .action-cell");
        if (isInteractive) return;
        
        console.log("DEBUG: Row Clicked (GenericResourcePage) - Payment:", row.payment_no);
      }}
      extraAction={null}
      canDeleteRow={() => false}
      searchKeys={['payment_no', 'vendor_name', 'category_name', 'purchase_bill_no', 'expense_no', 'amount']}
      loadOptions={async () => ({
        vendors: (await (async () => {
          const vRows = await modules.vendors?.list?.() || [];
          const custRows = await modules.customers?.list?.() || [];
          return [...vRows.map(v => ({ value: `v_${v.id}`, label: v.company_name })), ...custRows.map(c => ({ value: `c_${c.id}`, label: `${c.company_name} (Customer)`}))].sort((a, b) => a.label.localeCompare(b.label)); // Sort by label
        })()),
        categories: (await modules.expenseCategories?.list?.() || []).map(c => ({ value: c.id, label: c.name })),
        bankAccounts: (await modules.bankAccounts?.list?.() || []).map(a => ({ value: a.id, label: a.account_name }))
      })}
      fields={[
        { name: 'payment_no', label: 'Payment No', requiredOnEdit: false },
        { name: 'payment_date', label: 'Date', type: 'date', required: true },
        { name: 'contact_id', label: 'Vendor / Party', type: 'select', options: 'vendors', required: true },
        { name: 'purchase_bill_no', label: 'Purchase Bill', requiredOnEdit: false },
        { name: 'category_id', label: 'Category', type: 'select', options: 'categories', required: true },
        { name: 'amount', label: 'Amount', type: 'number', required: true },
        { name: 'mode', label: 'Payment Mode', type: 'select', options: [
          { value: 'cash', label: 'Cash' },
          { value: 'bank_transfer', label: 'Bank Transfer' },
          { value: 'upi', label: 'UPI' },
          { value: 'card', label: 'Card' },
          { value: 'cheque', label: 'Cheque' }
        ], defaultValue: 'bank_transfer' },
        { name: 'bank_account_id', label: 'Bank Account', type: 'select', options: 'bankAccounts' },
        { name: 'reference_no', label: 'Reference Number' },
        { name: 'notes', label: 'Narration', type: 'textarea' },
        { name: 'created_at', label: 'Created At', requiredOnEdit: false }
      ]}
      columns={[
        { key: 'payment_no', label: 'Payment No', render: row => (
          <div className="flex items-center gap-2 font-mono text-teal-600 font-medium">
            <CreditCard size={14} className="text-slate-400" /> {row.payment_no}
          </div>
        )},
        { key: 'payment_type', label: 'Type', render: row => (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            row.payment_type === 'PURCHASE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {row.payment_type}
          </span>
        )},
        { key: 'reference', label: 'Reference No', render: row => (
          <span className="text-xs font-medium text-slate-600">
            {row.purchase_bill_no || row.expense_no || '-'}
          </span>
        )},
        { key: 'vendor_name', label: 'Vendor / Party' },
        { key: 'category_name', label: 'Category', render: row => row.category_name || 'Purchase Payment' },
        { key: 'payment_date', label: 'Date', render: row => date(row.payment_date) },
        { key: 'amount', label: 'Amount', render: row => money(row.amount), className: 'font-bold text-red-600' },
        { key: 'mode', label: 'Mode', render: row => row.mode?.replace('_', ' ').toUpperCase() },
        { key: 'bank_account_name', label: 'Bank', render: row => row.bank_account_name || '-' }
      ]}
    />
  );
}