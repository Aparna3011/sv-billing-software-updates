export default function ServiceSelect({ services = [], value, onChange }) {
  return (
    <select value={value || ''} onChange={event => onChange(Number(event.target.value))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600">
      <option value="">Select service</option>
      {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
    </select>
  );
}
