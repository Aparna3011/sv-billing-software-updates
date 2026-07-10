import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import StatusBadge from "../../components/status/StatusBadge";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";
import {
  Package,
  FileSliders,
  CalendarDays,
  User,
  Phone,
  MapPin,
  Eye,
  Pencil,
  FileDown,
} from "lucide-react";

const roundAmt = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeState = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pointText = (point) =>
  typeof point === "string" ? point : point?.point_text || "";

const descriptionPoints = (item = {}) => {
  const points = (item.descriptionPoints || [])
    .map(pointText)
    .map((point) => point.trim())
    .filter(Boolean);

  if (points.length) return points;

  return String(item.description || "")
    .split("\n")
    .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
    .filter(Boolean);
};

const isPercentDiscount = (value) =>
  value === true ||
  Number(value) === 1 ||
  String(value ?? "")
    .trim()
    .toLowerCase() === "true";

const computeDiscountAmount = (subtotal, discount, discountIsPercent) => {
  const safeSubtotal = roundAmt(subtotal);

  const rawDiscount = Number(discount);

  if (!Number.isFinite(rawDiscount) || rawDiscount <= 0) return 0;

  if (discountIsPercent) {
    const percent = Math.min(Math.max(rawDiscount, 0), 100);

    return roundAmt(Math.min((safeSubtotal * percent) / 100, safeSubtotal));
  }

  return roundAmt(Math.min(rawDiscount, safeSubtotal));
};

