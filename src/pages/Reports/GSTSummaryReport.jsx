import { useEffect, useMemo, useState } from "react";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import ReportExportButtons from "../../components/reports/ReportExportButtons";
import { modules } from "../../utils/api";
import { money } from "../../utils/format";

const exportColumns = [
  { key: "type", label: "Type" },
  { key: "source", label: "Source" },
  { key: "amount", label: "Amount" },
];

function financialYearRange(year) {
  return { from_date: `${year}-04-01`, to_date: `${Number(year) + 1}-03-31` };
}

export default function GSTSummaryReport() {
  const thisYear = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const [filters, setFilters] = useState({ period: "financial_year", financial_year: String(thisYear), ...financialYearRange(thisYear) });
  const [report, setReport] = useState({ outputGst: 0, inputGst: 0, gstLiability: 0, rows: [] });

  async function load(nextFilters = filters) {
    setReport(await modules.reports.gstSummary(nextFilters));
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, []);

  const exportRows = useMemo(
    () => report.rows.map((row) => ({ ...row, amount: money(row.amount) })),
    [report.rows],
  );

  function applyPeriod(next) {
    const now = new Date();
    if (next.period === "month" && next.month) {
      const [year, month] = next.month.split("-").map(Number);
      return {
        ...next,
        from_date: `${next.month}-01`,
        to_date: new Date(year, month, 0).toISOString().slice(0, 10),
      };
    }
    if (next.period === "quarter") {
      const quarter = Number(next.quarter || 1);
      const startMonth = (quarter - 1) * 3;
      const year = Number(next.quarter_year || now.getFullYear());
      return {
        ...next,
        from_date: new Date(year, startMonth, 1).toISOString().slice(0, 10),
        to_date: new Date(year, startMonth + 3, 0).toISOString().slice(0, 10),
      };
    }
    if (next.period === "financial_year") {
      return { ...next, ...financialYearRange(next.financial_year || thisYear) };
    }
    return next;
  }

  function update(next) {
    setFilters(applyPeriod({ ...filters, ...next }));
  }

  return (
    <ContentArea>
      <PageHeader
        title="GST Summary Report"
        subtitle="Output GST, input GST, and GST liability"
        actions={<ReportExportButtons title="GST Summary Report" columns={exportColumns} rows={exportRows} />}
      />

      <div className="grid grid-cols-6 gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <FormSelect label="Filter" value={filters.period} onChange={(event) => update({ period: event.target.value })}>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="financial_year">Financial Year</option>
        </FormSelect>
        <FormInput label="Month" type="month" value={filters.month || ""} onChange={(event) => update({ period: "month", month: event.target.value })} />
        <FormSelect label="Quarter" value={filters.quarter || "1"} onChange={(event) => update({ period: "quarter", quarter: event.target.value })}>
          <option value="1">Q1</option>
          <option value="2">Q2</option>
          <option value="3">Q3</option>
          <option value="4">Q4</option>
        </FormSelect>
        <FormInput label="Quarter Year" type="number" value={filters.quarter_year || new Date().getFullYear()} onChange={(event) => update({ period: "quarter", quarter_year: event.target.value })} />
        <FormInput label="Financial Year" type="number" value={filters.financial_year} onChange={(event) => update({ period: "financial_year", financial_year: event.target.value })} />
        <div className="flex items-end">
          <button onClick={() => load().catch((error) => toast.error(error.message))} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Apply
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          ["Output GST", report.outputGst],
          ["Input GST", report.inputGst],
          ["GST Liability", report.gstLiability],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{money(value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <DataTable
          data={report.rows}
          columns={[
            { accessorKey: "type", header: "Type" },
            { accessorKey: "source", header: "Source" },
            { accessorKey: "amount", header: "Amount", cell: (info) => money(info.getValue()) },
          ]}
        />
      </div>
    </ContentArea>
  );
}
