export default function TableFilters({ value, onChange, placeholder = 'Search records' }) {
  return <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mb-4 w-80 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600" />;
}
