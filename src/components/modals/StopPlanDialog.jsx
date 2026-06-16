import { useState } from "react";
import Modal from "./Modal";
import FormTextarea from "../forms/FormTextarea";
import toast from "@utils/notify";

export default function StopPlanDialog({
  open,
  planNo,
  onConfirm,
  onCancel,
  isResuming = false,
  loading = false,
}) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!isResuming && !reason.trim()) {
      toast.error("Please provide a reason for stopping this plan");
      return;
    }

    onConfirm(reason);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={isResuming ? "Resume Billing Plan" : "Stop Billing Plan"}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <strong>Plan:</strong> {planNo}
        </p>

        {!isResuming ? (
          <div>
            <FormTextarea
              label="Reason for stopping this plan"
              placeholder="e.g., Contract ended, Customer request, Service discontinued, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="mt-2 text-xs text-slate-500">
              This reason will be stored for reference and displayed in the
              billing history.
            </p>
          </div>
        ) : (
          <p className="text-sm text-emerald-600">
            This plan will resume generating invoices according to its billing
            cycle schedule.
          </p>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
              isResuming
                ? "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400"
                : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
            }`}
          >
            {loading ? "..." : isResuming ? "Resume Plan" : "Stop Plan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
