import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import CustomerSelect from "../../components/forms/CustomerSelect";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextarea";
import LineItemTable from "../../components/forms/LineItemTable";
import CustomerQuickAddModal from "../../components/modals/CustomerQuickAddModal";
import { modules } from "../../utils/api";

const today = new Date().toISOString().slice(0, 10);

const fiscalYearToken = (dateValue = today) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = month >= 4 ? year : year - 1;

  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
};

const previewNextDocumentNo = (
  rows = [],
  column,
  prefix,
  dateValue = today,
) => {
  const fyToken = fiscalYearToken(dateValue);
  const isQuotation = prefix === "SV/QU";
  const separator = isQuotation ? "/" : "-";
  const fyFormatted = isQuotation ? `${fyToken.slice(0, 2)}-${fyToken.slice(2)}` : fyToken;
  const documentPrefix = `${prefix}${separator}${fyFormatted}${separator}`;

  const current = rows
    .map((row) => String(row[column] || ""))
    .filter((documentNo) => documentNo.startsWith(documentPrefix))
    .map((documentNo) => Number(documentNo.split(separator).pop()))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);

  return `${documentPrefix}${String(current + 1).padStart(4, "0")}`;
};

const blankItem = {
  name: "",
  description: "",
  descriptionPoints: [],
  sac_code: " ",
  qty: 1,
  billing_type: "Service",
  rate: 0,
  gst_rate: 18,
};

const descriptionPointText = (point) =>
  typeof point === "string" ? point : point?.point_text || "";

const normalizeDescriptionPoints = (points = [], description = "") => {
  const normalized = points
    .map(descriptionPointText)
    .map((point) => point.trim())
    .filter((point) => point && point !== "[object Object]");

  if (normalized.length) return normalized;

  return String(description || "")
    .split("\n")
    .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
    .filter((line) => line && line !== "[object Object]");
};

const descriptionFromPoints = (points = []) =>
  normalizeDescriptionPoints(points)
    .map((point) => `- ${point}`)
    .join("\n");

const normalizeItem = (item = {}) => {
  const descriptionPoints = normalizeDescriptionPoints(
    item.descriptionPoints || [],
    item.description,
  );

  return {
    ...blankItem,
    ...item,
    description: descriptionFromPoints(descriptionPoints),
    descriptionPoints,
  };
};

const getItemsSubtotal = (items = []) =>
  items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0),
    0,
  );

const normalizeDiscountValue = (value, isPercent, subtotal) => {
  if (value === "") return "";

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return 0;

  if (isPercent) {
    return Math.min(Math.max(0, numericValue), 100);
  }

  return Math.max(0, numericValue);
};

const getDefaultForm = (docType) => ({
  customer_id: "",
  invoice_date: today,
  quotation_date: today,
  valid_until: "",
  due_date: "",
  status: docType === "quotation" ? "draft" : "pending",
  discount: 0,
  discount_is_percent: false,
  notes: "",
  items: [{ ...blankItem }],
  is_gst_enabled: true, // Add this to default form state
});

