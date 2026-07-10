import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import StatusBadge from "../../components/status/StatusBadge";
import StopPlanDialog from "../../components/modals/StopPlanDialog";
import Modal from "../../components/modals/Modal";
import PaymentForm from "../Payments/PaymentForm";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";

import {
  Calendar,
  Clock,
  History as HistoryIcon,
  BarChart3,
  User,
  Phone,
  MapPin,
  FileSliders,
  Banknote,
  Package,
  Pencil,
  Play,
  FileText,
  ChevronDown,
  ChevronUp,
  Square,
  Eye,
} from "lucide-react";

export default function RecurringDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recurring, setRecurring] = useState(null);
  const [company, setCompany] = useState({});
  const [stopDialog, setStopDialog] = useState({
    open: false,
    templateId: null,
    planNo: null,
    isResuming: false,
  });
  const [paymentDialog, setPaymentOpen] = useState({
    open: false,
    planId: null,
    planNo: null,
  });
  const [loading, setLoading] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [expandedPayments, setExpandedPayments] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadRecurring();
    modules.company.get().then(setCompany);
  }, [id]);

  const loadRecurring = () => {
    modules.recurring
      .get(Number(id)) // Fetch full recurring data including history
      .then(setRecurring)
      .catch((error) => toast.error(error.message));
  };

  const toggleInvoices = (pid) => {
    setExpandedInvoices((prev) => ({ ...prev, [pid]: !prev[pid] }));
  };

  const togglePayments = (pid) => {
    setExpandedPayments((prev) => ({ ...prev, [pid]: !prev[pid] }));
  };

  const templates = (recurring?.templates || []).filter(
    (t) => t.is_active === 1,
  );

  async function printCycleInvoice(historyId) {
    const toastId = toast.loading("Preparing print...");
    try {
      await modules.pdf.recurringInvoice(historyId, "print");
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function exportCycleInvoice(historyId) {
    const toastId = toast.loading("Exporting cycle invoice...");
    try {
      await modules.pdf.recurringInvoice(historyId, "export");
      toast.success("Cycle invoice exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function exportReceipt(paymentId) {
    const toastId = toast.loading("Exporting receipt...");
    try {
      await modules.pdf.paymentReceipt(paymentId, "export");
      toast.success("Receipt exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function printPlanSummary(templateId) {
    if (isGenerating) return;
    setIsGenerating(true);
    const toastId = toast.loading("Preparing print...");
    try {
      await modules.pdf.recurringPlan({ id: Number(id), templateId }, "print");
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }

  async function exportPlanSummary(templateId) {
    if (isGenerating) return;
    setIsGenerating(true);
    const toastId = toast.loading("Exporting plan PDF...");
    try {
      await modules.pdf.recurringPlan({ id: Number(id), templateId }, "export");
      toast.success("Plan PDF exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }

  async function printFullSummary() {
    const toastId = toast.loading("Preparing print...");
    try {
      await modules.pdf.recurring(Number(id), "print");
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function exportFullSummary() {
    const toastId = toast.loading("Exporting full summary...");
    try {
      await modules.pdf.recurring(Number(id), "export");
      toast.success("Full summary exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  function isPercentDiscount(value) {
    return Boolean(value);
  }

  function descriptionPoints(item) {
    if (!item?.description) return [];

    return item.description
      .split("\n")
      .map((text) => text.trim())
      .filter(Boolean);
  }

  const handleStopPlan = (templateId, planNo) => {
    setStopDialog({
      open: true,
      templateId,
      planNo,
      isResuming: false,
    });
  };

  const handleResumePlan = (templateId, planNo) => {
    setStopDialog({
      open: true,
      templateId,
      planNo,
      isResuming: true,
    });
  };

  const confirmStopPlan = async (reason) => {
    setLoading(true);
    try {
      await modules.recurring.stopPlan({
        id: Number(id),
        templateId: stopDialog.templateId,
        reason,
      });
      toast.success("Plan stopped successfully");
      setStopDialog({
        open: false,
        templateId: null,
        planNo: null,
        isResuming: false,
      });
      loadRecurring();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmResumePlan = async () => {
    setLoading(true);
    try {
      await modules.recurring.resumePlan({
        id: Number(id),
        templateId: stopDialog.templateId,
      });
      toast.success("Plan resumed successfully");
      setStopDialog({
        open: false,
        templateId: null,
        planNo: null,
        isResuming: false,
      });
      loadRecurring();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContentArea>
      <PageHeader
        title={recurring?.title || "Recurring Billing"}
        subtitle={recurring?.company_name}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/recurring/${id}/history`)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye size={16} />
              View History
            </button>
            <button
              onClick={() => navigate(`/recurring/${id}/edit`)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              <Pencil size={16} />
              Edit
            </button>
            <button
              onClick={printFullSummary}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText size={16} />
              Print Full Summary
            </button>
            <button
              onClick={exportFullSummary}
              className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              <FileText size={16} />
              Export Full Summary
            </button>
          </div>
        }
      />

      {/* MAIN DETAILS */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <FileSliders size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Recurring NO
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {recurring?.templates?.[0]?.recurring_invoice_no || "-"}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <User size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {recurring?.company_name || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <Phone size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Contact Person
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {recurring?.contact_person || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <MapPin size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Address
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {Boolean(recurring?.address) && (
                    <div className="mb-1">{recurring.address}</div>
                  )}
                  <div className="text-sm font-normal text-slate-600">
                    {[recurring?.city, recurring?.state, recurring?.country]
                      .filter(Boolean)
                      .join(", ") || (!recurring?.address ? "-" : "")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <Package size={20} className="text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-950">
            Service Items
          </h2>
        </div>
        <div className="space-y-8 p-4">
          {templates.map((invoice, templateIndex) => {
            const isPlanStopped = recurring?.is_stopped || invoice?.is_stopped;
            const itemRows = invoice?.items || [];
            const isCompleted = invoice.status === "completed";

            const isOverseas =
              String(recurring?.gst_treatment || "").toLowerCase() ===
              "overseas";
            const sameState =
              String(recurring?.state || "")
                .trim()
                .toLowerCase() ===
              String(recurring?.company_state || "")
                .trim()
                .toLowerCase();

            const hasIgst = !isOverseas && !sameState;
            const hasCgstSgst = !isOverseas && sameState;

            const planHistory = (recurring?.history || [])
              .filter((h) => h.recurring_invoice_id === invoice.id)
              .sort(
                (a, b) =>
                  new Date(b.invoice_start_date) -
                  new Date(a.invoice_start_date),
              );

            const currentCycle =
              planHistory.find(
                (h) => h.invoice_start_date === invoice.start_date,
              ) ||
              planHistory.find((h) => h.action_type === "cycle_generated") ||
              planHistory[0];

            const nextScheduled = currentCycle?.next_invoice_date;

            return (
              <div
                key={invoice.id}
                className="overflow-hidden rounded-lg border border-slate-200"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Plan {templateIndex + 1} (ID: {invoice.id}) -{" "}
                        {invoice.recurring_invoice_no}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Frequency:{" "}
                        <span className="capitalize font-bold text-slate-700">
                          {invoice.billing_cycle?.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => printPlanSummary(invoice.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 hover:text-teal-600"
                      >
                        Print Plan
                      </button>
                      <button
                        onClick={() => exportPlanSummary(invoice.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 hover:text-teal-600"
                      >
                        Export Plan
                      </button>
                      <button
                        onClick={() =>
                          setPaymentOpen({
                            open: true,
                            planId: invoice.id,
                            planNo: invoice.recurring_invoice_no,
                            amount: invoice.pending_amount || 0,
                          })
                        }
                        disabled={isCompleted || isPlanStopped}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isCompleted || isPlanStopped
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                        }`}
                        title={isCompleted ? "Fully Paid" : "Receive payment"}
                      >
                        <Banknote size={14} />
                        {isCompleted ? "Paid" : "Receive Payment"}
                      </button>
                      <StatusBadge
                        status={
                          invoice.status === "completed"
                            ? "completed"
                            : invoice.is_stopped
                              ? "stopped"
                              : invoice.status
                        }
                      />

                      {isPlanStopped ? (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            Stopped
                          </span>
                          <button
                            disabled={recurring?.is_stopped}
                            onClick={() =>
                              handleResumePlan(
                                invoice.id,
                                invoice.recurring_invoice_no,
                              )
                            }
                            className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 flex items-center gap-1"
                            title="Resume plan"
                          >
                            <Play size={14} />
                            <span className="text-xs font-medium">Resume</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={recurring?.is_stopped}
                          onClick={() =>
                            !recurring?.is_stopped &&
                            handleStopPlan(
                              invoice.id,
                              invoice.recurring_invoice_no,
                            )
                          }
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 flex items-center gap-1"
                          title="Stop plan"
                        >
                          <Square size={14} />
                          <span className="text-xs font-medium">Stop</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {Boolean(isPlanStopped) &&
                    !invoice.status === "completed" &&
                    (invoice.stopped_reason || recurring?.stopped_reason) && (
                      <div className="mt-3 rounded bg-red-50 p-2 border-l-4 border-red-400">
                        <p className="text-xs text-red-800">
                          <strong>Reason:</strong>{" "}
                          {invoice.stopped_reason || recurring?.stopped_reason}
                        </p>
                      </div>
                    )}
                </div>

                {/* SIMPLIFIED PLAN SUMMARY */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 border-b border-slate-100 bg-white">
                  {isPlanStopped ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Plan Status
                        </p>
                        <p className="text-lg font-black text-rose-600 uppercase">
                          Stopped
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Stopped On
                        </p>
                        <p className="text-lg font-bold text-slate-800">
                          {date(currentCycle?.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <p className="text-xs font-medium text-slate-500 italic">
                          No future invoices will be generated.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Current Cycle
                        </p>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={
                              currentCycle?.collection_status || "pending"
                            }
                          />
                          {currentCycle?.collection_status === "completed" && (
                            <span className="text-[10px] font-bold text-emerald-600">
                              Paid on {date(currentCycle.paid_on_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {currentCycle?.collection_status === "partially_paid"
                            ? "Remaining Balance"
                            : "Amount Due"}
                        </p>
                        <p
                          className={`text-xl font-black ${(currentCycle?.cycle_pending_amount || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {money(
                            currentCycle?.cycle_pending_amount ??
                              currentCycle?.pending_amount ??
                              0,
                          )}
                        </p>
                        {currentCycle?.collection_status ===
                          "partially_paid" && (
                          <p className="text-[10px] font-bold text-slate-400">
                            Paid:{" "}
                            {money(
                              currentCycle.cycle_paid_amount ??
                                currentCycle.paid_amount,
                            )}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Next Invoice Date
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-slate-800">
                            {date(
                              currentCycle?.next_invoice_date ||
                                invoice.next_invoice_date,
                            )}
                          </p>
                          {nextScheduled && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-tighter border border-blue-100">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ERP HIERARCHY: HISTORY & PAYMENTS */}
                <div className="bg-white px-4 py-2 border-b border-slate-100">
                  {/* Collapsible Generated Invoices */}
                  <div className="border-b border-slate-50">
                    <button
                      onClick={() => toggleInvoices(invoice.id)}
                      className="flex w-full items-center justify-between py-3 text-xs font-bold uppercase text-slate-500 hover:text-teal-600"
                    >
                      <span className="flex items-center gap-2">
                        Generated Invoice Cycles{" "}
                        {expandedInvoices[invoice.id] ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                    </button>
                    {expandedInvoices[invoice.id] && (
                      <div className="pb-4 overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-100">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Invoice No</th>
                              <th className="px-3 py-2">Billing Period</th>
                              <th className="px-3 py-2">Invoice Date</th>
                              <th className="px-3 py-2">Due Date</th>
                              <th className="px-3 py-2 text-right">Total</th>
                              <th className="px-3 py-2 text-right">Paid</th>
                              <th className="px-3 py-2 text-right">Due</th>
                              <th className="px-3 py-2 text-center">Status</th>
                              <th className="px-3 py-2 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {planHistory
                              .filter((h) =>
                                [
                                  "cycle_generated",
                                  "invoice_generated",
                                  "plan_created",
                                ].includes(h.action_type),
                              )
                              .map((h, hi) => (
                                <tr key={hi}>
                                  <td className="px-3 py-2 font-bold text-slate-700">
                                    {h.generated_invoice_no || "Proforma"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {date(h.invoice_start_date)} →{" "}
                                    {date(h.next_invoice_date)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {date(
                                      h.invoice_date || h.invoice_start_date,
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    {date(h.due_date)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {money(h.grand_total)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-emerald-600">
                                    {money(
                                      h.cycle_paid_amount ?? h.paid_amount,
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-red-600">
                                    {money(
                                      h.cycle_pending_amount ??
                                        h.pending_amount,
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <StatusBadge
                                      status={
                                        h.action_type === "cycle_generated"
                                          ? "upcoming"
                                          : h.cycle_collection_status ||
                                            h.collection_status
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                      <button
                                        onClick={() => printCycleInvoice(h.id)}
                                        className="text-teal-600 hover:underline"
                                      >
                                        Print Invoice
                                      </button>
                                      <button
                                        onClick={() => exportCycleInvoice(h.id)}
                                        className="text-teal-700 hover:underline"
                                      >
                                        Export Invoice
                                      </button>
                                      {(h.cycle_payment_id || h.payment_id) && (
                                        <button
                                          onClick={() =>
                                            exportReceipt(
                                              h.cycle_payment_id ||
                                                h.payment_id,
                                            )
                                          }
                                          className="text-blue-600 hover:underline"
                                        >
                                          Export Receipt
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Payment History */}
                  <div>
                    <button
                      onClick={() => togglePayments(invoice.id)}
                      className="flex w-full items-center justify-between py-3 text-xs font-bold uppercase text-slate-500 hover:text-blue-600"
                    >
                      <span className="flex items-center gap-2">
                        Payment History{" "}
                        {expandedPayments[invoice.id] ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                    </button>
                    {expandedPayments[invoice.id] && (
                      <div className="pb-4 overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-100">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Payment No</th>
                              <th className="px-3 py-2">Against Invoice</th>
                              <th className="px-3 py-2">Payment Date</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                              <th className="px-3 py-2">Mode</th>
                              <th className="px-3 py-2 text-center">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {planHistory
                              .filter(
                                (h) => h.action_type === "payment_received",
                              )
                              .map((h, pi) => (
                                <tr key={pi}>
                                  <td className="px-3 py-2 font-bold text-blue-700">
                                    {h.payment_no}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">
                                    {h.generated_invoice_no ||
                                      h.recurring_invoice_no ||
                                      "-"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {date(h.payment_date)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-900">
                                    {money(h.amount)}
                                  </td>
                                  <td className="px-3 py-2 capitalize">
                                    {h.mode?.replace("_", " ")}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      onClick={() =>
                                        exportReceipt(h.payment_id)
                                      }
                                      className="text-blue-600 hover:underline"
                                    >
                                      Export Receipt
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            {!planHistory.some(
                              (h) => h.action_type === "payment_received",
                            ) && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-3 py-4 text-center text-slate-400 italic"
                                >
                                  No payments recorded for this plan
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">
                          Name/Description
                        </th>

                        <th className="px-4 py-3 font-semibold">SAC</th>

                        <th className="px-4 py-3 font-semibold">Qty</th>

                        <th className="px-4 py-3 font-semibold">Rate</th>

                        <th className="px-4 py-3 font-semibold">
                          {invoice.discount_is_percent
                            ? "Discount (%)"
                            : "Discount (₹)"}
                        </th>

                        <th className="px-4 py-3 font-semibold">
                          Discounted Amount
                        </th>

                        <th className="px-4 py-3 font-semibold">GST %</th>

                        {hasCgstSgst && (
                          <>
                            <th className="px-4 py-3 font-semibold">CGST</th>

                            <th className="px-4 py-3 font-semibold">SGST</th>
                          </>
                        )}

                        {hasIgst && (
                          <th className="px-4 py-3 font-semibold">IGST</th>
                        )}

                        <th className="px-4 py-3 font-semibold">Total</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {itemRows.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">
                              {item.name}
                            </div>

                            {descriptionPoints(item).length > 0 && (
                              <div className="mt-2 pl-4 space-y-1 text-slate-500">
                                {descriptionPoints(item).map((point, idx) => (
                                  <div key={idx}> {point}</div>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4">{item.sac_code || "-"}</td>

                          <td className="px-4 py-4">{item.qty}</td>

                          <td className="px-4 py-4">{money(item.rate)}</td>

                          <td className="px-4 py-4">
                            {(() => {
                              const subtotal = Number(invoice.subtotal || 0);

                              const totalDiscount = Number(
                                invoice.discount || 0,
                              );

                              const itemDiscount = invoice.discount_is_percent
                                ? (item.line_total * totalDiscount) / 100
                                : subtotal > 0
                                  ? (item.line_total / subtotal) * totalDiscount
                                  : 0;

                              return invoice.discount_is_percent
                                ? `${invoice.discount}%`
                                : money(itemDiscount);
                            })()}
                          </td>

                          <td className="px-4 py-4 text-teal-600">
                            {(() => {
                              const subtotal = Number(invoice.subtotal || 0);

                              const totalDiscount = Number(
                                invoice.discount || 0,
                              );

                              const itemDiscount = invoice.discount_is_percent
                                ? (item.line_total * totalDiscount) / 100
                                : subtotal > 0
                                  ? (item.line_total / subtotal) * totalDiscount
                                  : 0;

                              const discountedAmount =
                                Number(item.line_total || 0) - itemDiscount;

                              return money(discountedAmount);
                            })()}
                          </td>
                          <td className="px-4 py-4">{item.gst_rate}%</td>

                          {hasCgstSgst && (
                            <>
                              <td className="px-4 py-4">{money(item.cgst)}</td>

                              <td className="px-4 py-4">{money(item.sgst)}</td>
                            </>
                          )}

                          {hasIgst && (
                            <td className="px-4 py-4">{money(item.igst)}</td>
                          )}

                          <td className="px-4 py-4 font-semibold text-teal-700">
                            {(() => {
                              const subtotal = Number(invoice.subtotal || 0);

                              const totalDiscount = Number(
                                invoice.discount || 0,
                              );

                              const itemDiscount = invoice.discount_is_percent
                                ? (item.line_total * totalDiscount) / 100
                                : subtotal > 0
                                  ? (item.line_total / subtotal) * totalDiscount
                                  : 0;

                              const discountedAmount =
                                Number(item.line_total || 0) - itemDiscount;

                              const tax =
                                Number(item.cgst || 0) +
                                Number(item.sgst || 0) +
                                Number(item.igst || 0);

                              return money(discountedAmount + tax);
                            })()}
                          </td>
                        </tr>
                      ))}

                      <tr className="bg-slate-100 font-semibold">
                        <td
                          colSpan={5}
                          className="px-4 py-4 text-right text-slate-950"
                        >
                          Totals:
                        </td>

                        <td className="px-4 py-4 text-teal-600">
                          {money(invoice.subtotal)}
                        </td>

                        <td></td>

                        {hasCgstSgst && (
                          <>
                            <td className="px-4 py-4 text-teal-700">
                              {money(invoice.cgst_total)}
                            </td>

                            <td className="px-4 py-4 text-teal-700">
                              {money(invoice.sgst_total)}
                            </td>
                          </>
                        )}

                        {hasIgst && (
                          <td className="px-4 py-4 text-teal-700">
                            {money(invoice.igst_total)}
                          </td>
                        )}

                        <td className="px-4 py-4 text-teal-700">
                          {money(invoice.grand_total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StopPlanDialog
        open={stopDialog.open}
        planNo={stopDialog.planNo}
        isResuming={stopDialog.isResuming}
        loading={loading}
        onConfirm={stopDialog.isResuming ? confirmResumePlan : confirmStopPlan}
        onCancel={() =>
          setStopDialog({
            open: false,
            templateId: null,
            planNo: null,
            isResuming: false,
          })
        }
      />
      <Modal
        open={paymentDialog.open}
        title={`Receive Payment - ${paymentDialog.planNo}`}
        onClose={() =>
          setPaymentOpen({ open: false, planId: null, planNo: null })
        }
      >
        <PaymentForm
          compact
          recurringInvoiceId={paymentDialog.planId}
          defaultAmount={paymentDialog.amount}
          onSaved={() => {
            setPaymentOpen({ open: false, planId: null, planNo: null });
            loadRecurring();
          }}
        />
      </Modal>
    </ContentArea>
  );
}

function DetailItem({ label, value, className = "" }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">
        {label}
      </p>
      <p className={`text-xs font-bold text-slate-800 ${className}`}>
        {value || "-"}
      </p>
    </div>
  );
}
