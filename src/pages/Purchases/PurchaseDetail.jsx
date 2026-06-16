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
  FileSliders,
  CalendarDays,
  User,
  Phone,
  MapPin,
  Printer,
  Trash2, // Added missing import

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

const today = new Date().toISOString().slice(0, 10);

export default function PurchaseDetail() {
  const [purchase, setPurchase] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [viewPayment, setViewPayment] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

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
      const [purchaseRow, accounts] = await Promise.all([
        modules.purchases.get(id),
        modules.bankAccounts.list(),
      ]);
      setPurchase(purchaseRow);
      setBankAccounts(accounts);
      setPayment((current) => ({
        ...current,
        amount: purchaseRow?.balance_due || "",
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
      await modules.purchases.recordPayment({
        ...payment,
        purchase_id: Number(id),
        amount: Number(payment.amount),
      });
      toast.success("Payment recorded");
      setShowPaymentModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    try {
      await modules.purchases.delete(id);
      toast.success("Purchase bill deleted");
      navigate("/purchases");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function printPdf() {
    const toastId = toast.loading("Preparing print...");
    try {
      await modules.pdf.purchase(id, "print");
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function exportPdf() {
    const toastId = toast.loading("Creating purchase PDF...");
    try {
      await modules.pdf.purchase(id, "export");
      toast.success("Purchase PDF exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  if (!purchase) {
    return (
      <ContentArea>
        <PageHeader title="Purchase Detail" subtitle="Loading..." />
      </ContentArea>
    );
  }

  const isPaid =
    String(purchase?.status || "").toLowerCase() === "paid" ||
    Number(purchase?.balance_due || 0) <= 0;
  const itemRows = purchase.items || [];
  const hasCgstSgst = itemRows.some(i => (i.cgst || 0) > 0 || (i.sgst || 0) > 0);
  const hasIgst = itemRows.some(i => (i.igst || 0) > 0);
  const displayRoundOff = roundAmt(Number(purchase.grand_total || 0) - Number(purchase.subtotal || 0) - Number(purchase.tax_total || 0));

  return (
    <ContentArea>
      <PageHeader
        title={purchase.bill_no || "Purchase Bill"}
        subtitle={purchase.vendor_name || purchase.vendor}
        onBack={() => navigate("/purchases")}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/purchases/edit/${id}`)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={16} className="inline mr-1" /> Edit
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
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} className="inline mr-1" /> Delete
            </button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-5 gap-4 rounded-lg border bg-white p-4 text-sm">
        <div>
          Status
          <br />
          <StatusBadge status={purchase.status} />
        </div>
        <div>
          Bill Date
          <br />
          <strong>{date(purchase.bill_date)}</strong>
        </div>
        <div>
          Total
          <br />
          <strong>{money(purchase.grand_total)}</strong>
        </div>
        <div>
          Paid
          <br />
          <strong>{money(purchase.paid_amount)}</strong>
        </div>
        <div>
          Due
          <br />
          <strong>{money(purchase.balance_due)}</strong>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <InfoRow icon={<FileSliders size={18} />} label="Bill Number" value={purchase.bill_no} />
              <InfoRow icon={<User size={18} />} label="Vendor" value={purchase.vendor_name || purchase.vendor} />
              <InfoRow icon={<Phone size={18} />} label="Vendor Contact" value={purchase.phone} />
            </div>
            <div className="space-y-4">
              <InfoRow icon={<CalendarDays size={18} />} label="Bill Date" value={date(purchase.bill_date)} />
              <InfoRow icon={<CalendarDays size={18} />} label="Due Date" value={date(purchase.due_date)} />
              <InfoRow icon={<MapPin size={18} />} label="Vendor Address" value={[purchase.address, purchase.city, purchase.state].filter(Boolean).join(", ")} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <Package size={20} className="text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-950">Purchase Items</h2>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Name/Description</th>
                <th className="px-4 py-3 font-semibold">SAC</th>
                <th className="px-4 py-3 font-semibold text-center">Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Rate</th>
                <th className="px-4 py-3 font-semibold text-center">GST %</th>
                {hasCgstSgst && (
                  <>
                    <th className="px-4 py-3 font-semibold text-right">CGST</th>
                    <th className="px-4 py-3 font-semibold text-right">SGST</th>
                  </>
                )}
                {hasIgst && <th className="px-4 py-3 font-semibold text-right">IGST</th>}
                <th className="px-4 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemRows.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                    {normalizeDescriptionPoints(item).map((point, pointIndex) => (
                      <div key={pointIndex} className="ml-4 mt-0.5 text-xs text-slate-500">
                        - {point}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-4 align-top text-slate-700">{item.sac_code || "-"}</td>
                  <td className="px-4 py-4 align-top text-center">{item.qty}</td>
                  <td className="px-4 py-4 align-top text-right">{money(item.rate)}</td>
                  <td className="px-4 py-4 align-top text-center">{item.gst_rate}%</td>
                  {hasCgstSgst && (
                    <>
                      <td className="px-4 py-4 align-top text-right">{money(item.cgst)}</td>
                      <td className="px-4 py-4 align-top text-right">{money(item.sgst)}</td>
                    </>
                  )}
                  {hasIgst && <td className="px-4 py-4 align-top text-right">{money(item.igst)}</td>}
                  <td className="px-4 py-4 align-top font-semibold text-right text-slate-950">{money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-4 gap-6 border-t border-slate-200 px-8 py-5 text-sm">
          <div>
            <div className="text-slate-500">Subtotal</div>
            <div className="font-semibold">{money(purchase.subtotal)}</div>
          </div>
          <div>
            <div className="text-slate-500">Tax Total</div>
            <div className="font-semibold text-teal-600">{money(purchase.tax_total)}</div>
          </div>
          <div>
            <div className="text-slate-500">Rounding</div>
            <div className="font-semibold">{money(displayRoundOff)}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-500">Grand Total</div>
            <div className="text-lg font-bold text-teal-700">{money(purchase.grand_total)}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="mb-4 text-lg font-semibold flex items-center gap-2">
          <History size={20} className="text-teal-600" />
          Payment History
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <th className="p-3 text-left">Payment No</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Method</th>
              <th className="p-3 text-right">Amount Paid</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {(purchase.payments || []).map((p) => (
              <tr key={p.id} className="border-b hover:bg-slate-50/50">
                <td className="p-3 font-medium text-slate-900">{p.payment_no}</td>
                <td className="p-3 text-slate-600">{date(p.payment_date)}</td>
                <td className="p-3 capitalize">{p.mode?.replace(/_/g, " ")}</td>
                <td className="p-3 font-semibold text-right">{money(p.amount)}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      title="View Details"
                      onClick={() => setViewPayment(p)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      title="Export Receipt"
                      onClick={async () => {
                        const tid = toast.loading("Exporting receipt...");
                        try {
                          await modules.pdf.purchasePaymentReceipt(p.id, "export");
                          toast.success("Receipt exported", { id: tid });
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
            {!(purchase.payments?.length) && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 italic">No payments recorded</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Purchase Payment"
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
                <option key={acc.id} value={acc.id}>{acc.account_name}</option>
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
              <div className="mb-1 text-xs uppercase text-slate-500">Payment No</div>
              <div className="text-base font-medium">{viewPayment.payment_no}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Amount</div>
              <div className="text-base font-medium">{money(viewPayment.amount)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs uppercase text-slate-500">Mode</div>
              <div className="text-base font-medium capitalize">{viewPayment.mode?.replace(/_/g, " ")}</div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Purchase Bill"
        message="Are you sure you want to delete this purchase bill? This action is permanent and will remove associated payments."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </ContentArea>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-slate-50 p-2 text-slate-600">{icon}</div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
      </div>
    </div>
  );
}
