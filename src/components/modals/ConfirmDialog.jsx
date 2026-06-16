import Modal from './Modal';

export default function ConfirmDialog({ open, title = 'Confirm action', message, onConfirm, onClose }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
        <button onClick={onConfirm} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white">Confirm</button>
      </div>
    </Modal>
  );
}
