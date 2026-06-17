import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import CustomerSelect from "../../components/forms/CustomerSelect";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextarea";
import LineItemTable from "../../components/forms/LineItemTable";
import Modal from "../../components/modals/Modal";
import CustomerQuickAddModal from "../../components/modals/CustomerQuickAddModal";
import { modules } from "../../utils/api";
import { money } from "../../utils/format";

const generateNextInvoiceDate = (
  startDate,
  billingCycle,
  customBillingCycle,
) => {
  if (!startDate) return "";

  const date = new Date(startDate);

  switch (billingCycle) {
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;

    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;

    case "half_yearly":
      date.setMonth(date.getMonth() + 6);
      break;

    case "yearly":
      date.setMonth(date.getMonth() + 12);
      break;

    case "custom":
      if (!customBillingCycle) {
        return "";
      }

      date.setMonth(date.getMonth() + Number(customBillingCycle));
      break;

    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().split("T")[0];
};

const today = new Date().toISOString().slice(0, 10);

const blankItem = {
  service_id: "",
  name: "",
  description: "",
  descriptionPoints: [],
  sac_code: "",
  qty: 1,
  billing_type: "Service",
  rate: 0,
  gst_rate: 18,
};

const defaultForm = {
  contact_id: "",
  templates: [ // Use contact_id
    {
      recurring_invoice_no: "",

      billing_cycle: "monthly",

      custom_billing_cycle: "",

      start_date: today,

      next_invoice_date: generateNextInvoiceDate(today, "monthly", ""),

      status: "active",

      is_stopped: false,

      stopped_reason: "",

      auto_generate: true,

      discount: 0,

      discount_is_percent: false,

      notes: "",

      items: [{ ...blankItem }],
    },
  ],
};

const pointText = (point) =>
  typeof point === "string" ? point : point?.point_text || "";

const normalizeDescriptionPoints = (points = [], description = "") => {
  const normalized = (Array.isArray(points) ? points : [])
    .map(pointText)
    .map((point) => point.trim())
    .filter((point) => point && point !== "[object Object]");

  if (normalized.length) return normalized;

  return String(description || "")
    .split("\n")
    .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
    .filter((line) => line && line !== "[object Object]");
};

const normalizeItem = (item = {}) => ({
  ...blankItem,
  ...item,
  descriptionPoints: normalizeDescriptionPoints(
    item.descriptionPoints || [],
    item.description,
  ),
});

const roundAmt = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getItemsSubtotal = (items = []) =>
  items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0),
    0,
  );

const getItemsTotals = (
  items = [],
  discount = 0,
  isPercent = false,
  companyState = "",
  customerState = "",
  gstTreatment = "",
) => {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0),
    0,
  );
  const totalDiscount = isPercent
    ? roundAmt((subtotal * Number(discount || 0)) / 100)
    : Number(discount || 0);

  const isOverseas = String(gstTreatment || "").toLowerCase() === "overseas";
  const sameState =
    String(companyState || "")
      .trim()
      .toLowerCase() ===
    String(customerState || "")
      .trim()
      .toLowerCase();

  return items.reduce(
    (totals, item) => {
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || 0);
      const lineTotal = roundAmt(qty * rate);
      // Calculate proportional discount for this line to get correct taxable value
      const itemDiscount =
        subtotal > 0 ? (lineTotal / subtotal) * totalDiscount : 0;
      const taxableLineTotal = Math.max(0, lineTotal - itemDiscount);

      const gstRate = Number(item.gst_rate || 0);
      const itemTax =
        Number.isFinite(gstRate) && gstRate > 0
          ? roundAmt((taxableLineTotal * gstRate) / 100)
          : 0;

      let cgst = 0,
        sgst = 0,
        igst = 0;
      if (!isOverseas) {
        if (sameState) {
          cgst = roundAmt(itemTax / 2);
          sgst = roundAmt(itemTax - cgst);
        } else {
          igst = itemTax;
        }
      }

      return {
        subtotal: roundAmt(totals.subtotal + lineTotal),
        cgst_total: roundAmt(totals.cgst_total + cgst),
        sgst_total: roundAmt(totals.sgst_total + sgst),
        igst_total: roundAmt(totals.igst_total + igst),
        tax_total: roundAmt(totals.tax_total + itemTax),
        grand_total: roundAmt(totals.grand_total + taxableLineTotal + itemTax),
      };
    },
    {
      subtotal: 0,
      cgst_total: 0,
      sgst_total: 0,
      igst_total: 0,
      tax_total: 0,
      grand_total: 0,
    },
  );
};

