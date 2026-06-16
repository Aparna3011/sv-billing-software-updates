import { useEffect, useMemo, useState } from "react";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import ReportExportButtons from "../../components/reports/ReportExportButtons";
import { modules } from "../../utils/api";
import { date, money } from "../../utils/format";

const exportColumns = [
  { key: "date", label: "Date" },
  { key: "reference_no", label: "Reference No" },
  { key: "type", label: "Type" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "balance", label: "Running Balance" },
];

export default function CustomerLedgerReport() {
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({ customer_id: "", from_date: "", to_date: "" });
  const [ledger, setLedger] = useState({ openingBalance: 0, entries: [], closingBalance: 0 });

  async function load(nextFilters = filters) {
    if (!nextFilters.customer_id) {
      setLedger({ openingBalance: 0, entries: [], closingBalance: 0 });
      return;
    }
    setLedger(await modules.reports.customerLedger(nextFilters));
  }

  useEffect(() => {
    modules.customers.list().then(setCustomers).catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [filters.customer_id]);

  const exportRows = useMemo(
    () =>
      ledger.entries.map((row) => ({
        date: date(row.date),
        reference_no: row.reference_no,
        type: row.type,
        debit: money(row.debit),
        credit: money(row.credit),
        balance: money(row.balance),
      })),
    [ledger.entries],
  );

  return (
    <ContentArea>
      <PageHeader
        title="Customer Ledger"
        subtitle="Customer opening balance, invoices, payments, and closing balance"
        actions={<ReportExportButtons title="Customer Ledger" columns={exportColumns} rows={exportRows} />}
      />

      <div className="grid grid-cols-4 gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <FormSelect
          label="Customer"
          value={filters.customer_id}
          onChange={(event) => setFilters({ ...filters, customer_id: event.target.value })}
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.company_name}
            </option>
          ))}
        </FormSelect>
        <FormInput label="From Date" type="date" value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
        <FormInput label="To Date" type="date" value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
        <div className="flex items-end">
          <button onClick={() => load().catch((error) => toast.error(error.message))} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Apply
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Opening Balance</div>
          <div className="mt-2 text-2xl font-semibold">{money(ledger.openingBalance)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Closing Balance</div>
          <div className="mt-2 text-2xl font-semibold">{money(ledger.closingBalance)}</div>
        </div>
      </div>

      <div className="mt-6">
        <DataTable
          data={ledger.entries}
          columns={[
            { accessorKey: "date", header: "Date", cell: (info) => date(info.getValue()) },
            { accessorKey: "reference_no", header: "Reference No" },
            { accessorKey: "type", header: "Type" },
            { accessorKey: "debit", header: "Debit", cell: (info) => money(info.getValue()) },
            { accessorKey: "credit", header: "Credit", cell: (info) => money(info.getValue()) },
            { accessorKey: "balance", header: "Running Balance", cell: (info) => money(info.getValue()) },
          ]}
        />
      </div>
    </ContentArea>
  );
}
