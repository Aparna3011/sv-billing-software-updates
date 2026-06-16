import { Link } from "react-router-dom";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";

export default function Settings() {
  return (
    <ContentArea>
      <PageHeader
        title="Settings"
        subtitle="Application operations and preferences"
      />
      <div className="grid grid-cols-3 gap-4">
        <Link className="rounded-lg border bg-white p-5" to="/settings/backup">
          <strong>Backup & Restore</strong>
          <p className="mt-2 text-sm text-slate-500">
            Create and restore local database backups.
          </p>
        </Link>
        <Link
          className="rounded-lg border bg-white p-5"
          to="/settings/numbering"
        >
          <strong>Numbering</strong>
          <p className="mt-2 text-sm text-slate-500">
            Fiscal-year invoice, quotation, and payment prefixes.
          </p>
        </Link>
        <Link
          className="rounded-lg border bg-white p-5"
          to="/settings/preferences"
        >
          <strong>Preferences</strong>
          <p className="mt-2 text-sm text-slate-500">
            Currency, display, and local defaults.
          </p>
        </Link>
        <Link
          className="rounded-lg border bg-white p-5"
          to="/settings/gst"
        >
          <strong>Tax & GST</strong>
          <p className="mt-2 text-sm text-slate-500">Manage GST settings for outgoing and incoming transactions.</p>
        </Link>
      </div>
    </ContentArea>
  );
}