const normalizeDiscountValue = (value, isPercent, subtotal) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const maxDiscount = isPercent ? 100 : Math.max(0, Number(subtotal || 0));

  return Math.min(Math.max(0, safeValue), maxDiscount);
};

export default function RecurringForm({ recordId }) {
  const [generatedRecurringNo, setGeneratedRecurringNo] = useState("");

  useEffect(() => {
    if (recordId) return;

    modules.numbering
      .nextRecurringInvoiceNo()
      .then(setGeneratedRecurringNo)
      .catch(console.error);
  }, [recordId]);

  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [gstRates, setGstRates] = useState([]);
  const [form, setForm] = useState(defaultForm);
  useEffect(() => {
    if (!generatedRecurringNo || recordId) return;

    setForm((prev) => ({
      ...prev,

      templates: prev.templates.map((template) => ({
        ...template,

        recurring_invoice_no:
          template.recurring_invoice_no || generatedRecurringNo,
      })),
    }));
  }, [generatedRecurringNo, recordId]);

  const addTemplate = () => {
    updateForm("templates", [
      ...form.templates,
      {
        recurring_invoice_no: "",

        billing_cycle: "monthly",

        custom_billing_cycle: "",

        start_date: today,

        next_invoice_date: generateNextInvoiceDate(today, "monthly", ""),

        status: "active",

        is_stopped: false,

        stopped_reason: "",

        auto_generate: true,

        discount: 0,

        discount_is_percent: false,

        notes: "",

        items: [{ ...blankItem }],
      },
    ]);
    toast.success("Billing plan added");
  };
  const [isLoading, setIsLoading] = useState(Boolean(recordId));

  const [customerPopup, setCustomerPopup] = useState(false);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const loadCustomerInvoices = async (customerId) => {
    if (!customerId) {
      setCustomerInvoices([]); // Use contactId

      return;
    }

    const response = await modules.invoices.listByCustomer(customerId);

    setCustomerInvoices(response || []);
  };
  useEffect(() => {
    Promise.all([
      modules.customers.list(),
      modules.services.list(),
      modules.gst.list(),
      modules.company.get(),
    ])
      .then(([customerRows, serviceRows, gstRows, companySettings]) => {
        setCustomers(customerRows);
        setServices(serviceRows);
        setGstRates(gstRows);
        setSettings(companySettings);
      })
      .catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (!recordId) return;

    setIsLoading(true);
    modules.recurring
      .get(Number(recordId))
      .then((recurring) => {
        if (!recurring) throw new Error("Recurring record not found");

        setForm({
          contact_id: recurring.contact_id || "",
          invoice_id: recurring.invoice_id || "",
          templates:
            (recurring.templates || [])
              .filter((t) => t.is_active === 1)
              .map((template) => ({
                id: template.id,

                recurring_invoice_no: template.recurring_invoice_no || "",

                billing_cycle: template.billing_cycle || "monthly",

                custom_billing_cycle: template.custom_billing_cycle || "",

                start_date: template.start_date || today,

                // Recalculate on load if history is corrupted (Start === Next)
                next_invoice_date: (template.next_invoice_date === template.start_date)
                  ? generateNextInvoiceDate(template.start_date, template.billing_cycle, template.custom_billing_cycle)
                  : template.next_invoice_date || "",

                status: template.status || "active",

                is_stopped: Boolean(template.is_stopped),

                stopped_reason: template.stopped_reason || "",

                auto_generate: Boolean(template.auto_generate),

                discount: template.discount || 0,

                discount_is_percent: Boolean(template.discount_is_percent),

                notes: template.notes || "",

                items: template.items?.map(normalizeItem) || [{ ...blankItem }],
              })) || [],
        });

        loadCustomerInvoices(recurring.contact_id);
        loadCustomerInvoices(recurring.contact_id); // Use contact_id

        const invoice = recurring.invoice_id
          ? {
              id: recurring.invoice_id,
              id: recurring.invoice_id, // Use contact_id
              invoice_no: recurring.invoice_no,
              invoice_date: recurring.invoice_date,
              status: recurring.invoice_status,
              grand_total: recurring.invoice_total,
              items: recurring.invoice_items || [],
            }
          : null;

        setSelectedInvoice(invoice);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setIsLoading(false));
  }, [recordId]);
  useEffect(() => {
    if (form.contact_id) { // Use contact_id
      loadCustomerInvoices(form.contact_id);
    }
  }, [form.contact_id]);
   // Use contact_id

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => Number(c.id) === Number(form.contact_id));
  }, [customers, form.contact_id]);

  const [settings, setSettings] = useState(null);
  // Company GST state
  const companyState = "Maharashtra";

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const updateTemplate = (index, field, value) => {
    setForm((prev) => {
      const templates = [...prev.templates];

      templates[index] = {
        ...templates[index],
        [field]: value,
      };

      return {
        ...prev,
        templates,
      };
    });
  };

  const updateTemplateItems = (templateIndex, items) => {
    setForm((prev) => {
      const templates = [...prev.templates];

      templates[templateIndex] = {
        ...templates[templateIndex],
        items,
      };

      return {
        ...prev,
        templates,
      };
    });
  };

  const handleCustomerAdded = async (saved) => {
    const updatedCustomers = await modules.customers.list();
    setCustomers(updatedCustomers);
    updateForm("contact_id", saved.id);
    updateForm("contact_id", saved.id); // Use contact_id
    await loadCustomerInvoices(saved.id);
    setCustomerPopup(false);
  };

  async function save(event) {
    event.preventDefault();

    try { // Use contact_id
      if (!form.contact_id) { toast.error("Please select a customer");
        return;
      }

      // Filter out invalid service rows before processing totals or payload
      const validatedTemplates = form.templates.map(t => ({
        ...t,
        items: (t.items || []).filter(item => 
          (item.name?.trim() || item.service_id) && 
          Number(item.rate || 0) > 0 && 
          Number(item.qty || 0) > 0
        )
      }));

      for (const template of validatedTemplates) {
        if (!template.items.length) {
          toast.error("Please add at least one valid service.");
          return;
        }

        if (!template.next_invoice_date) {
          toast.error("Each template must have next invoice date");

          return;
        }
      }

      const payload = {
        contact_id: Number(form.contact_id), // Use contact_id
        invoice_id: form.invoice_id ? Number(form.invoice_id) : null,
        templates: validatedTemplates.map((template, index) => {
          const totals = getItemsTotals(
            template.items,
            template.discount,
            template.discount_is_percent,
            companyState,
            selectedCustomer?.state,
            selectedCustomer?.gst_treatment,
          );

          return {
            id: template.id,

            recurring_invoice_no:
              template.recurring_invoice_no || `${generatedRecurringNo}`,

            billing_cycle: template.billing_cycle,

            custom_billing_cycle:
              template.billing_cycle === "custom"
                ? Number(template.custom_billing_cycle || 1)
                : null,

            start_date: template.start_date,

            next_invoice_date: template.next_invoice_date,

            status: template.status || "active",

            is_stopped: Boolean(template.is_stopped),

            stopped_reason: String(template.stopped_reason || "").trim(),

            auto_generate: Boolean(template.auto_generate),

            notes: String(template.notes || "").trim(),

            discount: Number(template.discount || 0),

            discount_is_percent: template.discount_is_percent ? 1 : 0,

            subtotal: totals.subtotal,

            cgst_total: totals.cgst_total,

            sgst_total: totals.sgst_total,

            igst_total: totals.igst_total,

            tax_total: totals.tax_total,

            grand_total: totals.grand_total,

            items: template.items.map((item) => ({
              service_id: item.service_id ? Number(item.service_id) : null,

              name: String(item.name || "").trim(),

              description: String(item.description || "").trim(),

              sac_code: item.sac_code || "",

              billing_type: item.billing_type || "Service",

              qty: Number(item.qty || 1),

              rate: Number(item.rate || 0),

              gst_rate: Number(item.gst_rate || 18),
            })),
          };
        }),
      };

      const saved = recordId
        ? await modules.recurring.update({ ...payload, id: Number(recordId) })
        : await modules.recurring.create(payload);

      toast.success(
        recordId ? "Recurring billing updated" : "Recurring billing created",
      );
      navigate(`/recurring/${saved?.id || recordId}`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (isLoading) {
    return (
      <ContentArea>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-slate-500">
          Loading recurring billing...
        </div>
      </ContentArea>
    );
  }
  const pageTitle = recordId
    ? "Edit Recurring Billing"
    : `New Recurring Billing${
        generatedRecurringNo ? ` - ${generatedRecurringNo}` : ""
      }`;

  return (
    <ContentArea>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={pageTitle}
          subtitle="Create subscription cycles with invoice-grade billing workflows"
        />
      </div>

      <form
        onSubmit={save}
        className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5"
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Customer
              </span>

              <button
                type="button"
                onClick={() => setCustomerPopup(true)}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                + Add New Customer
              </button>
            </div>

            <CustomerSelect
              name="customer"
              customers={customers}
              value={form.contact_id}
              onChange={async (customerId) => {
                updateForm("contact_id", customerId);

                await loadCustomerInvoices(customerId);
              }}
             />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Invoice
            </label>

            <select
              value={form.invoice_id || ""}
              onChange={(e) => {
                const invoiceId = Number(e.target.value);

                updateForm("invoice_id", invoiceId);

                const invoice = customerInvoices.find(
                  (inv) => inv.id === invoiceId,
                );

                setSelectedInvoice(invoice || null);
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-500"
            >
              <option value="">Select Invoice</option>

              {customerInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_no}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedInvoice && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Invoice No
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selectedInvoice.invoice_no}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Invoice Date
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selectedInvoice.invoice_date}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Status
                </p>

                <p className="mt-1 text-sm font-semibold capitalize text-slate-800">
                  {selectedInvoice.status}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Total
                </p>

                <p className="mt-1 text-sm font-semibold text-teal-700">
                  {money(selectedInvoice.grand_total || 0)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Services
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedInvoice.items?.map((item, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={addTemplate}
          className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-600 hover:border-teal-500 hover:text-teal-600"
        >
          + Add Another BIlling Plan
        </button>
        {form.templates.map((template, index) => {
          const totals = getItemsTotals(
            template.items,
            template.discount,
            template.discount_is_percent,
            companyState,
            selectedCustomer?.state,
            selectedCustomer?.gst_treatment,
          );

          return (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  Plan {index + 1}
                  {template.id && (
                    <span className="text-sm text-slate-500 ml-2">
                      (ID: {template.id})
                    </span>
                  )}
                </h3>

                {form.templates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        templates: prev.templates.filter((_, i) => i !== index),
                      }));
                    }}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <FormSelect
                  label="Billing Cycle"
                  value={template.billing_cycle}
                  onChange={(e) => {
                    const billingCycle = e.target.value;

                    updateTemplate(index, "billing_cycle", billingCycle);

                    if (billingCycle !== "custom") {
                      const nextDate = generateNextInvoiceDate(
                        template.start_date,
                        billingCycle,
                        template.custom_billing_cycle,
                      );

                      updateTemplate(index, "next_invoice_date", nextDate);
                    } else {
                      updateTemplate(index, "next_invoice_date", "");
                    }
                  }}
                >
                  <option value="monthly">Monthly</option>

                  <option value="quarterly">Quarterly</option>

                  <option value="half_yearly">Half Yearly</option>

                  <option value="yearly">Yearly</option>

                  <option value="custom">Custom</option>
                </FormSelect>

                {template.billing_cycle === "custom" && (
                  <FormInput
                    label="Custom Billing Cycle"
                    type="number"
                    placeholder="Months"
                    min={1}
                    value={template.custom_billing_cycle}
                    onChange={(e) => {
                      const customCycle = e.target.value;

                      updateTemplate(
                        index,
                        "custom_billing_cycle",
                        customCycle,
                      );

                      const nextDate = generateNextInvoiceDate(
                        template.start_date,
                        template.billing_cycle,
                        customCycle,
                      );

                      updateTemplate(index, "next_invoice_date", nextDate);
                    }}
                  />
                )}

                <FormInput
                  label="Start Date"
                  type="date"
                  value={template.start_date || ""}
                  onChange={(e) => {
                    const startDate = e.target.value;

                    const nextDate = generateNextInvoiceDate(
                      startDate,
                      template.billing_cycle,
                      template.custom_billing_cycle,
                    );

                    updateTemplate(index, "start_date", startDate);

                    updateTemplate(index, "next_invoice_date", nextDate);
                  }}
                />

                <FormInput
                  label="Next Invoice Date"
                  type="date"
                  value={template.next_invoice_date || ""}
                  readOnly
                  className="bg-slate-50 cursor-not-allowed"
                />

                <FormSelect
                  label="Status"
                  value={template.status}
                  onChange={(e) =>
                    updateTemplate(index, "status", e.target.value)
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>

                  <option value="paused">Paused</option>

                  <option value="completed">Completed</option>

                  <option value="cancelled">Cancelled</option>
                </FormSelect>

                <label className="flex items-center gap-2 pt-7">
                  <input
                    type="checkbox"
                    checked={Boolean(template.is_stopped)}
                    onChange={(e) =>
                      updateTemplate(index, "is_stopped", e.target.checked)
                    }
                  />

                  <span className="text-sm font-medium text-slate-700">
                    Stop this billing plan
                  </span>
                </label>
                {template.is_stopped && (
                  <FormTextarea
                    label="Stop Reason"
                    value={template.stopped_reason}
                    onChange={(e) =>
                      updateTemplate(index, "stopped_reason", e.target.value)
                    }
                  />
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FormSelect
                  label="Discount Type"
                  value={template.discount_is_percent ? "percent" : "amount"}
                  onChange={(e) =>
                    updateTemplate(
                      index,
                      "discount_is_percent",
                      e.target.value === "percent",
                    )
                  }
                >
                  <option value="amount">Amount (₹)</option>

                  <option value="percent">Percent (%)</option>
                </FormSelect>

                <FormInput
                  label={
                    template.discount_is_percent
                      ? "Discount (%)"
                      : "Discount (₹)"
                  }
                  type="number"
                  min={0}
                  value={template.discount ?? ""}
                  onChange={(e) =>
                    updateTemplate(index, "discount", e.target.value)
                  }
                />

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Auto Generate
                  </span>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(template.auto_generate)}
                      onChange={(e) =>
                        updateTemplate(index, "auto_generate", e.target.checked)
                      }
                    />

                    <span className="text-sm text-slate-600">
                      Enable automatic invoices
                    </span>
                  </div>
                </label>
              </div>

              <LineItemTable
                items={template.items}
                services={services}
                gst={gstRates}
                discount={template.discount}
                discountIsPercent={template.discount_is_percent}
                onChange={(items) => updateTemplateItems(index, items)}
              />

              <FormTextarea
                label="Notes"
                value={template.notes}
                onChange={(e) => updateTemplate(index, "notes", e.target.value)}
              />

              {/* <div className="flex justify-end">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 text-sm font-semibold text-slate-700">
                    Template Totals
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>

                      <strong>{money(totals.subtotal)}</strong>
                    </div>

                    <div className="flex justify-between">
                      <span>Tax</span>

                      <strong>{money(totals.tax_total)}</strong>
                    </div>

                    <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-semibold">
                      <span>Total</span>

                      <strong>{money(totals.grand_total)}</strong>
                    </div>
                  </div>
                </div>
              </div> */}
            </div>
          );
        })}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate(recordId ? `/recurring/${recordId}` : "/recurring")
            }
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
          >
            {recordId ? "Update Recurring" : "Save Recurring"}
          </button>
        </div>
      </form>

      <CustomerQuickAddModal
        isOpen={customerPopup}
        onClose={() => setCustomerPopup(false)}
        onSuccess={handleCustomerAdded}
      />
    </ContentArea>
  );
}
