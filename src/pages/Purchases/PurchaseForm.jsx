import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextarea";
import LineItemTable from "../../components/forms/LineItemTable";
import VendorQuickAddModal from "../../components/modals/VendorQuickAddModal";
import { getDefaultBankAccountId } from "../../utils/banking"; // Import getDefaultBankAccountId
import { modules } from "../../utils/api";

const today = new Date().toISOString().slice(0, 10);

const blankItem = {
  name: "",
  description: "",
  sac_code: "",
  qty: 1,
  billing_type: "Service",
  rate: 0,
  gst_rate: 18,
};

const getDefaultForm = () => ({
  contact_id: "", // MUST CHANGE
  bill_no: "",
  vendor_bill_no: "",
  bill_date: today,
  due_date: "",
  paid_amount: 0,
  payment_mode: "bank_transfer", // Default payment mode
  bank_account_id: "", // Default bank account ID
  notes: "",
  is_gst_enabled: true, // Add this to default form state
  items: [{ ...blankItem }],
});

export default function PurchaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [gstRates, setGstRates] = useState([]);
  const [globalGstSetting, setGlobalGstSetting] = useState(true); // State to hold global GST setting
  const [bankAccounts, setBankAccounts] = useState([]); // State for bank accounts
  const [form, setForm] = useState(getDefaultForm());
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch global GST setting for incoming documents
    modules.settings.get({ key: "gst_enabled_incoming" }).then(gstSetting => {
      setGlobalGstSetting(gstSetting?.value !== "0");
    });

    Promise.all([
      modules.vendors.list(), // 0: vendorContacts
      modules.customers.list(), // 1: customerContacts
      modules.gst.list(), // 2: gstList
      modules.bankAccounts.list(), // 3: bankList
    ]).then(([vendorContacts, customerContacts, gstList, bankList]) => { // Corrected destructuring
      const combined = [
        ...vendorContacts.map(v => ({ id: v.id, name: v.company_name, type: 'vendor', gstin: v.gstin })),
        ...customerContacts.map(c => ({ id: c.id, name: `${c.company_name} (Customer)`, type: 'customer', gstin: c.gstin }))
      ].sort((a, b) => a.name.localeCompare(b.name)); // Sort by name

      setVendors(combined);
      setGstRates(gstList);
      setBankAccounts(bankList); // Set bank accounts
      // Set initial is_gst_enabled for new documents
      if (!isEdit) {
        setForm(prev => ({ ...prev, bank_account_id: getDefaultBankAccountId(bankList) })); // Set default bank account
      }
    });
  }, [isEdit]); // Add isEdit to dependency array

  useEffect(() => {
    // Add vendors to dependency array to ensure it's loaded before setting form data
    if (!id || vendors.length === 0) {
      modules.numbering.nextBillNo().then(no => setForm(prev => ({ ...prev, bill_no: no })));
      return;
    }
    setIsLoading(true);
    modules.purchases.get(id).then((response) => {
      console.log("[TRACE] Purchase API Response items:", response.items);
      // Removed selectedVendorId logic as contact_id is deprecated

      const selectedContactId = response.contact_id; // Directly use contact_id
      
      const mappedItems = response.items?.length
        ? response.items.map((item) => ({
            ...blankItem,
            ...item,
            descriptionPoints: Array.isArray(item.descriptionPoints)
              ? item.descriptionPoints
              : (item.description || "")
                  .split(/\r?\n/)
                  .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
                  .filter(Boolean),
          }))
        : [{ ...blankItem }];

      console.log("[TRACE] Purchase Form items after mapping:", mappedItems);
      
      setForm({
        ...response,
        contact_id: selectedContactId, // Use contact_id
        is_gst_enabled: response.is_gst_enabled !== 0, // Use document's flag for existing docs
        items: mappedItems,
      });
    })
      .finally(() => setIsLoading(false));
  }, [id, vendors]); // Add vendors to dependency array

  // Derive selected vendor name for display in "Bill No (Internal)"
  const selectedContactName = vendors.find((v) => v.id === form.contact_id)?.name; // Use contact_id

  // Console logs for debugging
  console.log("[TRACE] PurchaseForm - Form State:", form);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.contact_id) return toast.error("Please select a vendor"); // Use contact_id

    try {
      console.log(`[TRACE] Purchase Frontend Submit - Route ID: ${id}, Payload ID: ${form.id || id}`);
      const selectedParty = vendors.find(v => v.id === form.contact_id); // Find the selected party from the combined list
      const payload = { 
        ...form, 
        bill_no: form.bill_no,
        vendor: selectedParty?.name?.replace(' (Customer)', '') || form.vendor,
        contact_id: selectedParty?.id, // Directly use contact_id
        vendor: selectedParty?.name?.replace(' (Customer)', '') || form.vendor, // Keep vendor text for snapshot
        is_gst_enabled: form.is_gst_enabled ? 1 : 0, // Include is_gst_enabled in payload
      };

      if (isEdit) {
        await modules.purchases.update({ ...payload, id }); // Pass contact_id in payload
        toast.success("Purchase updated");
      } else {
        await modules.purchases.create(payload);
        toast.success("Purchase recorded");
      }
      navigate("/purchases");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleVendorAdded(newVendor) {
    const [vRows, custRows] = await Promise.all([modules.vendors.list(), modules.customers.list()]);
    const combined = [
      ...vRows.map(v => ({ id: v.id, name: v.company_name, type: 'vendor', gstin: v.gstin })),
      ...custRows.map(c => ({ id: c.id, name: `${c.company_name} (Customer)`, type: 'customer', gstin: c.gstin }))
    ].sort((a, b) => a.name.localeCompare(b.name)); // Sort by name

    setVendors(combined);
    setForm(prev => ({ ...prev, contact_id: newVendor.id })); // Auto-select the newly created vendor, use direct ID

    // Close the modal
    setShowVendorModal(false);
  }

  if (isLoading) return <ContentArea>Loading...</ContentArea>;

  return (
    <ContentArea>
        <PageHeader
          title={isEdit ? "Edit Purchase Bill" : "New Purchase Bill"}
          subtitle="Record vendor invoices and map them to expense categories"
        />
        <div className="grid grid-cols-3 gap-2">
          <ShortcutKey keyName="ALT + V" label="Vendor" />
          <ShortcutKey keyName="ALT + I" label="Bill Date" />
          <ShortcutKey keyName="ALT + ENTER" label="Save" />
        </div>
      <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="contact_id" className="block text-sm font-medium text-slate-700">Vendor</label>
              <button
                type="button"
                onClick={() => setShowVendorModal(true)}
                className="text-teal-600 hover:text-teal-800 text-xs font-medium"
              >
                + Add New Vendor
              </button>
            </div>
            <FormSelect
              id="contact_id"
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })} // Use contact_id
              required
            >
              <option value="">Select Vendor</option>
              {vendors.map((v) => ( // Use v.id for consistency
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </FormSelect>
          </div>
          <FormInput
            label="Bill Date"
            type="date"
            value={form.bill_date}
            onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
            required
          />
          <FormInput
            label="Due Date"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormInput
            label="Bill No (Internal)"
            // Use selectedContactName
            value={form.bill_no + (selectedContactName ? ` (${selectedContactName})` : '')}
            disabled
          />
          <FormInput
            label="Vendor Bill No"
            value={form.vendor_bill_no}
            onChange={(e) => setForm({ ...form, vendor_bill_no: e.target.value })}
            placeholder="e.g. INV/24/001"
          />
          <FormInput
            label="Reference No"
            value={form.reference_no}
            onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
            placeholder="Voucher or Transaction ID"
          />
        </div>

        {form.is_gst_enabled && form.contact_id && (
          <FormInput
            // Removed duplicate label and value for contact_id
            label="Vendor GSTIN" // Use contact_id
            value={vendors.find(v => v.id === form.contact_id)?.gstin || ''}
            disabled // Assuming it's read-only on the form
            className="text-slate-600"
          />
        )}
        {form.paid_amount > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Payment Mode"
              value={form.payment_mode}
              onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
            </FormSelect>
            <FormSelect
              label="Paid From Account"
              value={form.bank_account_id}
              onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}
              required={form.payment_mode !== "cash"} // Make required if paid_amount > 0 and mode is not cash
            >
              <option value="">Select Bank Account</option>
              {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </FormSelect>
          </div>
        )}

        {/* Original Initial Payment field, now potentially moved or adjusted */}
        <div className="grid grid-cols-1 gap-4">
          <FormInput
            label="Initial Payment (₹)"
            type="number"
            value={form.paid_amount}
            onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
            placeholder="Amount paid now"
            className="font-bold text-teal-700"
          />
        </div>

        <LineItemTable
          items={form.items}
          services={categories.map(c => ({ id: c.id, name: c.name, descriptionPoints: (c.description || "").split(/\r?\n/).filter(Boolean), rate: 0, gst_rate: 18 }))}
          gst={gstRates}
          serviceLabel="Category"
          isGstEnabled={form.is_gst_enabled} // Pass the flag
          onChange={(items) => setForm({ ...form, items })}
        />

        <FormTextarea
          label="Internal Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-teal-800 transition-all active:scale-95"
          >
            {isEdit ? "Update Purchase" : "Save Purchase"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/purchases")}
            className="rounded-md border border-slate-300 px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>

      <VendorQuickAddModal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSuccess={handleVendorAdded}
      />
    </ContentArea>
  );
}

function ShortcutKey({ keyName, label }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 border border-slate-200">
      <span className="text-teal-700">{keyName}</span> {label}
    </div>
  );
}