const getQuotationItemRows = (quotation = {}) => {
  const items = quotation.items || [];

  const bases = items.map((item) =>
    roundAmt(
      item.line_total != null
        ? item.line_total
        : Number(item.qty || 0) * Number(item.rate || 0),
    ),
  );

  const subtotal =
    quotation.subtotal != null
      ? roundAmt(quotation.subtotal)
      : roundAmt(bases.reduce((sum, base) => sum + base, 0));

  const discountIsPercent = isPercentDiscount(quotation.discount_is_percent);

  const discountAmount = computeDiscountAmount(
    subtotal,
    quotation.discount,
    discountIsPercent,
  );

  let allocatedRunning = 0;

  return items.map((item, index) => {
    const base = bases[index];

    const itemDiscount =
      index === items.length - 1
        ? roundAmt(Math.max(0, discountAmount - allocatedRunning))
        : subtotal > 0
          ? roundAmt(discountAmount * (base / subtotal))
          : 0;

    if (index !== items.length - 1) {
      allocatedRunning = roundAmt(allocatedRunning + itemDiscount);
    }

    const discountedAmount = roundAmt(Math.max(0, base - itemDiscount));

    const gstRate = item.gst_rate == null ? null : Number(item.gst_rate);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstRate == null || !Number.isFinite(gstRate) || gstRate <= 0) {
      return {
        ...item,

        base,

        itemDiscount,

        discountedAmount,

        cgst,

        sgst,

        igst,

        total: discountedAmount,
      };
    }

    const customerState = normalizeState(quotation?.state);
    const companyState = normalizeState(quotation?.company_state);

    if (companyState && customerState && companyState === customerState) {
      // Same state: split GST into CGST and SGST.
      const taxTotal = roundAmt((discountedAmount * gstRate) / 100);
      cgst = roundAmt(taxTotal / 2);
      sgst = roundAmt(taxTotal - cgst);
    } else {
      // Different or unknown state: show IGST.
      igst = roundAmt((discountedAmount * gstRate) / 100);
    }

    return {
      ...item,

      base,

      itemDiscount,

      discountedAmount,

      cgst,

      sgst,

      igst,

      total: roundAmt(discountedAmount + cgst + sgst + igst),
    };
  });
};

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [company, setCompany] = useState({});
  const load = () =>
    modules.quotations
      .get(Number(id))
      .then(setQuotation)
      .catch((error) => toast.error(error.message));
  useEffect(() => {
    load();
    modules.company.get().then(setCompany);
  }, [id]);
  async function action(fn, message) {
    try {
      const result = await fn(Number(id));
      toast.success(message);
      load(); // Always reload the quotation after an action
    } catch (error) {
      toast.error(error.message);
    }
  }
  async function printPdf() {
    const toastId = toast.loading("Preparing print...");
    try {
      await modules.pdf.quotation(Number(id), "print");
      toast.dismiss(toastId);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function exportPdf() {
    const toastId = toast.loading("Creating quotation PDF...");
    try {
      await modules.pdf.quotation(Number(id), "export");
      toast.success("Quotation PDF exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }
  async function shareEmail() {
    const subject = encodeURIComponent(`Quotation ${quotation?.quotation_no}`);
    const body = encodeURIComponent(
      `Dear ${quotation?.company_name || "Client"},\n\nPlease find the quotation details attached/exported from SV IT Hub Billing.\n\nRegards`,
    );
    window.location.href = `mailto:${quotation?.email || ""}?subject=${subject}&body=${body}`;
  }
  function shareWhatsApp() {
    const text = encodeURIComponent(
      `Quotation ${quotation?.quotation_no} for ${quotation?.company_name}: ${money(quotation?.grand_total)}.`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  const quotationStatus = String(quotation?.status || "").toLowerCase();
  const isConverted =
    quotationStatus === "converted" || Boolean(quotation?.converted_invoice_id);
  const canApprove = quotationStatus === "draft";
  const canCreateWorkOrder = quotationStatus === "accepted" && !isConverted;
  const canConvert = quotationStatus === "accepted" && !isConverted;

  const itemRows = getQuotationItemRows(quotation || {});

  const hasCgstSgst = itemRows.some(
    (item) => Number(item.cgst || 0) > 0 || Number(item.sgst || 0) > 0,
  );

  const hasIgst = itemRows.some((item) => Number(item.igst || 0) > 0);

  const itemTotals = itemRows.reduce(
    (totals, item) => ({
      discountedAmount: roundAmt(
        totals.discountedAmount + item.discountedAmount,
      ),

      cgst: roundAmt(totals.cgst + item.cgst),

      sgst: roundAmt(totals.sgst + item.sgst),

      igst: roundAmt(totals.igst + item.igst),

      total: roundAmt(totals.total + item.total),
    }),
    {
      discountedAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0,
    },
  );

  return (
    <ContentArea>
      <PageHeader
        title={quotation?.quotation_no || "Quotation"}
        subtitle={quotation?.company_name}
        actions={
          <div className="flex gap-2">
            {!isConverted && (
              <button
                onClick={() => navigate(`/quotations/${id}/edit`)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={printPdf}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Print PDF
            </button>
            <button
              onClick={exportPdf}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Export PDF
            </button>
            <button
              onClick={shareEmail}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Email
            </button>
            <button
              onClick={shareWhatsApp}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              WhatsApp
            </button>
            {canApprove && (
              <button
                onClick={() =>
                  action(modules.quotations.approve, "Quotation approved")
                }
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white"
              >
                Approve
              </button>
            )}
            {canConvert && (
              <button
                onClick={() => navigate(`/invoices/new?quotationId=${id}`)}
                className="rounded-md bg-teal-700 px-3 py-2 text-sm text-white"
              >
                Convert
              </button>
            )}
          </div>
        }
      />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200  px-6 py-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
        

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <FileSliders size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Quotation Number
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {quotation?.quotation_no || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg  p-2">
                <User size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {quotation?.company_name || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg  p-2">
                <Phone size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer Contact
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {quotation?.phone || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2">
                <MapPin size={18} className="text-slate-600" />
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer Address
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {[quotation?.city, quotation?.state, quotation?.country]
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
                  Quotation Date
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {date(quotation?.quotation_date)}
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

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Name/Description</th>

                <th className="px-4 py-3 font-semibold">SAC</th>

                <th className="px-4 py-3 font-semibold">Qty</th>

                <th className="px-4 py-3 font-semibold">Rate</th>

                <th className="px-4 py-3 font-semibold">
                  {isPercentDiscount(quotation?.discount_is_percent)
                    ? "Discount (%)"
                    : "Discount (₹)"}
                </th>

                <th className="px-4 py-3 font-semibold">Discounted Amount</th>

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
                    <div className="font-semibold text-slate-950">
                      {item.name || "-"}
                    </div>

                    {descriptionPoints(item).map((point, pointIndex) => (
                      <div
                        key={pointIndex}
                        className="ml-4 mt-1 text-sm text-slate-500"
                      >
                        - {point}
                      </div>
                    ))}
                  </td>

                  <td className="px-4 py-4 align-top text-slate-700">
                    {item.sac_code || "-"}
                  </td>

                  <td className="px-4 py-4 align-top text-slate-700">
                    {item.qty || 0}
                  </td>

                  <td className="px-4 py-4 align-top text-slate-700">
                    {money(item.rate)}
                  </td>

                  <td className="px-4 py-4 align-top text-slate-700">
                    {isPercentDiscount(quotation?.discount_is_percent)
                      ? `${Number(quotation?.discount || 0)}%`
                      : money(item.itemDiscount)}
                  </td>

                  <td className="px-4 py-4 align-top font-medium text-teal-600">
                    {money(item.discountedAmount)}
                  </td>

                  <td className="px-4 py-4 align-top text-slate-700">
                    {item.gst_rate == null
                      ? "No GST"
                      : `${Number(item.gst_rate)}%`}
                  </td>

                  {hasCgstSgst && (
                    <>
                      <td className="px-4 py-4 align-top font-medium">
                        {money(item.cgst)}
                      </td>

                      <td className="px-4 py-4 align-top font-medium">
                        {money(item.sgst)}
                      </td>
                    </>
                  )}

                  {hasIgst && (
                    <td className="px-4 py-4 align-top font-medium">
                      {money(item.igst)}
                    </td>
                  )}

                  <td className="px-4 py-4 align-top font-semibold text-slate-950">
                    {money(item.total)}
                  </td>
                </tr>
              ))}

              {!itemRows.length && (
                <tr>
                  <td
                    colSpan={hasIgst ? 11 : 10}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No service items found
                  </td>
                </tr>
              )}

              {itemRows.length > 0 && (
                <tr className="bg-slate-100 font-semibold">
                  <td
                    colSpan={5}
                    className="px-4 py-4 text-right text-slate-950"
                  >
                    Totals:
                  </td>

                  <td className="px-4 py-4 text-teal-600">
                    {money(itemTotals.discountedAmount)}
                  </td>

                  <td className="px-4 py-4" />

                  {hasCgstSgst && (
                    <>
                      <td className="px-4 py-4 text-teal-600">
                        {money(itemTotals.cgst)}
                      </td>

                      <td className="px-4 py-4 text-teal-600">
                        {money(itemTotals.sgst)}
                      </td>
                    </>
                  )}

                  {hasIgst && (
                    <td className="px-4 py-4 text-teal-600">
                      {money(itemTotals.igst)}
                    </td>
                  )}

                  <td className="px-4 py-4 text-teal-700">
                    {money(quotation?.grand_total ?? itemTotals.total)}
                  </td>
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

              <div className="font-semibold text-teal-600">
                {money(quotation?.igst_total ?? itemTotals.igst)}
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-slate-500">Total CGST</div>

                <div className="font-semibold text-teal-600">
                  {money(quotation?.cgst_total ?? itemTotals.cgst)}
                </div>
              </div>

              <div>
                <div className="text-slate-500">Total SGST</div>

                <div className="font-semibold text-teal-600">
                  {money(quotation?.sgst_total ?? itemTotals.sgst)}
                </div>
              </div>
            </>
          )}

          <div>
            <div className="text-slate-500">Total GST</div>

            <div className="font-semibold text-teal-600">
              {money(quotation?.tax_total)}
            </div>
          </div>

          <div>
            <div className="text-slate-500">Rounding Off</div>

            <div className="font-semibold text-teal-600">
              {money(quotation?.round_off)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="mb-4 text-lg font-semibold">Payment History</div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-3 text-left">Payment ID</th>

              <th className="p-3 text-left">Date</th>

              <th className="p-3 text-left">Amount Paid</th>

              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {(quotation?.payments || []).map((payment) => (
              <tr key={payment.id} className="border-b">
                <td className="p-3">{payment.payment_no}</td>

                <td className="p-3">{payment.payment_date}</td>

                <td className="p-3">
                  ₹
                  {Math.round(Number(payment.amount || 0)).toLocaleString(
                    "en-IN",
                  )}
                </td>

                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <button
                      title="View"
                      onClick={() => setViewPayment(payment)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      title="Edit Payment"
                      onClick={() => {
                        setEditingPayment(payment);
                        setPaymentOpen(true);
                      }}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      title="Export PDF"
                      onClick={async () => {
                        const toastId = toast.loading(
                          "Creating payment PDF...",
                        );

                        try {
                          await modules.pdf.paymentReceipt(payment.id, "export");
                          toast.success("Payment PDF exported", {
                            id: toastId,
                          });
                        } catch (error) {
                          toast.error(error.message, { id: toastId });
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
          </tbody>
        </table>
      </div>
    </ContentArea>
  );
}
