import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from '@utils/notify';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import { call } from '../../utils/api';
import { money, date } from '../../utils/format';

export default function CustomerLedger() {
  const { id } = useParams();
  const [ledger, setLedger] = useState({ invoices: [], payments: [] });
  useEffect(() => { call('customers:ledger', { id }).then(setLedger).catch(error => toast.error(error.message)); }, [id]);
  return (
    <ContentArea>
      <PageHeader title="Customer Ledger" subtitle="Invoices and payments for the selected customer" />
      <h2 className="mb-3 font-semibold">Invoices</h2>
      <DataTable data={ledger.invoices} columns={[
        { accessorKey: 'invoice_no', header: 'Invoice' },
        { accessorKey: 'invoice_date', header: 'Date', cell: info => date(info.getValue()) },
        { accessorKey: 'grand_total', header: 'Total', cell: info => money(info.getValue()) },
        { accessorKey: 'balance_due', header: 'Due', cell: info => money(info.getValue()) }
      ]} />
      <h2 className="mb-3 mt-6 font-semibold">Payments</h2>
      <DataTable data={ledger.payments} columns={[
        { accessorKey: 'payment_no', header: 'Payment' },
        { accessorKey: 'payment_date', header: 'Date', cell: info => date(info.getValue()) },
        { accessorKey: 'amount', header: 'Amount', cell: info => money(info.getValue()) },
        { accessorKey: 'mode', header: 'Mode' }
      ]} />
    </ContentArea>
  );
}
