import { useEffect, useMemo, useState } from "react";

import toast from "@utils/notify";

import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import { modules } from "../../utils/api";
import { date } from "../../utils/format";

const activityDateValue = (value) => {
  if (!value) return "";

  const datePart = String(value).slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
};

export default function ActivityLog() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    entity: "",
  });

  useEffect(() => {
    modules.activity
      .list()
      .then(setRows)
      .catch((error) => toast.error(error.message));
  }, []);

  const entityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.entity_type)
            .filter(Boolean)
            .map(String),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const rowDate = activityDateValue(row.created_at);

        if (filters.fromDate && rowDate < filters.fromDate) return false;

        if (filters.toDate && rowDate > filters.toDate) return false;

        if (
          filters.entity &&
          String(row.entity_type || "") !== filters.entity
        ) {
          return false;
        }

        return true;
      }),
    [rows, filters],
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: (info) => date(info.row.original.created_at),
      },
      {
        accessorKey: "action",
        header: "Action",
      },
      {
        accessorKey: "entity_type",
        header: "Entity",
      },
      {
        accessorKey: "message",
        header: "Message",
      },
    ],
    [],
  );

  const updateFilter = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <ContentArea>
      <PageHeader title="Activity Log" subtitle="Audited business actions" />

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              From date
            </label>

            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => updateFilter("fromDate", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              To date
            </label>

            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => updateFilter("toDate", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Entity
            </label>

            <select
              value={filters.entity}
              onChange={(event) => updateFilter("entity", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="">All entities</option>

              {entityOptions.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                setFilters({
                  fromDate: "",
                  toDate: "",
                  entity: "",
                })
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <DataTable data={filteredRows} columns={columns} />
    </ContentArea>
  );
}
