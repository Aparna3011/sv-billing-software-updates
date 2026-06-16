import { FileDown, Sheet } from "lucide-react";
import toast from "@utils/notify";
import { modules } from "../../utils/api";

export default function ReportExportButtons({ title, columns, rows }) {
  async function exportReport(type) {
    const toastId = toast.loading(`Exporting ${type === "pdf" ? "PDF" : "Excel"}...`);
    try {
      const payload = { title, columns, rows };
      if (type === "pdf") await modules.reports.exportPdf(payload);
      else await modules.reports.exportExcel(payload);
      toast.success("Report exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => exportReport("pdf")}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <FileDown size={16} />
        PDF
      </button>
      <button
        type="button"
        onClick={() => exportReport("excel")}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Sheet size={16} />
        Excel
      </button>
    </div>
  );
}
