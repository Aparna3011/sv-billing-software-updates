import { useLocation, useNavigate } from 'react-router-dom';

export default function PageHeader({ title, subtitle, actions, back = 'auto', backLabel = 'Back' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const routeDepth = location.pathname.split('/').filter(Boolean).length;
  const shouldShowBack = back === 'auto' ? routeDepth > 1 : back;
  const canGoBack = shouldShowBack && (window.history.state?.idx > 0 || window.history.length > 1);

  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        {canGoBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {backLabel}
          </button>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
