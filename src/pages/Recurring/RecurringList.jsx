import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileDown, FilePlus2, History, Pencil, Play, Square } from "lucide-react";
import toast from "@utils/notify";
import GenericResourcePage from "../_shared/GenericResourcePage";
import StatusBadge from "../../components/status/StatusBadge";
import StopPlanDialog from "../../components/modals/StopPlanDialog";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";

export default function RecurringList() {
  const navigate = useNavigate();
  const [stopDialog, setStopDialog] = useState({
    open: false,
    recurringId: null,
    templateId: null,
    planNo: null,
    isResuming: false,
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleStopPlan = (recurringId, templateId, planNo) => {
    setStopDialog({
      open: true,
      recurringId,
      templateId,
      planNo,
      isResuming: false,
    });
  };

  const handleResumePlan = (recurringId, templateId, planNo) => {
    setStopDialog({
      open: true,
      recurringId,
      templateId,
      planNo,
      isResuming: true,
    });
  };

  const confirmStopPlan = async (reason) => {
    setLoading(true);
    try {
      await modules.recurring.stopRecurring({
        id: stopDialog.recurringId,
        templateId: stopDialog.templateId,
        reason,
      });
      toast.success("Plan stopped successfully");
      setStopDialog({
        open: false,
        recurringId: null,
        templateId: null,
        planNo: null,
        isResuming: false,
      });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmResumePlan = async () => {
    setLoading(true);
    try {
      await modules.recurring.resumeRecurring({
        id: stopDialog.recurringId,
        templateId: stopDialog.templateId,
      });
      toast.success("Plan resumed successfully");
      setStopDialog({
        open: false,
        recurringId: null,
        templateId: null,
        planNo: null,
        isResuming: false,
      });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  async function exportPdf(row) {
    const toastId = toast.loading("Creating recurring billing PDF...");
    try {
      await modules.pdf.recurring(row.id, "export");
      toast.success("Recurring billing PDF exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return (
    <>
      <GenericResourcePage
        key={refreshKey}
        title="Recurring Billing"
        subtitle="Software AMC, hosting, domain, cloud, and SaaS subscription cycles"
        api={modules.recurring}
        disableInlineEdit
        searchKeys={["company_name", "contact_person"]}
        fields={[]}
        columns={[
          {
            key: "recurring_invoice_no",
            label: "Recurring",

            render: (row) => (
              <div className="font-medium text-slate-900">
                {row.recurring_invoice_no || "-"}
              </div>
            ),
          },
          {
            key: "company_name",
            label: "Customer / Services",

            render: (row) => {
              const services = row.service_names
                ? row.service_names.split(",")
                : [];

              return (
                <div>
                  <div className="font-medium text-slate-900">
                    {row.company_name}

                    {row.contact_person && (
                      <span className="ml-1 font-normal text-slate-500">
                        ({row.contact_person})
                      </span>
                    )}
                  </div>

                  {services.length > 0 && (
                    <div className="mt-1 pl-4 space-y-1 text-xs text-slate-500">
                      {services.map((service, index) => (
                        <div key={index}>- {service}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "grand_total",
            label: "Recurring Total",

            render: (row) => money(row.grand_total || 0),
          },

          {
            key: "next_dates",
            label: "Upcoming Cycles",

            render: (row) => {
              const dates = row.next_dates ? row.next_dates.split(",") : [];

              return (
                <div className="space-y-1 text-sm">
                  {dates.map((d, index) => (
                    <div key={index}>{date(d)}</div>
                  ))}
                </div>
              );
            },
          },
          {
            key: "status",
            label: "Status",

            render: (row) => {
              const templates = row.templates
                ? typeof row.templates === "string"
                  ? JSON.parse(row.templates)
                  : row.templates
                : [];

              if (row.is_stopped) return <StatusBadge status="stopped" />;

              const activeCount = templates.filter(
                (t) => ["active", "overdue", "partially_paid", "pending"].includes(t.status) && !t.is_stopped
              ).length;
              const totalCount = templates.length;

              return (
                <div className="space-y-2">
                  {activeCount < totalCount && totalCount > 0 ? (
                    <div>
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                        {activeCount}/{totalCount} Active
                      </span>
                    </div>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      {totalCount > 0 ? "All Active" : "No Active Plans"}
                    </span>
                  )}
                </div>
              );
            },
          },
        ]}
        getViewPath={(row) => `/recurring/${row.id}`}
        rowActions={(row) => (
          <div className="flex gap-1 items-center">
            {row.is_stopped ? (
              <button
                onClick={() => handleResumePlan(row.id, null, row.recurring_invoice_no)}
                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                title="Resume recurring"
              >
                <Play size={16} />
              </button>
            ) : (
              <button
                onClick={() => handleStopPlan(row.id, null, row.recurring_invoice_no)}
                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                title="Stop recurring"
              >
                <Square size={16} />
              </button>
            )}

            <button
              title="Export PDF"
              onClick={() => exportPdf(row)}
              className="rounded p-1.5 text-teal-700 hover:bg-teal-50"
            >
              <FileDown size={16} />
            </button>

            <Link
              title="Edit"
              to={`/recurring/${row.id}/edit`}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <Pencil size={16} />
            </Link>
          </div>
        )}
        extraAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/recurring/history")}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="View all recurring history"
            >
              <History size={16} />
              History
            </button>
            <Link
              to="/recurring/new"
              className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white"
            >
              <FilePlus2 size={16} />
              New recurring
            </Link>
          </div>
        }
      />

      <StopPlanDialog
        open={stopDialog.open}
        planNo={stopDialog.planNo}
        isResuming={stopDialog.isResuming}
        loading={loading}
        onConfirm={stopDialog.isResuming ? confirmResumePlan : confirmStopPlan}
        onCancel={() =>
          setStopDialog({
            open: false,
            recurringId: null,
            templateId: null,
            planNo: null,
            isResuming: false,
          })
        }
      />
    </>
  );
}
