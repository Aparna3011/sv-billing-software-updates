import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";
import { ArrowLeft } from "lucide-react";

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

export default function RecurringHistory() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  useEffect(() => {
    loadHistory();
  }, [id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await modules.recurring.history(Number(id));
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

  useEffect(() => {
    setPage(1);
  }, [filter, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, page]);

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

  return (
    <ContentArea>
      <PageHeader
        title="Recurring History"
        subtitle="Complete recurring billing lifecycle and payment history"
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
              ? "No history records found for this recurring billing."
              : "No records match your filters."}
          </p>
        </div>
      ) : (
        /* TABLE */
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Date
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Recurring Invoice
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Start Date
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Next Invoice
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-center">
                    Overdue
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Customer
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Action Type
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Notes
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                    Amount
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                    Pending
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    Payment Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {date(row.payment_date || row.created_at)}
                      </div>
                      {row.paid_on_date && (
                        <div className="text-[10px] font-bold text-emerald-600 uppercase">
                          Paid On: {date(row.paid_on_date)}
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        {new Date(row.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-teal-700">
                        {row.recurring_invoice_no}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {date(row.invoice_start_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {date(row.next_invoice_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.overdue_days > 0 ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                          {row.overdue_days} Days
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.company_name}
                      </div>
                      {row.contact_person && (
                        <div className="text-xs text-slate-500">
                          {row.contact_person}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ${getActionTypeBadgeColor(
                          row.action_type,
                        )}`}
                      >
                        {row.action_type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${getCollectionStatusBadgeColor(
                          row.collection_status,
                        )}`}
                      >
                        {row.collection_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs text-sm text-slate-700">
                        {row.action_notes || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {money(row.amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-red-600">
                        {money(row.pending_amount || 0)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.payment_no ? (
                        <div>
                          <div className="text-xs font-bold text-teal-700">
                            {row.payment_no}
                          </div>
                          {row.reference_no && (
                            <div className="text-xs text-slate-500">
                              Ref: {row.reference_no}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            <span>
              Page <span className="font-medium text-slate-900">{page}</span> of{" "}
              <span className="font-medium text-slate-900">
                {totalPages || 1}
              </span>
            </span>
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-1 font-medium transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="rounded border border-slate-300 px-3 py-1 font-medium transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>

          {/* FOOTER STATS */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
              <div>
                Total records:{" "}
                <span className="font-semibold text-slate-900">
                  {filteredData.length}
                </span>
              </div>
            
                <div className="flex gap-6">
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
                </div>
            </div>
          </div>
        </div>
      )}
    </ContentArea>
  );
}
