import React, { useState } from 'react';
import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules, call } from '../../utils/api';
import { money, date } from '../../utils/format';
import { ArrowUpRight, ArrowDownLeft, Plus, RefreshCcw, History, Trash2 } from 'lucide-react';
import toast from "@utils/notify";

export default function BankTransactions() {
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'deleted'

  async function handleRestore(row) {
    try {
      await call('bankTransactions:restore', { id: row.id });
      toast.success("Transaction restored successfully");
      window.location.reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <GenericResourcePage
      title="Bank Transactions"
      subtitle="Audit log of all bank movements including payments, expenses, and adjustments"
      api={{
        ...modules.bankTransactions,
        list: (params) => modules.bankTransactions.list({ ...params, show_deleted: viewMode === 'deleted' }),
        update: (payload) => call('bankTransactions:update', payload),
        delete: (id) => call('bankTransactions:delete', { id }),
        restore: (id) => call('bankTransactions:restore', { id })
      }}
      canCreate={false}
      onRowClick={(event, row) => {
        const isInteractive = event?.target?.closest("button, a, input, select, textarea, svg, [role='button'], .action-cell");
        if (isInteractive) return;
        
        console.log("DEBUG: Row Clicked (GenericResourcePage) - Transaction:", row.reference_no || row.id);
      }}
      searchKeys={['reference_no', 'notes', 'account_name']}
      beforeFilters={
        <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-4">
          <button
            onClick={() => setViewMode('active')}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
              viewMode === 'active' ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <History size={14} /> Active
          </button>
          <button
            onClick={() => setViewMode('deleted')}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
              viewMode === 'deleted' ? "bg-white text-rose-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Trash2 size={14} /> Recycle Bin
          </button>
        </div>
      }
      loadOptions={async () => ({
        accounts: (await modules.bankAccounts.list()).map(a => ({ value: a.id, label: a.account_name }))
      })}
      fields={[
        { name: 'transaction_date', label: 'Date', type: 'date', required: true },
        { name: 'bank_account_id', label: 'Bank Account', type: 'select', options: 'accounts', required: true },
        { name: 'type', label: 'Voucher Type', type: 'select', options: [{value:'debit', label:'Payment'}, {value:'credit', label:'Receipt'}], required: true },
        { name: 'amount', label: 'Amount', type: 'number', required: true },
        { name: 'reference_no', label: 'Reference No' },
        { name: 'notes', label: 'Narration', type: 'textarea' },
        { name: 'created_at', label: 'Created Date', required: false, requiredOnEdit: false },
        { name: 'updated_at', label: 'Last Updated', required: false, requiredOnEdit: false }
      ]}
      columns={[
        { key: 'transaction_date', label: 'Date', render: row => date(row.transaction_date) },
        { key: 'account_name', label: 'Account' },
        { key: 'type', label: 'Type', render: row => (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold uppercase ${
            row.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {row.type === 'credit' ? <ArrowDownLeft size={12}/> : <ArrowUpRight size={12}/>}
            {row.type}
          </span>
        )},
        { key: 'notes', label: 'Party', render: row => {
          if (row.source_type === 'customer_payment') {
            return (
              <div className="flex flex-col">
                <span className="font-bold text-slate-900">{row.customer_name || 'General Customer'}</span>
                <span className="text-[10px] text-teal-600 font-black uppercase tracking-tight">
                  {row.invoice_no || row.recurring_no || 'Advance'} • {row.service_names || 'Services'}
                </span>
              </div>
            );
          }

          if (row.source_type === 'purchase_payment') {
            return (
              <div className="flex flex-col">
                <span className="font-bold text-slate-900">{row.vendor_name || 'General Vendor'}</span>
                <span className="text-[10px] text-blue-600 font-black uppercase tracking-tight">
                  {row.bill_no || 'Payment'} • {row.purchase_services || 'Procurement'}
                </span>
              </div>
            );
          }

          if (row.source_type === 'expense_payment' || row.source_type === 'expense') {
            return (
              <div className="flex flex-col">
                <span className="font-bold text-slate-900">{row.vendor_name || row.notes?.split('|')[0]?.replace('Party: ', '').trim() || 'General'}</span>
                <span className="text-[10px] text-rose-600 font-black uppercase tracking-tight">
                  {row.expense_category || 'Expense'} {row.expense_no ? `(${row.expense_no})` : ''}
                </span>
              </div>
            );
          }

          const partyFromNotes = row.notes?.split('|')[0]?.replace("Party: ", "").trim();
          return (
            <span className="font-bold text-slate-700">
              {partyFromNotes || "General"}
            </span>
          );
        }},
        { key: 'reference_no', label: 'Reference' },
        { key: 'debit', label: 'Debit', render: row => row.debit > 0 ? money(row.debit) : '-', className: 'text-right text-red-600' },
        { key: 'credit', label: 'Credit', render: row => row.credit > 0 ? money(row.credit) : '-', className: 'text-right text-emerald-600' },
        { key: 'balance_after', label: 'Balance', render: row => money(row.balance_after), className: 'text-right font-bold text-slate-900' }
      ]}
      rowActions={(row) => (
        <div className="action-cell">
          {viewMode === 'deleted' && (
            <button
              title="Restore Transaction"
              onClick={() => handleRestore(row)}
              className="rounded p-1.5 text-teal-600 hover:bg-teal-50"
            >
              <RefreshCcw size={16} />
            </button>
          )}
        </div>
      )}
      extraAction={
        <button 
          onClick={() => {
            // In a real implementation, this would open a Modal with bankTransactions:manualAdjustment
            // For this delivery, we are matching the existing GenericResourcePage patterns.
          }}
          className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus size={16} />
          Manual Adjustment
        </button>
      }
    />
  );
}