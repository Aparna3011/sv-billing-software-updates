import GenericResourcePage from "../_shared/GenericResourcePage";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";

export default function PaymentList() {
  return (
    <GenericResourcePage
      title="Incoming Payments"
      subtitle="Customer receipts and invoice settlement history"
      api={modules.payments}
      extraAction={null}
      searchKeys={["payment_no", "invoice_no", "company_name"]}
      fields={[
        {
          name: "invoice_id",
          label: "Invoice ID",
          type: "number",
          required: true,
        },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "payment_date", label: "Payment Date", required: true },
        { name: "mode", label: "Mode" },
      ]}
      columns={[
        { key: "payment_no", label: "Payment" },
        { key: "invoice_no", label: "Invoice" },
        {
          key: "recurring_invoice_no",
          label: "Recurring Invoice",
          render: (row) => (
            <div className="font-medium text-slate-600">
              {row.recurring_invoice_no || "-"}
            </div>
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
                {/* COMPANY + CONTACT */}
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
          key: "payment_date",
          label: "Date",
          render: (row) => date(row.payment_date),
        },
        { key: "amount", label: "Amount", render: (row) => money(row.amount) },
        { key: "mode", label: "Mode" },
        { key: "bank_account_name", label: "Bank", render: (row) => row.bank_account_name || "-" },
      ]}
      // extraAction={<Link to="/payments/new" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white"><CreditCard size={16} /> Record payment</Link>}
    />
  );
}
