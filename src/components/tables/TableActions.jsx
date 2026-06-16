import { Eye, Pencil, Trash2 } from 'lucide-react';

export default function TableActions({ onView, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      {onView && <button title="View" onClick={onView} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Eye size={16} /></button>}
      {onEdit && <button title="Edit" onClick={onEdit} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button>}
      {onDelete && <button title="Delete" onClick={onDelete} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>}
    </div>
  );
}
