export default function GSTSelect({
  rates = [],
  value,
  onChange,
}) {
  return (
    <select
      value={
        value === null || value === undefined
          ? 'nogst'
          : String(value)
      }
      onChange={event => {
        const val = event.target.value;

        if (val === 'nogst') {
          onChange(null);
        } else {
          onChange(Number(val));
        }
      }}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
    >
      {rates.map(rate => (
        <option
          key={rate.id}
          value={
            rate.rate === null
              ? 'nogst'
              : String(rate.rate)
          }
        >
          {rate.label}
        </option>
      ))}
    </select>
  );
}