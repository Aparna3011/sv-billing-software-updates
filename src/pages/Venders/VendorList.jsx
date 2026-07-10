import React from 'react';
import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';
import { money } from '../../utils/format';
import StatusBadge from '../../components/status/StatusBadge';
import { GST_TREATMENT_OPTIONS } from '../../utils/constants';
import { Users } from 'lucide-react';

export default function VendorList() {
  return (
    <GenericResourcePage
      title="Vendors"
      subtitle="Manage supplier details, track procurement, and monitor payables"
      api={modules.vendors}
      searchKeys={['company_name', 'contact_person', 'gstin', 'email', 'phone']}
      fields={[
        { name: 'company_name', label: 'Company Name', required: true },
        { name: 'contact_person', label: 'Contact Person' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'gstin', label: 'GSTIN', placeholder: 'e.g., 27ABCDE1234F1Z5' },
        { 
          name: 'gst_treatment', 
          label: 'GST Treatment', 
          type: 'select', 
          options: GST_TREATMENT_OPTIONS,
          defaultValue: 'Registered'
        },
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'country', label: 'Country', kind: 'country', defaultValue: 'India' },
        { name: 'state', label: 'State', kind: 'state' },
        { name: 'city', label: 'City', kind: 'city' },
        { name: 'payment_terms', label: 'Payment Terms (Days)', type: 'number', defaultValue: 15 },
        { name: 'opening_balance', label: 'Opening Balance', type: 'number', defaultValue: 0 },
        { name: 'notes', label: 'Notes', type: 'textarea' },
        // { 
        //   name: 'is_active', 
        //   label: 'Status', 
        //   type: 'select', 
        //   options: [
        //     { value: 1, label: 'Active' },
        //     { value: 0, label: 'Inactive' }
        //   ], 
        //   defaultValue: 1 
        // }
      ]}
      columns={[
        { key: 'company_name', label: 'Company', render: row => (
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <Users size={14} className="text-slate-400" /> {row.company_name}
          </div>
        )},
        { key: 'contact_person', label: 'Contact' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'country', label: 'Country' },
        { key: 'state', label: 'State' },
        { key: 'city', label: 'City' },
        { key: 'address', label: 'Address' },
        { key: 'current_balance', label: 'Balance', render: row => money(row.current_balance), className: 'font-bold text-teal-700 text-right' },
        // { key: 'is_active', label: 'Status', render: row => <StatusBadge status={row.is_active ? 'active' : 'inactive'} /> }
      ]}
    />
  );
}