import { toast as toastify } from 'react-toastify';

function finish(type, message, options = {}) {
  if (options.id) {
    toastify.update(options.id, {
      render: message,
      type,
      isLoading: false,
      autoClose: 2500,
      closeButton: true,
      closeOnClick: true
    });
    return options.id;
  }
  return toastify[type](message, options);
}

const toast = {
  success: (message, options) => finish('success', message, options),
  error: (message, options) => finish('error', message, options),
  info: (message, options) => toastify.info(message, options),
  loading: message => toastify.loading(message, { closeOnClick: false }),
  dismiss: id => toastify.dismiss(id),
  confirm: ({ title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm }) => {
    const id = toastify.info(
      <div className="min-w-64">
        <div className="font-semibold text-slate-950">{title}</div>
        {message && <div className="mt-1 text-sm text-slate-600">{message}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => toastify.dismiss(id)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              toastify.dismiss(id);
              onConfirm?.();
            }}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            {confirmText}
          </button>
        </div>
      </div>,
      {
        autoClose: false,
        closeOnClick: false,
        closeButton: true,
        draggable: false
      }
    );
    return id;
  }
};

export default toast;
