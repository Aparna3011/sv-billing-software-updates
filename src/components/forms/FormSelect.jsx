import { forwardRef } from 'react';

const FormSelect = forwardRef(function FormSelect({ label, error, children, ...props }, ref) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select ref={ref} {...props} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600">{children}</select>
      {error && <span className="mt-1 block text-xs text-red-600">{error.message || error}</span>}
    </label>
  );
});

export default FormSelect;
