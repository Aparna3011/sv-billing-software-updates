import { useMemo } from "react";
import LineItemRow from "./LineItemRow";
import AmountSummary from "./AmountSummary";

function roundAmt(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Same logic as gst.service computeDiscountAmount (UI preview). */
function rupeeDiscountAmount(subtotal, discount, discountIsPercent) {
  const s = roundAmt(subtotal);
  const raw = Number(discount);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (discountIsPercent) {
    const p = Math.min(Math.max(raw, 0), 100);
    return roundAmt(Math.min((s * p) / 100, s));
  }
  return roundAmt(Math.min(raw, s));
}

export default function LineItemTable({
  items,
  onChange,
  services = [],
  discount = 0,
  discountIsPercent = false,
  gst = [],
  isLastRow,
  serviceLabel = "Service",
  onAddNext,
  isGstEnabled = true, // Add this prop
}) {
  const blankRow = useMemo(() => ({
    name: "",
    description: "",
    descriptionPoints: [],
    sac_code: "",
    qty: 1,
    billing_type: serviceLabel,
    rate: 0,
    gst_rate: serviceLabel === "Category" ? 0 : 18,
  }), [serviceLabel]);

  const rows = items?.length ? items : [blankRow];
  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0),
      0,
    );

    const discountRupeeAmount = rupeeDiscountAmount(
      subtotal,
      discount,
      discountIsPercent,
    );

    const taxableAmount = subtotal - discountRupeeAmount;

    const n = rows.length;
    let allocRun = 0;
    const perRow = rows.map((item, i) => {
      const itemTotal = Number(item.qty || 0) * Number(item.rate || 0);
      let itemDiscount = 0;
      if (subtotal > 0 && discountRupeeAmount > 0) {
        if (i === n - 1)
          itemDiscount = Math.max(0, roundAmt(discountRupeeAmount - allocRun));
        else {
          itemDiscount = roundAmt(discountRupeeAmount * (itemTotal / subtotal));
          allocRun = roundAmt(allocRun + itemDiscount);
        }
      }
      const itemTaxable = Math.max(0, roundAmt(itemTotal - itemDiscount));
      const gstRate = isGstEnabled ? Number(item.gst_rate || 0) : 0; // Modified GST rate calculation
      const itemGST =
        gstRate == null || !Number.isFinite(gstRate)
          ? 0
          : roundAmt((itemTaxable * gstRate) / 100);

      return {
        itemDiscount,
        itemTaxable,
        itemGST: roundAmt(itemGST),
        lineGross: roundAmt(itemTaxable + itemGST),
      };
    });

    const taxTotal = roundAmt(perRow.reduce((sum, r) => sum + r.itemGST, 0));

    return {
      subtotal: roundAmt(subtotal),
      discountRupeeAmount: roundAmt(discountRupeeAmount),
      taxTotal: roundAmt(taxTotal),
      total: roundAmt(taxableAmount + taxTotal),
      perRow,
    };
  }, [rows, discount, discountIsPercent, isGstEnabled]); // Add isGstEnabled to dependencies
  const update = (index, item) =>
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? item : row)));
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">{serviceLabel}</th>
              <th className="p-2">Description</th>
              <th className="p-2">SAC</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Rate</th>
              <th className="p-2 text-right">Discount</th>
              {isGstEnabled && ( // Conditional rendering for GST % header
                <th className="p-2">GST %</th>
              )}
              <th className="p-2 text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item, index) => (
              <LineItemRow
                key={index}
                item={item}
                services={services}
                serviceLabel={serviceLabel}
                gst={gst}
                lineDiscountDisplay={totals.perRow?.[index]?.itemDiscount}
                lineGrossDisplay={totals.perRow?.[index]?.lineGross}
                isGstEnabled={isGstEnabled} // Pass the flag
                onChange={(value) => update(index, value)}
                onRemove={() =>
                  rows.length > 1 &&
                  onChange(rows.filter((_, rowIndex) => rowIndex !== index))
                }
                isLastRow={index === rows.length - 1}
                onAddNext={() => onChange([...rows, blankRow])}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => onChange([...rows, blankRow])}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add {serviceLabel}
        </button>
        <AmountSummary
          subtotal={totals.subtotal}
          taxTotal={totals.taxTotal}
          discountRupeeAmount={totals.discountRupeeAmount}
          discountSubtitle={
            discountIsPercent && Number(discount) > 0 ? ` (${discount}%)` : ""
          }
          total={totals.total}
          isGstEnabled={isGstEnabled} // Pass the flag
        />
      </div>
    </div>
  );
}
