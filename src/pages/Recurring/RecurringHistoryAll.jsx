import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";

const ACTION_TYPE_COLORS = {
  payment_received: "bg-green-100 text-green-700",
  plan_stopped: "bg-red-100 text-red-700",
  plan_resumed: "bg-emerald-100 text-emerald-700",
  recurring_updated: "bg-blue-100 text-blue-700",
  invoice_generated: "bg-slate-100 text-slate-700",
  cycle_generated: "bg-purple-100 text-purple-700",
};

const COLLECTION_STATUS_COLORS = {
  paid: "bg-green-100 text-green-700",
  partially_paid: "bg-yellow-100 text-yellow-700",
  overdue: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
};

export default function RecurringHistoryAll() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await modules.recurring.historyAll();
      setHistory(data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter history based on selected filter
  const filteredByType = useMemo(() => {
    if (filter === "all") return history;
    if (filter === "payments")
      return history.filter((h) => h.action_type === "payment_received");
    if (filter === "stops")
      return history.filter((h) => h.action_type === "plan_stopped");
    if (filter === "resume")
      return history.filter((h) => h.action_type === "plan_resumed");
    if (filter === "overdue")
      return history.filter((h) => h.collection_status === "overdue");
    if (filter === "pending")
      return history.filter((h) => h.collection_status === "pending");
    return history;
  }, [history, filter]);

  // Further filter by search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return filteredByType;

    return filteredByType.filter(
      (h) =>
        h.recurring_invoice_no
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        h.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.payment_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.action_notes?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [filteredByType, searchQuery]);

  // Compute stats based on current filtered view
  const stats = useMemo(() => {
    // Sum only actual received payments for Total Amount (Cash Basis)
    const totalAmount = filteredData.reduce((sum, h) => {
      if (h.action_type === "payment_received") {
        return sum + (h.amount || 0);
      }
      return sum;
    }, 0);

    const latestState = new Map();
    // Since history is sorted DESC, the first instance encountered for an ID is its current state
    filteredData.forEach((row) => {
      if (!latestState.has(row.recurring_invoice_id)) {
        latestState.set(row.recurring_invoice_id, row.pending_amount || 0);
      }
    });

    const totalPending = Array.from(latestState.values()).reduce(
      (a, b) => a + b,
      0,
    );
    return { totalAmount, totalPending };
  }, [filteredData]);

  const getActionTypeBadgeColor = (actionType) => {
    return ACTION_TYPE_COLORS[actionType] || "bg-slate-100 text-slate-700";
  };

  const getCollectionStatusBadgeColor = (status) => {
    return COLLECTION_STATUS_COLORS[status] || "bg-slate-100 text-slate-700";
  };

  const columns = [
    {
      header: "Date",
      cell: ({ row }) => (
        <div>
          <div className="text-sm text-slate-900">
            {date(row.original.payment_date || row.original.created_at)}
          </div>
          {row.original.paid_on_date && (
            <div className="text-[10px] font-bold text-emerald-600 uppercase">
              Paid On: {date(row.original.paid_on_date)}
            </div>
          )}
          <div className="text-xs text-slate-500">
            {new Date(row.original.created_at).toLocaleTimeString()}
          </div>
        </div>
      ),
    },
    {
      header: "Recurring Invoice",
      cell: ({ row }) => (
        <Link
          className="font-medium text-teal-700"
          to={`/recurring/${row.original.recurring_id}`}
        >
          {row.original.recurring_invoice_no}
        </Link>
      ),
    },
    {
      header: "Cycle Dates",
      cell: ({ row }) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-500">Start: {date(row.original.invoice_start_date)}</div>
          <div className="font-medium text-slate-900">Next: {date(row.original.next_invoice_date)}</div>
        </div>
      ),
    },
    {
      header: "Overdue",
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.overdue_days > 0 ? (
            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
              {row.original.overdue_days} Days
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </div>
      ),
    },
    {
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-900">{row.original.company_name}</div>
          {row.original.contact_person && (
            <div className="text-xs text-slate-500">{row.original.contact_person}</div>
          )}
        </div>
      ),
    },
    {
      header: "Action / Status",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase w-fit ${getActionTypeBadgeColor(row.original.action_type)}`}>
            {row.original.action_type.replace(/_/g, " ")}
          </span>
          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase w-fit ${getCollectionStatusBadgeColor(row.original.collection_status)}`}>
            {row.original.collection_status}
          </span>
        </div>
      ),
    },
    {
      header: "Amount / Pending",
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-semibold text-slate-900">
            {row.original.action_type === "payment_received"
              ? money(row.original.amount || 0)
              : "-"}
          </div>
          <div className="text-xs font-medium text-red-600">Pending: {money(row.original.pending_amount || 0)}</div>
        </div>
      ),
    },
    {
      header: "Payment Reference",
      cell: ({ row }) => (
        row.original.payment_no ? (
          <div>
            <div className="text-xs font-bold text-teal-700">{row.original.payment_no}</div>
            {row.original.reference_no && (
              <div className="text-xs text-slate-500">Ref: {row.original.reference_no}</div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">-</span>
        )
      ),
    },
  ];

  return (
    <ContentArea>
      <PageHeader
        title="All Recurring History"
        subtitle="Complete activity log across all recurring billing plans"
      />

      {/* FILTERS */}
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* FILTER BUTTONS */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "payments", label: "Payments" },
              { value: "stops", label: "Stops" },
              { value: "resume", label: "Resume" },
              { value: "overdue", label: "Overdue" },
              { value: "pending", label: "Pending" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* SEARCH */}
          <input
            type="text"
            placeholder="Search by invoice, customer, payment, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* EMPTY STATE */}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-600">Loading history...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-600 italic">
            {history.length === 0
              ? "No history records found."
              : "No records match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable data={filteredData} columns={columns} />

          {/* FOOTER STATS */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
              <div>
                Total records:{" "}
                <span className="font-semibold text-slate-900">
                  {filteredData.length}
                </span>
              </div>
              {/* <div className="flex gap-6">
                <div>
                  Total amount:{" "}
                  <span className="font-semibold text-slate-900">
                    {money(stats.totalAmount)}
                  </span>
                </div>
                <div>
                  Total pending:{" "}
                  <span className="font-semibold text-red-600">
                    {money(stats.totalPending)}
                  </span>
                </div>
              </div> */}
            </div>
          </div>
        </div>
      )}
    </ContentArea>
  );
}
