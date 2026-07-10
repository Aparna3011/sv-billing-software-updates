import { Link } from "react-router-dom";
import { FilePlus2, Pencil } from "lucide-react";
import GenericResourcePage from "../_shared/GenericResourcePage";
import StatusBadge from "../../components/status/StatusBadge";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";

export default function QuotationList() {
  return (
    <GenericResourcePage
      title="Quotations"
      subtitle="Proposals for software services and consulting engagements"
      api={modules.quotations}
      disableInlineEdit
      fields={[
        {
          name: "contact_id",
          label: "Customer ID",
          type: "number",
          required: true,
        },
        { name: "quotation_date", label: "Quotation Date", required: true },
        { name: "valid_until", label: "Valid Until" },
        { name: "status", label: "Status" },
        { name: "notes", label: "Notes" },
      ]}
      columns={[
        {
          key: "quotation_no",
          label: "Quotation",
          render: (row) => (
            <Link
              className="font-medium text-teal-700"
              to={`/quotations/${row.id}`}
            >
              {row.quotation_no}
            </Link>
          ),
        },
        {
          key: "company_name",
          label: "Customer",

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
                  <div className="mt-1 pl-4 text-sm text-slate-500">
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
          key: "quotation_date",
          label: "Date",
          render: (row) => date(row.quotation_date),
        },
        {
          key: "grand_total",
          label: "Total",
          render: (row) => money(row.grand_total),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusBadge status={row.status} />,
        },
      ]}
      getViewPath={(row) => `/quotations/${row.id}`}
      rowActions={(row) => (
        <div className="flex items-center gap-1">
          {String(row.status || "").toLowerCase() !== "converted" && (
            <Link
              title="Edit"
              to={`/quotations/${row.id}/edit`}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <Pencil size={16} />
            </Link>
          )}
        </div>
      )}
      canDeleteRow={() => true}
      extraAction={
        <Link
          to="/quotations/new"
          className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white"
        >
          <FilePlus2 size={16} /> New quotation
        </Link>
      }
    />
  );
}
