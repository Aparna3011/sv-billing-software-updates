import React, { useState } from 'react';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';
import { Activity } from 'lucide-react';

// Import existing components from the Payments and Outgoing Payments modules
// These components contain their own search, pagination, and API logic.
import PaymentList from '../Payments/PaymentList';
import OutgoingPaymentList from '../Payments/OutgoingPaymentList';

export default function Transactions() {
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' or 'outgoing'

  return (
    <ContentArea>
      <PageHeader
        title="Transactions"
        subtitle="Consolidated view of all incoming and outgoing payments"
        icon={Activity}
      />

      <div className="mt-6">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-8">
            <button
              onClick={() => setActiveTab('incoming')}
              className={`flex items-center gap-2 border-b-2 py-4 text-sm font-medium transition-colors ${
                activeTab === 'incoming'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              Incoming Payments
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`flex items-center gap-2 border-b-2 py-4 text-sm font-medium transition-colors ${
                activeTab === 'outgoing'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              Outgoing Payments
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'incoming' ? (
            <PaymentList />
          ) : (
            <OutgoingPaymentList />
          )}
        </div>
      </div>
    </ContentArea>
  );
}