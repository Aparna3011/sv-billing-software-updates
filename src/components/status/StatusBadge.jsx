const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'Partially Paid', color: 'bg-purple-100 text-purple-700' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  converted: { label: 'Converted', color: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700' },
  not_started: { label: 'Not Started', color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  on_hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' }
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}>{config.label}</span>;
}
