import React from 'react';
import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';
import { money } from '../../utils/format';
import StatusBadge from '../../components/status/StatusBadge';
import { Landmark } from 'lucide-react';

export default function BankAccounts() {
  return (
    <GenericResourcePage
      title="Bank Accounts"
      subtitle="Manage company bank accounts and track real-time balances"
      api={modules.bankAccounts}
      searchKeys={['account_name', 'bank_name', 'account_no']}
      fields={[
        { name: 'account_name', label: 'Account Name', required: true },
        { name: 'bank_name', label: 'Bank Name' },
        { name: 'account_no', label: 'Account Number' },
        { name: 'ifsc', label: 'IFSC Code' },
        { name: 'opening_balance', label: 'Opening Balance', type: 'number', defaultValue: 0 },
        { name: 'is_active', label: 'Active', type: 'select', options: [
          { value: 1, label: 'Yes' },
          { value: 0, label: 'No' }
        ], defaultValue: 1 }
      ]}
      columns={[
        { key: 'account_name', label: 'Account Name', render: row => (
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <Landmark size={14} className="text-slate-400" /> {row.account_name}
          </div>
        )},
        { key: 'bank_name', label: 'Bank' },
        { key: 'account_no', label: 'Account No' },
        { key: 'current_balance', label: 'Current Balance', render: row => money(row.current_balance), className: 'font-bold text-teal-700' },
        { key: 'is_active', label: 'Status', render: row => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> }
      ]}
    />
  );
}