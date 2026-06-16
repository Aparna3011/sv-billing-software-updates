import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from '@utils/notify';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';
import FormInput from '../../components/forms/FormInput';
import FormSelect from '../../components/forms/FormSelect';
import { getDefaultBankAccountId } from '../../utils/banking';
import { modules } from '../../utils/api';
const today = new Date().toISOString().slice(0, 10);

export default function PaymentForm({ invoiceId, payment, recurringInvoiceId: propRecurringId, compact = false, onSaved }) {
  const [searchParams] = useSearchParams();
  const recurringInvoiceId = propRecurringId || searchParams.get('recurring_invoice_id');

  const [form, setForm] = useState({
  invoice_id:
    payment?.invoice_id ||
    invoiceId ||
    '',
  
  recurring_invoice_id:
    payment?.recurring_invoice_id ||
    recurringInvoiceId || '',

  payment_date:
    payment?.payment_date ||
    today,

  amount:
    payment?.amount || 0,

  mode:
    payment?.mode ||
    'bank_transfer',

  reference_no:
    payment?.reference_no || '',

  notes:
    payment?.notes || '',

  bank_account_id:
    payment?.bank_account_id || '',

});
  const [invoices, setInvoices] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  useEffect(() => {
    if (payment?.id) return;

  if (!form.invoice_id) return;

  const selectedInvoice =
    invoices.find(
      row =>
        Number(row.id) ===
        Number(form.invoice_id)
    );

  if (selectedInvoice) {

    setForm(prev => ({
      ...prev,

      amount:
        selectedInvoice.balance_due || 0
    }));

  }

}, [form.invoice_id, invoices]);

  useEffect(() => {
    if (recurringInvoiceId) {
      modules.recurring.getPlan(Number(recurringInvoiceId)).then(plan => {
        if (plan) {
          setForm(prev => ({
            ...prev,
            recurring_invoice_id: Number(recurringInvoiceId),
            customer_id: plan.customer_id,
            customer_name: plan.company_name,
            plan_no: plan.recurring_invoice_no,
            amount: plan.pending_amount || plan.grand_total || 0,
          }));
        }
      }).catch(err => toast.error(err.message));
    }
  }, [recurringInvoiceId]);

  useEffect(() => {
    Promise.all([modules.invoices.list(), modules.bankAccounts.list()])
      .then(([invoiceRows, accountRows]) => {
        setInvoices(invoiceRows);
        setBankAccounts(accountRows);
        
        // Auto-select Cash for new payments
        if (!payment?.id && !form.bank_account_id && accountRows.length > 0) {
          setForm(prev => ({ ...prev, bank_account_id: getDefaultBankAccountId(accountRows) }));
        }
      })
      .catch(error => toast.error(error.message));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      if (payment?.id) {

  await modules.payments.update({
    id: payment.id,
    ...form,
  });

  toast.success('Payment updated');

} else {

  await modules.payments.create({
    ...form,
    invoice_id: form.invoice_id ? Number(form.invoice_id) : null,
    recurring_invoice_id: form.recurring_invoice_id ? Number(form.recurring_invoice_id) : null,
    amount: Number(form.amount),
    bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null,
  });

  toast.success('Payment recorded');

}
      onSaved?.();
    } catch (error) {
      toast.error(error.message);
    }
  }
  const content = (
    <form onSubmit={save} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
      {form.recurring_invoice_id && (
        <div className="rounded-lg bg-teal-50 p-4 border border-teal-100 mb-2">
          <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">Billing Plan Payment</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><span className="text-teal-600 block">Customer</span><span className="font-semibold">{form.customer_name}</span></div>
            <div><span className="text-teal-600 block">Plan No</span><span className="font-semibold">{form.plan_no}</span></div>
          </div>
        </div>
      )}
      {!form.recurring_invoice_id && (
  <FormSelect
  label="Invoice"
  value={form.invoice_id}
  disabled={Boolean(invoiceId)}
  onChange={event =>
    setForm({
      ...form,
      invoice_id: event.target.value
    })
  }
>{invoices
  .filter(row =>
    invoiceId
      ? row.id === invoiceId
      : row.balance_due > 0
  )
  .map(row => (

    <option
      key={row.id}
      value={row.id}
    >
      {row.invoice_no} - {row.company_name}
    </option>

  ))}
      </FormSelect>
      )}
      <FormInput label="Payment Date" type="date" value={form.payment_date} onChange={event => setForm({ ...form, payment_date: event.target.value })} />
      <FormInput label="Amount" type="number" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} />
      <FormSelect label="Mode" value={form.mode} onChange={event => setForm({ ...form, mode: event.target.value })}>
        <option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option>
      </FormSelect>
      <FormSelect label="Bank Account" value={form.bank_account_id} onChange={event => setForm({ ...form, bank_account_id: event.target.value })}>
        <option value="">No bank link</option>
        {bankAccounts.map(account => (
          <option key={account.id} value={account.id}>
            {account.account_name}{account.bank_name ? ` - ${account.bank_name}` : ''}
          </option>
        ))}
      </FormSelect>
      <FormInput label="Reference No" value={form.reference_no} onChange={event => setForm({ ...form, reference_no: event.target.value })} />
      <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Record payment</button>
    </form>
  );
  if (compact) return content;
  return <ContentArea><PageHeader title="Record Payment" subtitle="Partial and full payments are supported" />{content}</ContentArea>;
}
