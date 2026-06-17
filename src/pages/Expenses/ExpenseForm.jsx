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
import { modules } from "../../utils/api";
import { getDefaultBankAccountId } from "../../utils/banking";

const today = new Date().toISOString().slice(0, 10);

const blankItem = {
  name: "",
  description: "",
  descriptionPoints: [],
  qty: 1,
  rate: 0,
  gst_rate: 0,
};

const getDefaultForm = () => ({
  expense_no: "",
  expense_date: today,
  contact_id: "",
  payment_mode: "bank_transfer",
  bank_account_id: "",
  reference_no: "",
  notes: "",
  paid_amount: 0,
  is_gst_enabled: true, // Add this to default form state
  items: [{ ...blankItem, name: "" }],
});

export default function ExpenseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(getDefaultForm());
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [gstRates, setGstRates] = useState([]);
  const [globalGstSetting, setGlobalGstSetting] = useState(true); // State to hold global GST setting
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch global GST setting for incoming documents
    modules.settings.get({ key: "gst_enabled_incoming" }).then(gstSetting => {
      setGlobalGstSetting(gstSetting?.value !== "0");
    });

    Promise.all([
      modules.contacts.listVendors(), // 0: vendorList
      modules.expenseCategories.list(),
      modules.bankAccounts.list(),
      modules.gst.list(),
      modules.contacts.listCustomers(), // 4: customerList
    ]).then(([vendorList, expenseCatList, bankList, gstList, customerList]) => { // Corrected destructuring
      const combined = [
        ...vendorList.map(v => ({ id: v.id, name: v.company_name, type: 'vendor', gstin: v.gstin })),
        ...customerList.map(c => ({ id: c.id, name: `${c.company_name} (Customer)`, type: 'customer', gstin: c.gstin }))
      ].sort((a, b) => a.name.localeCompare(b.name));
      setVendors(combined);
      setCategories(expenseCatList);
      setBankAccounts(bankList);
      setGstRates(gstList);
      // Set initial is_gst_enabled for new documents
      if (!isEdit) {
        setForm(prev => ({ ...prev, bank_account_id: getDefaultBankAccountId(bankList) }));
      }
    });
  }, [isEdit]);

  useEffect(() => {
    console.log("[TRACE] ExpenseForm - useEffect [id, vendors] triggered.");
    // Add vendors to dependency array to ensure it's loaded before setting form data
    if (!id || vendors.length === 0) {
      console.log("[TRACE] ExpenseForm - Skipping data load: No ID or vendors not loaded.");
      modules.numbering.nextExpenseNo().then(no => setForm(prev => ({ ...prev, expense_no: no })));
      return;
    }
    setIsLoading(true);
    console.log(`[TRACE] ExpenseForm - Fetching expense with ID: ${id}`);
    modules.expenses.get(id).then((response) => {
      console.log("[TRACE] Expense API Response items:", response.items);
      const selectedContactId = response.contact_id; // MUST CHANGE

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

      console.log("[TRACE] Expense Form items after mapping:", mappedItems);
      
      setForm({
        ...response,
        contact_id: selectedContactId, // Use contact_id
        is_gst_enabled: response.is_gst_enabled !== 0, // Use document's flag for existing docs
        items: mappedItems,
      });
    })
      .finally(() => setIsLoading(false));
  }, [id, vendors]); // Add vendors to dependency array

  // Derive selected vendor name for display in "Expense No (Internal)"
  const selectedContactName = vendors.find((v) => v.id === form.contact_id)?.name; // Use contact_id

  // Console logs for debugging (can be uncommented for detailed tracing)
  // console.log("[TRACE] ExpenseForm - Current Form State (render):", form); // This logs on every render, can be noisy

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.contact_id) return toast.error("Vendor is required"); // Use contact_id
    if (!form.items.length) return toast.error("At least one expense item is required");

    try {
      console.log(`[TRACE] Frontend Submit - Route ID: ${id}, Payload ID: ${form.id || id}`);
      const selectedParty = vendors.find(v => v.id === form.contact_id); // Find the selected party from the combined list
      const finalPayload = {
        ...form, 
        expense_no: form.expense_no, // Ensure expense_no is included
        contact_id: selectedParty?.id, // Directly use contact_id
        vendor: selectedParty?.name?.replace(' (Customer)', '') || form.vendor,
        is_gst_enabled: form.is_gst_enabled ? 1 : 0, // Include is_gst_enabled in payload
      };

      if (isEdit) {
        await modules.expenses.update({ ...finalPayload, id: id }); // Pass ID explicitly for update
        toast.success("Expense updated");
      } else {
        await modules.expenses.create(finalPayload);
        toast.success("Expense recorded");
      }
      navigate("/expenses");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleVendorAdded(newVendor) {
    const [vRows, custRows] = await Promise.all([modules.contacts.listVendors(), modules.contacts.listCustomers()]);
    const combined = [
      ...vRows.map(v => ({ id: v.id, name: v.company_name, type: 'vendor', gstin: v.gstin })),
      ...custRows.map(c => ({ id: c.id, name: `${c.company_name} (Customer)`, type: 'customer', gstin: c.gstin })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    setVendors(combined);
    setForm(prev => ({ ...prev, contact_id: newVendor.id })); // Auto-select the newly created vendor, use direct ID

    // Close the modal
    setShowVendorModal(false);
  }

  if (isLoading) return <ContentArea>Loading...</ContentArea>;

  return (
    <ContentArea>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={isEdit ? "Edit Expense" : "New Expense"}
          subtitle="Record business expenses and categorize them for reporting"
        />
        <div className="grid grid-cols-3 gap-2">
          <ShortcutKey keyName="ALT + V" label="Vendor" />
          <ShortcutKey keyName="ALT + I" label="Expense Date" />
          <ShortcutKey keyName="ALT + ENTER" label="Save" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="contact_id" className="block text-sm font-medium text-slate-700">Vendor / Party</label>
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
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)} {/* Use v.id for consistency */}
            </FormSelect>
          </div>
          <FormInput
            label="Expense Date"
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            required
          />
          <FormSelect
            label="Payment Mode"
            value={form.payment_mode}
            onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
          </FormSelect>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormInput
            label="Expense No (Internal)"
            value={form.expense_no + (selectedContactName ? ` (${selectedContactName})` : '')}
            name="expense_no" // Added name for potential shortcut key
            disabled
          />
          <FormInput // Kept this one, removed the duplicate below
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
            value={vendors.find(v => v.id === form.contact_id)?.gstin || ''}
            disabled // Assuming it's read-only on the form
            className="text-slate-600"
          />
        )}

        <div className="grid grid-cols-3 gap-4">
          <FormInput
            label="Initial Payment (₹)"
            type="number"
            value={form.paid_amount}
            onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
            placeholder="Amount paid now"
            className="font-bold text-teal-700"
          />
          <FormSelect
            label="Paid From Account"
            value={form.bank_account_id}
            onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}
          >
            <option value="">Select Bank Account</option>
            {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
          </FormSelect>
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
          label="Narration / Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Purpose of expense..."
          rows={3}
        />

        <div className="flex justify-end gap-3 pt-6 border-t">
          <button type="button" onClick={() => navigate("/expenses")} className="px-6 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" className="px-10 py-2 rounded-lg bg-teal-600 text-white font-bold shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95">
            {isEdit ? "Update Expense" : "Save Expense"}
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