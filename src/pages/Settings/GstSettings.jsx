import { useEffect, useState } from "react";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import { modules } from "../../utils/api";

export default function GstSettings() {
  const [outgoingEnabled, setOutgoingEnabled] = useState(true);
  const [incomingEnabled, setIncomingEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const [outgoing, incoming] = await Promise.all([
          modules.settings.get({ key: "gst_enabled_outgoing" }),
          modules.settings.get({ key: "gst_enabled_incoming" }),
        ]);
        setOutgoingEnabled(outgoing?.value === "1");
        setIncomingEnabled(incoming?.value === "1");
      } catch (error) {
        toast.error("Failed to load GST settings: " + error.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setIsLoading(true);
    const toastId = toast.loading("Saving GST settings...");
    try {
      await Promise.all([
        modules.settings.set({
          key: "gst_enabled_outgoing",
          value: outgoingEnabled ? "1" : "0",
        }),
        modules.settings.set({
          key: "gst_enabled_incoming",
          value: incomingEnabled ? "1" : "0",
        }),
      ]);
      toast.success("GST settings saved successfully!", { id: toastId });
    } catch (error) {
      toast.error("Failed to save GST settings: " + error.message, {
        id: toastId,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ContentArea>
      <PageHeader
        title="Tax & GST Settings"
        subtitle="Manage GST configuration for your business documents"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        {isLoading ? (
          <div className="py-10 text-center text-slate-500">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-700">
                  Enable GST for Outgoing Documents
                </span>
                <span className="block text-xs text-slate-500">
                  (Invoices, Quotations, Recurring Billing)
                </span>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={outgoingEnabled}
                onChange={(e) => setOutgoingEnabled(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-700">
                  Enable GST for Incoming Transactions
                </span>
                <span className="block text-xs text-slate-500">
                  (Purchases, Expenses)
                </span>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={incomingEnabled}
                onChange={(e) => setIncomingEnabled(e.target.checked)}
              />
            </label>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="px-6 py-2 rounded-lg bg-teal-600 text-white font-bold shadow-lg hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </ContentArea>
  );
}