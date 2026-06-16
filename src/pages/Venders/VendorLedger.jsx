import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from '@utils/notify';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import { call } from '../../utils/api';
import { money, date } from '../../utils/format';

export default function VendorLedger() {
  const { id } = useParams();
  const [ledger, setLedger] = useState({ purchases: [], payments: [] });
  useEffect(() => { call('vendors:ledger', { id }).then(setLedger).catch(error => toast.error(error.message)); }, [id]);
  return (
    <ContentArea>
      <PageHeader title="Vendor Ledger" subtitle="Purchase bills and payments for the selected vendor" />
      <h2 className="mb-3 font-semibold text-slate-700">Purchase Bills</h2>
      <DataTable data={ledger.purchases} columns={[
        { accessorKey: 'bill_no', header: 'Bill No' },
        { accessorKey: 'bill_date', header: 'Date', cell: info => date(info.getValue()) },
        { accessorKey: 'grand_total', header: 'Total', cell: info => money(info.getValue()) },
        { accessorKey: 'balance_due', header: 'Due', cell: info => money(info.getValue()) }
      ]} />
      <h2 className="mb-3 mt-8 font-semibold text-slate-700">Payments</h2>
      <DataTable data={ledger.payments} columns={[
        { accessorKey: 'payment_no', header: 'Payment No' },
        { accessorKey: 'payment_date', header: 'Date', cell: info => date(info.getValue()) },
        { accessorKey: 'amount', header: 'Amount', cell: info => money(info.getValue()) },
        { accessorKey: 'mode', header: 'Mode' }
      ]} />
    </ContentArea>
  );
}