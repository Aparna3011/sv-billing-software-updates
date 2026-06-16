import { money } from '../../utils/format';

/** discountRupeeAmount: monetary discount applied; optional discountSubtitle e.g. " (10%)" after "Discount". */
export default function AmountSummary({ subtotal = 0, taxTotal = 0, discountRupeeAmount = 0, discountSubtitle = '', total = 0, isGstEnabled = true }) { // Add isGstEnabled prop
  const exactTotal = Number(total || 0);
  const roundedTotal = Math.round(exactTotal);
  const roundOff = Math.round((roundedTotal - exactTotal) * 100) / 100;

  return (
    <div className="ml-auto w-80 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex justify-between py-1"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
      <div className="flex justify-between py-1">
        <span>Discount{discountSubtitle ? <span className="font-normal text-slate-500">{discountSubtitle}</span> : null}</span>
        <strong>{money(discountRupeeAmount)}</strong>
      </div>
      {isGstEnabled && ( // Conditional rendering for GST line
        <div className="flex justify-between py-1"><span>GST</span><strong>{money(taxTotal)}</strong></div>
      )}
      <div className="flex justify-between py-1"><span>Exact Total</span><strong>{money(exactTotal)}</strong></div>
      <div className="flex justify-between py-1">
        <span>Round Off</span>
        <strong>{roundOff >= 0 ? '+' : '-'} {money(Math.abs(roundOff))}</strong>
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-base"><span>Grand Total</span><strong>{money(roundedTotal)}</strong></div>
    </div>
  );
}
