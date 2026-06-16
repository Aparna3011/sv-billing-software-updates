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
  { key: "reference_no", label: "Reference" },
  { key: "source", label: "Source" },
  { key: "inflow", label: "Cash Inflow" },
  { key: "outflow", label: "Cash Outflow" },
];

function rangeForPreset(period) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === "monthly") {
    return {
      from_date: new Date(year, month, 1).toISOString().slice(0, 10),
      to_date: new Date(year, month + 1, 0).toISOString().slice(0, 10),
    };
  }
  if (period === "quarterly") {
    const quarterStart = Math.floor(month / 3) * 3;
    return {
      from_date: new Date(year, quarterStart, 1).toISOString().slice(0, 10),
      to_date: new Date(year, quarterStart + 3, 0).toISOString().slice(0, 10),
    };
  }
  if (period === "yearly") {
    return {
      from_date: `${year}-01-01`,
      to_date: `${year}-12-31`,
    };
  }
  return {};
}

export default function CashFlowReport() {
  const [filters, setFilters] = useState({ period: "custom", from_date: "", to_date: "" });
  const [report, setReport] = useState({ cashInflow: 0, cashOutflow: 0, netCashFlow: 0, entries: [] });

  async function load(nextFilters = filters) {
    if (!nextFilters.from_date || !nextFilters.to_date) {
      return toast.error("Please select a date range");
    }
    setReport(await modules.reports.cashFlow(nextFilters));
  }

  const exportRows = useMemo(
    () =>
      report.entries.map((row) => ({
        date: date(row.date),
        reference_no: row.reference_no,
        source: row.source,
        inflow: money(row.inflow),
        outflow: money(row.outflow),
      })),
    [report.entries],
  );

  function setPeriod(period) {
    setFilters({ ...filters, period, ...rangeForPreset(period) });
  }

  return (
    <ContentArea>
      <PageHeader
        title="Cash Flow Report"
        subtitle="Cash inflow, cash outflow, and net cash flow"
        actions={<ReportExportButtons title="Cash Flow Report" columns={exportColumns} rows={exportRows} />}
      />

      <div className="grid grid-cols-5 gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <FormSelect label="Period" value={filters.period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom Range</option>
        </FormSelect>
        <FormInput label="From Date" type="date" value={filters.from_date || ""} onChange={(event) => setFilters({ ...filters, period: "custom", from_date: event.target.value })} />
        <FormInput label="To Date" type="date" value={filters.to_date || ""} onChange={(event) => setFilters({ ...filters, period: "custom", to_date: event.target.value })} />
        <div className="flex items-end">
          <button onClick={() => load().catch((error) => toast.error(error.message))} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Apply
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          ["Cash Inflow", report.cashInflow],
          ["Cash Outflow", report.cashOutflow],
          ["Net Cash Flow", report.netCashFlow],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{money(value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <DataTable
          data={report.entries}
          columns={[
            { accessorKey: "date", header: "Date", cell: (info) => date(info.getValue()) },
            { accessorKey: "reference_no", header: "Reference" },
            { accessorKey: "source", header: "Source" },
            { accessorKey: "inflow", header: "Cash Inflow", cell: (info) => money(info.getValue()) },
            { accessorKey: "outflow", header: "Cash Outflow", cell: (info) => money(info.getValue()) },
          ]}
        />
      </div>
    </ContentArea>
  );
}
