import GenericResourcePage from "../_shared/GenericResourcePage";
import { modules } from "../../utils/api";
import { GST_TREATMENT_OPTIONS } from "../../utils/constants";

export default function CustomerList() {
  return (
    <GenericResourcePage
      title="Customers"
      subtitle="GST customers, contacts, payment terms, and outstanding context"
      api={modules.customers}
      searchKeys={["company_name", "contact_person", "gstin"]}
     fields={[
  { name: "company_name", label: "Company Name", required: true },
  { name: "contact_person", label: "Contact Person" },
  { name: "email", label: "Email" },
  { name: "phone", label: "Phone" },
  { name: "gstin", label: "GSTIN" },
  { name: "gst_treatment", label: "GST Treatment", type: "select", options: GST_TREATMENT_OPTIONS },
  { name: "address", label: "Address" },


  {
    name: "country",
    label: "Country",
    kind: "country",
  },
  {
    name: "state",
    label: "State",
    kind: "state",
    required: true,
  },
  {
    name: "city",
    label: "City",
    kind: "city",
  },

  { name: "payment_terms", label: "Payment Terms Days", type: "number" },
  { name: "opening_balance", label: "Opening Balance", type: "number" },
]}
      columns={[
        { key: "company_name", label: "Company" },
        { key: "contact_person", label: "Contact" },
        { key: "gstin", label: "GSTIN" },
        
        { key: "country", label: "Country" },
        { key: "state", label: "State" },
        { key: "city", label: "City" },
        { key: "address", label: "Address" },
      ]}
    />
  );
}