export default function DocumentForm({ type, recordId }) {
  const navigate = useNavigate();
  const apiModule =
    type === "quotation" ? modules.quotations : modules.invoices;
  const [customers, setCustomers] = useState([]);
  const [gstRates, setGstRates] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(() => getDefaultForm(type));
  const [isLoading, setIsLoading] = useState(false);
  const [generatedDocumentNo, setGeneratedDocumentNo] = useState("");
  const [globalGstSetting, setGlobalGstSetting] = useState(true); // State to hold global GST setting

  const [customerPopup, setCustomerPopup] = useState(false);
  useEffect(() => {
    function handleShortcut(event) {
      // ALT + C → CUSTOMER
      if (event.altKey && event.key === "c") {
        event.preventDefault();

        document.querySelector('select[name="customer"]')?.focus();
      }

      // ALT + I → INVOICE DATE
      if (event.altKey && event.key === "i") {
        event.preventDefault();

        document.querySelector('input[type="date"]')?.focus();
      }

      // ALT + D → DISCOUNT TYPE
      if (event.altKey && event.key === "d") {
        event.preventDefault();

        const selects = document.querySelectorAll("select");

        // DISCOUNT TYPE SELECT
        selects[2]?.focus();
      }

      // ALT + N → NOTES
      if (event.altKey && event.key === "n") {
        event.preventDefault();

        document.querySelector("textarea")?.focus();
      }

      // PREVENT NORMAL ENTER
      if (
        event.key === "Enter" &&
        !event.altKey &&
        event.target.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
      }

      // ALT + ENTER → SAVE
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();

        document.querySelector('button[type="submit"]')?.click();
      }
    }

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      modules.customers.list(),
      modules.services.list(),
      modules.gst.list(),
      modules.settings.get({ key: "gst_enabled_outgoing" }), // Fetch outgoing GST setting
    ])
      .then(([customerRows, serviceRows, gstRows, gstSetting]) => {
        setCustomers(customerRows);
        setServices(serviceRows);
        setGstRates(gstRows);
        setGlobalGstSetting(gstSetting?.value !== "0");
        if (!recordId) {
          setForm((prev) => ({ ...prev, is_gst_enabled: gstSetting?.value !== "0" }));
        }
      })
      .catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (!recordId) return;
    setIsLoading(true);
    apiModule
      .get(Number(recordId))
      .then((doc) => {
        if (!doc) throw new Error(`${type} not found`);
        setForm({
          ...getDefaultForm(type),
          ...doc,
          customer_id: doc.customer_id || "",
          discount: doc.discount ?? 0,
          discount_is_percent:
            doc.discount_is_percent === true ||
            Number(doc.discount_is_percent) === 1 ||
            String(doc.discount_is_percent ?? "").trim() === "1",
          notes: doc.notes || "",
          items: doc.items?.length
            ? doc.items.map(normalizeItem)
            : [{ ...blankItem }],
          quotation_date: doc.quotation_date || today,
          invoice_date: doc.invoice_date || today,
          valid_until: doc.valid_until || "",
          due_date: doc.due_date || "",
          is_gst_enabled: doc.is_gst_enabled !== 0, // Use document's flag for existing docs
          status: doc.status || (type === "quotation" ? "draft" : "pending"),
        });
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setIsLoading(false));
  }, [recordId, type]);

  useEffect(() => {
    setForm((prev) => {
      const subtotal = getItemsSubtotal(prev.items);
      const nextDiscount = normalizeDiscountValue(
        prev.discount,
        prev.discount_is_percent,
        subtotal,
      );

      if (Number(prev.discount || 0) === nextDiscount) return prev;

      return {
        ...prev,
        discount: nextDiscount,
      };
    });
  }, [form.items, form.discount_is_percent]);

  useEffect(() => {
    if (recordId) {
      setGeneratedDocumentNo("");
      return;
    }

    const documentDate =
      type === "quotation" ? form.quotation_date : form.invoice_date;
    const getNextNumber =
      type === "quotation"
        ? modules.numbering.nextQuotationNo
        : modules.numbering.nextInvoiceNo;
    const numberColumn = type === "quotation" ? "quotation_no" : "invoice_no";
    const numberPrefix = type === "quotation" ? "SV/QU" : "INV";
    let isCurrent = true;

    getNextNumber(documentDate || today)
      .then((nextNo) => {
        if (isCurrent) setGeneratedDocumentNo(nextNo || "");
      })
      .catch(() =>
        apiModule.list().then((rows) => {
          if (isCurrent) {
            setGeneratedDocumentNo(
              previewNextDocumentNo(
                rows,
                numberColumn,
                numberPrefix,
                documentDate || today,
              ),
            );
          }
        }),
      );

    return () => {
      isCurrent = false;
    };
  }, [recordId, type, form.quotation_date, form.invoice_date]);

  async function save(event, exportPdf = false) {
    event.preventDefault();
    try {
      const discount_is_percent = form.discount_is_percent ? 1 : 0;
      const validItems = form.items.filter((item) => {
        return (
          item.name?.trim() &&
          Number(item.qty || 0) > 0 &&
          Number(item.rate || 0) > 0
        );
      });

      if (!validItems.length) {
        toast.error("Please add at least one valid service");

        return;
      }

      const normalizedItems = validItems.map(normalizeItem);
      const subtotal = getItemsSubtotal(normalizedItems);
      const discount = Number(form.discount || 0);

      if (discount < 0) {
        toast.error("Discount cannot be negative");

        return;
      }

      if (form.discount_is_percent && discount > 100) {
        toast.error("Discount percentage cannot be greater than 100%");

        return;
      }

      if (!form.discount_is_percent && discount > subtotal) {
        toast.error("Discount amount cannot be greater than subtotal");

        return;
      }

      const payload = {
        ...form,

        items: normalizedItems,

        customer_id: Number(form.customer_id),

        discount: normalizeDiscountValue(
          form.discount,
          form.discount_is_percent,
          subtotal,
        ),

        discount_is_percent,
      };

      if (!recordId && generatedDocumentNo) {
        payload[type === "quotation" ? "quotation_no" : "invoice_no"] =
          generatedDocumentNo;
      }
      console.log(JSON.stringify(form.items, null, 2));
      const saved = recordId
        ? await apiModule.update({
            ...payload,
            id: Number(recordId),
            discount_is_percent,
          })
        : type === "quotation"
          ? await modules.quotations.create({ ...payload, discount_is_percent })
          : await modules.invoices.create({ ...payload, discount_is_percent });
      toast.success(
        recordId
          ? `${type === "quotation" ? "Quotation" : "Invoice"} updated`
          : `${type === "quotation" ? "Quotation" : "Invoice"} created`,
      );
      if (exportPdf) {
        const toastId = toast.loading("Creating PDF...");
        try {
          await modules.pdf[type](saved.id, "export");
          toast.success("PDF exported", { id: toastId });
        } catch (error) {
          toast.error(error.message, { id: toastId });
        }
      }
      navigate(
        type === "quotation"
          ? `/quotations/${saved.id}`
          : `/invoices/${saved.id}`,
      );
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (recordId && isLoading) {
    return (
      <ContentArea>
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-slate-500">
          Loading document...
        </div>
      </ContentArea>
    );
  }

  const pageTitle = recordId
    ? type === "quotation"
      ? "Edit Quotation"
      : "Edit Invoice"
    : type === "quotation"
      ? `New Quotation${generatedDocumentNo ? ` - ${generatedDocumentNo}` : ""}`
      : `New Invoice${generatedDocumentNo ? ` - ${generatedDocumentNo}` : ""}`;

  const subtotal = getItemsSubtotal(form.items);
  const discountMax = form.discount_is_percent ? 100 : subtotal;
  const updateDiscountType = (isPercent) => {
    setForm((prev) => ({
      ...prev,
      discount_is_percent: isPercent,
      discount: normalizeDiscountValue(
        prev.discount,
        isPercent,
        getItemsSubtotal(prev.items),
      ),
    }));
  };
  const updateDiscount = (value) => {
    setForm((prev) => ({
      ...prev,
      discount: normalizeDiscountValue(
        value,
        prev.discount_is_percent,
        getItemsSubtotal(prev.items),
      ),
    }));
  };

  const handleCustomerAdded = async (saved) => {
    const updatedCustomers = await modules.customers.list();
    setCustomers(updatedCustomers);
    setForm((prev) => ({
      ...prev,
      customer_id: saved.id,
    }));
    setCustomerPopup(false);
  };

  return (
    <ContentArea>
      <div className="mb-5  flex  flex-col-2  gap-4  lg:flex-row  lg:items-start  lg:justify-between">
        <PageHeader
          title={pageTitle}
          subtitle="Create GST-compliant software service billing documents"
        />
        <div className=" grid grid-cols-3 items-center justify-end  gap-4">
          <div className="rounded-md  border-slate-200  bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            <span className="font-bold text-teal-700">ALT + C</span> Customer
          </div>

          <div className="rounded-md  border-slate-200 bg-slate-50  px-3 py-1.5 text-xs font-medium text-slate-700">
            <span className="font-bold text-teal-700">ALT + I</span> Invoice
            Date
          </div>

          <div className="rounded-md  border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
            <span className="font-bold text-teal-700">ALT + D</span> Discount
          </div>

          <div
            className="
      rounded-md  border-slate-200 bg-slate-50   px-3  py-1.5 text-xs font-medium text-slate-700"
          >
            <span className="font-bold text-teal-700">ALT + N</span> Notes
          </div>

          <div
            className="
           rounded-md  border-slate-200 bg-slate-50   px-3  py-1.5 text-xs font-medium text-slate-700"
          >
            <span className="font-bold text-teal-700">ALT + ENTER</span> Save
          </div>
          <div
            className="
           rounded-md  border-slate-200 bg-slate-50   px-3  py-1.5 text-xs font-medium text-slate-700"
          >
            <span className="font-bold text-teal-700">Ctrl + Delete</span>{" "}
            Delete row
          </div>
          <div
            className="
           rounded-md  border-slate-200 bg-slate-50   px-3  py-1.5 text-xs font-medium text-slate-700"
          >
            <span className="font-bold text-teal-700">ENTER</span> new
            description point
          </div>
          <div
            className="
           rounded-md  border-slate-200 bg-slate-50   px-3  py-1.5 text-xs font-medium text-slate-700"
          >
            <span className="font-bold text-teal-700">BackSpace</span> remove
            description point
          </div>
        </div>
      </div>
      <form
        onSubmit={save}
        className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5"
      >
        <div className="grid grid-cols-3 gap-4">
          {/* CUSTOMER */}
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
              value={form.customer_id}
              onChange={(customer_id) =>
                setForm((prev) => ({
                  ...prev,
                  customer_id,
                }))
              }
            />
          </div>

          {/* Conditional Customer GSTIN field */}
          {/* INVOICE / QUOTATION DATE */}
          <FormInput
            label={type === "quotation" ? "Quotation Date" : "Invoice Date"}
            type="date"
            value={
              type === "quotation" ? form.quotation_date : form.invoice_date
            }
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                [type === "quotation" ? "quotation_date" : "invoice_date"]:
                  event.target.value,
              }))
            }
          />
          {form.is_gst_enabled && form.customer_id && (
            <FormInput
              label="Customer GSTIN"
              value={customers.find(c => c.id === form.customer_id)?.gstin || ''}
              disabled // Assuming it's read-only on the form
              className="text-slate-600"
            />
          )}

          {/* DUE DATE */}
          {type === "quotation" ? (
            <FormInput
              label="Valid Until"
              type="date"
              value={form.valid_until}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  valid_until: event.target.value,
                }))
              }
            />
          ) : (
            <FormInput
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  due_date: event.target.value,
                }))
              }
            />
          )}
        </div>
        {type === "quotation" ? (
          <div className="grid grid-cols-3 gap-4">
            <FormSelect
              label="Status"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </FormSelect>
            <FormSelect
              label="Discount type"
              value={form.discount_is_percent ? "percent" : "amount"}
              onChange={(event) =>
                updateDiscountType(event.target.value === "percent")
              }
            >
              <option value="amount">Amount (₹)</option>
              <option value="percent">Percent (%)</option>
            </FormSelect>
            <FormInput
              name="discount"
              label={form.discount_is_percent ? "Discount (%)" : "Discount (₹)"}
              type="number"
              min={0}
              max={discountMax}
              step={form.discount_is_percent ? "0.01" : "1"}
              value={form.discount}
              onChange={(event) => updateDiscount(event.target.value)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {["pending", "sent"].includes(form.status) ? (
              <FormSelect
                label="Status"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
              </FormSelect>
            ) : (
              <label>
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </span>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm capitalize text-slate-800">
                  {form.status || "—"}
                </div>
              </label>
            )}
            <FormSelect
              label="Discount type"
              value={form.discount_is_percent ? "percent" : "amount"}
              onChange={(event) =>
                updateDiscountType(event.target.value === "percent")
              }
            >
              <option value="amount">Amount (₹)</option>
              <option value="percent">Percent (%)</option>
            </FormSelect>
            <FormInput
              name="discount"
              label={form.discount_is_percent ? "Discount (%)" : "Discount (₹)"}
              type="number"
              min={0}
              max={discountMax}
              step={form.discount_is_percent ? "0.01" : "1"}
              value={form.discount}
              onChange={(event) => updateDiscount(event.target.value)}
            />
          </div>
        )}
        <LineItemTable
          items={form.items}
          services={services}
          discount={form.discount}
          discountIsPercent={form.discount_is_percent}
          gst={gstRates}
          isGstEnabled={form.is_gst_enabled} // Pass the flag
          onChange={(items) => setForm((prev) => ({ ...prev, items }))}
        />
        <FormTextarea
          label="Notes"
          value={form.notes}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, notes: event.target.value }))
          }
        />
        <div className="flex gap-3">
          <button
            type="submit"
            onClick={(event) => save(event, false)}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
          >
            {recordId ? "Update document" : "Save document"}
          </button>
          <button
            type="button"
            onClick={(event) => save(event, true)}
            className="rounded-md border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-700"
          >
            {recordId ? "Update and Export PDF" : "Save and Export PDF"}
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
