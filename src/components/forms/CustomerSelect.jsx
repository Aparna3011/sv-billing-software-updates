export default function CustomerSelect({ customers = [], value,name, onChange }) {
  return (
    <select name={name} value={value || ''} onChange={event => onChange(Number(event.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600">
      <option value="">Select customer</option>
      {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.company_name} - {customer.contact_person || 'No contact'}</option>)}
    </select>
  );
}
