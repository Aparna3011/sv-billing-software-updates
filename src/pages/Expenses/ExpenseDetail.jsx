import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import StatusBadge from "../../components/status/StatusBadge";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";
import {
  Eye,
  Pencil,
  FileDown,
  Package,
  ArrowLeft,
  FileSliders,
  CalendarDays,
  User,
  Phone,
  MapPin,
  Trash2,
  Printer,
  Plus,
  History,
} from "lucide-react";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextarea";
import { getDefaultBankAccountId } from "../../utils/banking";
import ConfirmationModal from "../../components/modals/ConfirmationModal";
import Modal from "../../components/modals/Modal";

const roundAmt = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeDescriptionPoints = (item) => {
  if (Array.isArray(item?.descriptionPoints) && item.descriptionPoints.length > 0) {
    return item.descriptionPoints
      .map((p) => (typeof p === "string" ? p : p.point_text))
      .filter(Boolean);
  }
  return String(item?.description || "")
    .split("\n")
    .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
    .filter(Boolean);
};

export default function ExpenseDetail() {
  const [company, setCompany] = useState({});
  const [expense, setExpense] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [viewPayment, setViewPayment] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const [payment, setPayment] = useState({
    payment_date: today,
    amount: "",
    mode: "bank_transfer",
    bank_account_id: "",
    reference_no: "",
    notes: "",
  });

  async function load() {
    try {
      const [data, accounts, comp] = await Promise.all([
        modules.expenses.get(id),
        modules.bankAccounts.list(),
        modules.company.get(),
      ]);
      setExpense(data);
      setBankAccounts(accounts);
      setCompany(comp);
      setPayment((current) => ({
        ...current,
        amount: data?.balance_due || "",
        bank_account_id: getDefaultBankAccountId(accounts),
      }));
    } catch (error) {
      toast.error(error.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleRecordPayment(e) {
    e.preventDefault();
    try {
      await modules.expenses.recordPayment({ ...payment, amount: Number(payment.amount), expense_id: Number(id) });
      toast.success("Payment recorded");
      setShowPaymentModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    try {
      await modules.expenses.delete(id);
      toast.success("Expense deleted");
      navigate("/expenses");
    } catch (err) {
      toast.error(err.message);
    }
  }
  async function printPdf() {
    const toastId = toast.loading("Preparing print...");
    try {
      await modules.pdf.expense(Number(id), "print");
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function exportPdf() {
    const toastId = toast.loading("Creating expense PDF...");
    try {
      await modules.pdf.expense(Number(id), "export");
      toast.success("Expense PDF exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  const isPaid =
    String(expense?.status || "").toLowerCase() === "paid" ||
    Number(expense?.balance_due || 0) <= 0;
  const itemRows = expense?.items || [];
  const hasCgstSgst = itemRows.some(
    (item) => Number(item.cgst || 0) > 0 || Number(item.sgst || 0) > 0,
  );
  const hasIgst = itemRows.some((item) => Number(item.igst || 0) > 0);
  const itemTotals = {
    subtotal: roundAmt(expense?.subtotal || 0),
    cgst: roundAmt(expense?.cgst_total || 0),
    sgst: roundAmt(expense?.sgst_total || 0),
    igst: roundAmt(expense?.igst_total || 0),
    total: roundAmt(itemRows.reduce((sum, i) => sum + (i.line_total || 0), 0)),
  };
  const displayTaxTotal = roundAmt(expense?.tax_total || 0);
  const displayRoundOff = roundAmt(
    Number(expense?.total_amount || 0) - (itemTotals.subtotal + displayTaxTotal),
  );

  if (!expense) {
    return (
      <ContentArea>
        <PageHeader title="Expense Detail" subtitle="Loading..." />
      </ContentArea>
    );
  }

  return (
    <ContentArea>
      <PageHeader
        title={expense?.expense_no || "Expense"}
        subtitle={expense?.vendor_name || expense?.vendor}
        onBack={() => navigate("/expenses")}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/expenses/edit/${id}`)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              onClick={printPdf}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Print PDF
            </button>
            <button
              onClick={exportPdf}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </button>
            {!isPaid && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 shadow-md active:scale-95 transition-all"
              >
                <Plus size={16} className="inline mr-1" /> Record payment
              </button>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
                  </div>
        }
      />

      <div className="mb-4 grid grid-cols-5 gap-4 rounded-lg border bg-white p-4 text-sm">
        <div>
          Status
          <br />
          <StatusBadge status={expense?.status} />
        </div>
        <div>
          Expense Date
          <br />
          <strong>{date(expense?.expense_date)}</strong>
        </div>
        <div>
          Total
          <br />
          <strong>₹{Number(expense?.total_amount || 0).toLocaleString("en-IN")}</strong>
        </div>
        <div>
          Paid
          <br />
          <strong>₹{Number(expense?.paid_amount || 0).toLocaleString("en-IN")}</strong>
        </div>
        <div>
          Due
          <br />
          <strong>₹{Number(expense?.balance_due || 0).toLocaleString("en-IN")}</strong>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <FileSliders size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Expense Number
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {expense?.expense_no || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <User size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Vendor
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {expense?.vendor_name || expense?.vendor || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <Phone size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Vendor Contact
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {expense?.phone || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <MapPin size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Vendor Address
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {[expense?.address, expense?.city, expense?.state, expense?.country]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <CalendarDays size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Expense Date
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {date(expense?.expense_date)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <Package size={20} className="text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-950">Expense Items</h2>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Name/Description</th>
                <th className="px-4 py-3 font-semibold">SAC</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Rate</th>
                {/* Expenses do not have document-level discounts */}
                {/* <th className="px-4 py-3 font-semibold">Discount</th> */}
                <th className="px-4 py-3 font-semibold">GST %</th>
                {hasCgstSgst && (
                  <>
                    <th className="px-4 py-3 font-semibold">CGST</th>
                    <th className="px-4 py-3 font-semibold">SGST</th>
                  </>
                )}
                {hasIgst && <th className="px-4 py-3 font-semibold">IGST</th>}
                <th className="px-4 py-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemRows.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm font-semibold text-slate-950">{item.name || "-"}</div>
                    {normalizeDescriptionPoints(item).map((point, pointIndex) => (
                      <div key={pointIndex} className="ml-4 mt-0.5 text-xs text-slate-500">
                        - {point}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-4 align-top text-slate-700">{item.sac_code || "-"}</td>
                  <td className="px-4 py-4 align-top text-slate-700">{item.qty || 0}</td>
                  <td className="px-4 py-4 align-top text-slate-700">{money(item.rate)}</td>
                  {/* Removed Discount and Discounted Amount columns */}
                  {/* <td className="px-4 py-4 align-top text-slate-700">{money(0)}</td> */}
                  {/* <td className="px-4 py-4 align-top font-medium text-teal-600">{money(Number(item.qty || 1) * Number(item.rate || 0))}</td> */}
                  <td className="px-4 py-4 align-top text-slate-700">{Number(item.gst_rate || 0)}%</td>
                  {hasCgstSgst && (
                    <>
                      <td className="px-4 py-4 align-top font-medium">{money(item.cgst)}</td>
                      <td className="px-4 py-4 align-top font-medium">{money(item.sgst)}</td>
                    </>
                  )}
                  {hasIgst && (
                    <td className="px-4 py-4 align-top font-medium">{money(item.igst)}</td>
                  )}
                  <td className="px-4 py-4 align-top font-semibold text-slate-950">
                    {money(item.line_total)}
                  </td>
                </tr>
              ))}
              {itemRows.length > 0 && (
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={5} className="px-4 py-4 text-right text-slate-950">
                    Totals:
                  </td>
                  {/* Removed Discounted Amount total */}
                  {/* <td className="px-4 py-4 text-teal-600">{money(itemTotals.subtotal)}</td> */}
                  {hasCgstSgst && (
                    <>
                      <td className="px-4 py-4 text-teal-600">{money(itemTotals.cgst)}</td>
                      <td className="px-4 py-4 text-teal-600">{money(itemTotals.sgst)}</td>
                    </>
                  )}
                  {hasIgst && <td className="px-4 py-4 text-teal-600">{money(itemTotals.igst)}</td>}
                  <td className="px-4 py-4 text-teal-700">{money(expense?.total_amount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className={`grid gap-6 border-t border-slate-200 px-8 py-5 text-sm ${
            hasIgst ? "md:grid-cols-3" : "md:grid-cols-4"
          }`}
        >
          {hasIgst ? (
            <div>
              <div className="text-slate-500">Total IGST</div>
              <div className="font-semibold text-teal-600">{money(expense?.igst_total)}</div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-slate-500">Total CGST</div>
                <div className="font-semibold text-teal-600">{money(expense?.cgst_total)}</div>
              </div>
              <div>
                <div className="text-slate-500">Total SGST</div>
                <div className="font-semibold text-teal-600">{money(expense?.sgst_total)}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-slate-500">Total GST</div>
            <div className="font-semibold text-teal-600">{money(displayTaxTotal)}</div>
          </div>
          <div>
            <div className="text-slate-500">Rounding Off</div>
            <div className="font-semibold text-teal-600">{money(displayRoundOff)}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="mb-4 text-lg font-semibold">Payment History</div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="p-3 text-left">Payment No</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Amount Paid</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {(expense?.payments || []).map((p) => (
              <tr key={p.id} className="border-b hover:bg-slate-50/50">
                <td className="p-3 font-medium text-slate-900">{p.payment_no}</td>
                <td className="p-3 text-slate-600">{date(p.payment_date)}</td>
                <td className="p-3 font-semibold text-slate-900">
                  ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <button
                      title="View"
                      onClick={() => setViewPayment(p)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      title="Export PDF"
                      onClick={async () => {
                        const tid = toast.loading("Creating payment PDF...");
                        try {
                          await modules.pdf.purchasePaymentReceipt(p.id, "export");
                          toast.success("Payment PDF exported", { id: tid });
                        } catch (err) {
                          toast.error(err.message, { id: tid });
                        }
                      }}
                      className="rounded p-1.5 text-teal-700 hover:bg-teal-50"
                    >
                      <FileDown size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!(expense?.payments?.length) && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                  No payments recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Expense Payment"
      >
        <form onSubmit={handleRecordPayment} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Payment Date"
              type="date"
              value={payment.payment_date}
              onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })}
              required
            />
            <FormInput
              label="Amount"
              type="number"
              step="0.01"
              value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Payment Mode"
              value={payment.mode}
              onChange={(e) => setPayment({ ...payment, mode: e.target.value })}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
            </FormSelect>
            <FormSelect
              label="Bank Account"
              value={payment.bank_account_id}
              onChange={(e) => setPayment({ ...payment, bank_account_id: e.target.value })}
              required
            >
              <option value="">Select Account</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name}
                </option>
              ))}
            </FormSelect>
          </div>
          <FormInput
            label="Reference No"
            placeholder="e.g. TXN123456"
            value={payment.reference_no}
            onChange={(e) => setPayment({ ...payment, reference_no: e.target.value })}
          />
          <FormTextarea
            label="Notes"
            rows={2}
            value={payment.notes}
            onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="flex-1 rounded-lg border border-slate-300 py-2 font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-teal-600 py-2 font-bold text-white shadow-lg shadow-teal-100 hover:bg-teal-700"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewPayment)} title="Payment Details" onClose={() => setViewPayment(null)}>
        {viewPayment && (
          <div className="grid gap-4">
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Payment ID</div>
              <div className="text-base font-medium">{viewPayment.payment_no}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Amount</div>
              <div className="text-base font-medium">
                ₹{Math.round(Number(viewPayment.amount || 0)).toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Payment Date</div>
              <div className="text-base font-medium">{viewPayment.payment_date}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Mode</div>
              <div className="text-base font-medium capitalize">
                {viewPayment.mode?.replaceAll("_", " ")}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action is permanent and will remove associated payments."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </ContentArea>
  );
}