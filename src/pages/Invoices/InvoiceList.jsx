import { Link } from "react-router-dom";
import { FileDown, FilePlus2, Pencil } from "lucide-react";
import toast from "@utils/notify";
import GenericResourcePage from "../_shared/GenericResourcePage";
import StatusBadge from "../../components/status/StatusBadge";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";

export default function InvoiceList() {
  async function exportPdf(row) {
    const toastId = toast.loading("Creating invoice PDF...");

    try {
      await modules.pdf.invoice(row.id, "export");
      toast.success("Invoice PDF exported", { id: toastId });
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return (
    <GenericResourcePage
      title="Invoices"
      subtitle="Tax invoices with GST split, payments, dues, and overdue status"
      api={modules.invoices}
      disableInlineEdit
      searchKeys={["invoice_no", "company_name"]}
      fields={[
        {
          name: "customer_id",
          label: "Customer ID",
          type: "number",
          required: true,
        },
        {
          name: "invoice_date",
          label: "Invoice Date",
          required: true,
        },
        {
          name: "notes",
          label: "Notes",
        },
      ]}
      columns={[
        {
          key: "invoice_no",
          label: "Invoice",
          render: (row) => (
            <Link
              className="font-medium text-teal-700"
              to={`/invoices/${row.id}`}
            >
              {row.invoice_no}
            </Link>
          ),
        },
        {
          key: "company_name",
          label: "Customer/Service Items",

          render: (row) => {
            const services = row.service_items
              ? row.service_items.split("||")
              : [];

            return (
              <div>
                {/* CUSTOMER NAME */}
                <div className="font-medium text-slate-900">
                  {row.company_name}

                  {row.contact_person && (
                    <span className="ml-1 font-normal text-slate-500">
                      ({row.contact_person})
                    </span>
                  )}
                </div>

                {/* SERVICE ITEMS */}
                {services.length > 0 && (
                  <div className="mt-1 pl-4 space-y-0.5 text-slate-500">
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
          key: "invoice_date",
          label: "Date",
          render: (row) => date(row.invoice_date),
        },
        {
          key: "grand_total",
          label: "Total",
          render: (row) => money(row.grand_total),
        },
        {
          key: "balance_due",
          label: "Due",
          render: (row) => money(row.balance_due),
        },
        {
          key: "display_status",
          label: "Status",
          render: (row) => (
            <StatusBadge status={row.display_status || row.status} />
          ),
        },
      ]}
      getViewPath={(row) => `/invoices/${row.id}`}
      rowActions={(row) => (
        <div className="flex items-center gap-1">
          <Link
            title="Edit"
            to={`/invoices/${row.id}/edit`}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Pencil size={16} />
          </Link>

          <button
            title="Export PDF"
            onClick={() => exportPdf(row)}
            className="rounded p-1.5 text-teal-700 hover:bg-teal-50"
          >
            <FileDown size={16} />
          </button>
        </div>
      )}
      extraAction={
        <Link
          to="/invoices/new"
          className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white"
        >
          <FilePlus2 size={16} />
          New invoice
        </Link>
      }
    />
  );
}
