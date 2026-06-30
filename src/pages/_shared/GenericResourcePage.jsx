import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "@utils/notify";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import TableFilters from "../../components/tables/TableFilters";
import Modal from "../../components/modals/Modal";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextarea";
import { Country, State, City } from "country-state-city";
import { validators } from "../../utils/validators";

export default function GenericResourcePage({
  title,
  subtitle,
  api,
  fields,
  columns,
  searchKeys = [],
  extraAction,
  getViewPath,
  rowActions,
  loadOptions,
  beforeFilters,
  disableInlineEdit = false,
  canEditRow,
  editPath,
  canDeleteRow,
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [options, setOptions] = useState({});
  const schema = useMemo(() => {
    const shape = {};

    fields.forEach((field) => {
      let validator = field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional();

      if (field.name === "email") {
        validator = validator.refine(
          (value) => !value || validators.email(value),
          { message: "Invalid email address" },
        );
      }

      if (field.name === "phone") {
        validator = validator.refine(
          (value) => !value || validators.mobile(value),
          { message: "Invalid mobile number" },
        );
      }

      if (field.name === "gstin") {
        validator = validator.refine(
          (value) => !value || validators.gstin(value),
          { message: "Invalid GSTIN" },
        );
      }

      if (field.name === "pan") {
        validator = validator.refine(
          (value) => !value || validators.pan(value),
          { message: "Invalid PAN" },
        );
      }

      if (field.name === "pincode") {
        validator = validator.refine(
          (value) => !value || validators.pincode(value),
          { message: "Invalid Pincode" },
        );
      }

      shape[field.name] = validator;
    });

    return z.object(shape).passthrough();
  }, [fields, editingRow]);

  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityValue, setCityValue] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  async function load() {
    try {
      setRows(await api.list());
    } catch (error) {
      toast.error(error.message);
    }
  }

  useEffect(() => {
    load();
    if (loadOptions)
      loadOptions()
        .then(setOptions)
        .catch((error) => toast.error(error.message));
  }, []);

  const filtered = rows.filter(
    (row) =>
      !query ||
      searchKeys.some((key) =>
        String(row[key] || "")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
  );
  const tableColumns = [
    ...columns.map((col) => ({
      accessorKey: col.key,
      header: col.label,
      cell: (info) =>
        col.render ? col.render(info.row.original) : info.getValue(),
    })),
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex items-center justify-end gap-1 action-cell">
            <button
              title="View"
              onClick={() => view(row)}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <Eye size={16} />
            </button>
            {rowActions?.(row)}
            {(editPath || !disableInlineEdit) &&
              api.update &&
              (canEditRow?.(row) ?? true) && (
                <button
                  title="Edit"
                  onClick={() =>
                    editPath ? navigate(editPath(row)) : startEdit(row)
                  }
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil size={16} />
                </button>
              )}
            {api.delete && (canDeleteRow?.(row) ?? true) && (
              <button
                title="Delete"
                onClick={() => remove(row)}
                className="rounded p-1.5 text-red-500 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  function startCreate() {
    setEditingRow(null);
    reset(defaultValues());
    setCountryCode("");
    setStateCode("");
    setCityValue("");
    setOpen(true);
  }

  function startEdit(row) {
    setEditingRow(row);

    reset(defaultValues(row));

    // COUNTRY
    const selectedCountry = Country.getAllCountries().find(
      (c) => c.name === row.country,
    );

    const countryIso = selectedCountry?.isoCode || "";

    setCountryCode(countryIso);

    // STATE
    const selectedState = State.getStatesOfCountry(countryIso).find(
      (s) => s.name === row.state,
    );

    const stateIso = selectedState?.isoCode || "";

    setStateCode(stateIso);

    // CITY
    setCityValue(row.city || "");

    setOpen(true);
  }

  function view(row) {
    if (getViewPath) navigate(getViewPath(row));
    else setViewRow(row);
  }

  function defaultValues(row = {}) {
    return Object.fromEntries(
      fields.map((field) => {
        const fallback =
          typeof field.defaultValue === "function"
            ? field.defaultValue()
            : field.defaultValue;
        return [field.name, row[field.name] ?? fallback ?? ""];
      }),
    );
  }

  async function save(values) {
    try {
      const clean = Object.fromEntries(
        fields.map((field) => {
          let value = values[field.name] || "";

          return [
            field.name,
            field.type === "number" ? Number(value || 0) : value,
          ];
        }),
      );

      // CREATE DESCRIPTION POINTS
      if (clean.description) {
        clean.descriptionPoints = clean.description
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      }
      if (editingRow) await api.update({ id: editingRow.id, ...clean });
      else await api.create(clean);
      toast.success(editingRow ? `${title} updated` : `${title} saved`);
      setOpen(false);
      setEditingRow(null);
      setCountryCode("");
      setStateCode("");
      setCityValue("");
      reset();
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function remove(row) {
    setDeleteRow(row);
  }

  async function confirmDelete() {
    if (!deleteRow) return;

    setDeleteLoading(true);

    try {
      await api.delete(deleteRow.id);
      setRows((currentRows) =>
        currentRows.filter((currentRow) => currentRow.id !== deleteRow.id),
      );
      setDeleteRow(null);
      toast.success(`${title} deleted`);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const deleteRecordName =
    deleteRow?.invoice_no ||
    deleteRow?.quotation_no ||
    deleteRow?.payment_no ||
    deleteRow?.name ||
    deleteRow?.company_name ||
    deleteRow?.label ||
    "this record";

  return (
    <ContentArea>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          extraAction !== undefined ? (
            extraAction
          ) : (
            <button
              onClick={startCreate}
              className="
            inline-flex
            items-center
            gap-2
            rounded-md
            bg-teal-700
            px-3
            py-2
            text-sm
            font-medium
            text-white
          "
            >
              <Plus size={16} />
              New
            </button>
          )
        }
      />
      {beforeFilters}
      <TableFilters value={query} onChange={setQuery} />
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <DataTable
            data={filtered}
            columns={tableColumns}
            onRowClick={(e, row) => view(row)}
          />
        </div>
      </div>
      <Modal
        open={open}
        title={`${editingRow ? "Edit" : "New"} ${title}`}
        onClose={() => {
          setOpen(false);
          setCountryCode("");
          setStateCode("");
          setCityValue("");
        }}
      >
        <form
          className="flex flex-col gap-4 max-h-[calc(90vh-8rem)]"
          onSubmit={handleSubmit(save)}
        >
          <div className="flex-1 overflow-y-auto pr-2">
            <div
              className={
                title === "Customers" || title === "Vendors"
                  ? "grid grid-cols-1 gap-6 md:grid-cols-2"
                  : "space-y-4"
              }
            >
              {fields.map((field) =>
                renderField(
                  field,
                  register,
                  errors,
                  options,
                  setValue,
                  countryCode,
                  setCountryCode,
                  stateCode,
                  setStateCode,
                  cityValue,
                  setCityValue,
                ),
              )}
            </div>
          </div>
          <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white flex-shrink-0">
            Save
          </button>
        </form>
      </Modal>
      <Modal
        open={Boolean(viewRow)}
        title={`${title} Details`}
        onClose={() => setViewRow(null)}
      >
        <div
          className={
            title === "Customers" || title === "Vendors"
              ? "grid grid-cols-1 gap-3 text-sm md:grid-cols-2"
              : "grid gap-3 text-sm"
          }
        >
          {viewRow &&
            fields.map((field) => (
              <div key={field.name}>
                {/* LABEL OUTSIDE */}
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  {field.label}
                </div>

                {/* VALUE BOX */}
                <div className="rounded-md border border-slate-200 p-3 text-slate-900">
                  {String(viewRow[field.name] ?? "-")}
                </div>
              </div>
            ))}
        </div>
      </Modal>
      <Modal
        open={Boolean(deleteRow)}
        title={`Delete ${deleteRecordName}?`}
        onClose={() => {
          if (!deleteLoading) setDeleteRow(null);
        }}
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            This will remove it from active lists.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleteLoading}
              onClick={() => setDeleteRow(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteLoading}
              onClick={confirmDelete}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </ContentArea>
  );
}

function renderField(
  field,
  register,
  errors,
  options,
  setValue,
  countryCode,
  setCountryCode,
  stateCode,
  setStateCode,
  cityValue,
  setCityValue,
  setCitytValue,
) {
  const countries = Country.getAllCountries();

  const states = State.getStatesOfCountry(countryCode);

  const cities = City.getCitiesOfState(countryCode, stateCode);
  if (field.type === "textarea" || field.kind === "textarea") {
    return (
      <FormTextarea
        key={field.name}
        label={field.label}
        error={errors[field.name]}
        {...register(field.name)}
      />
    );
  }

  // COUNTRY
  if (field.kind === "country") {
    return (
      <div key={field.name}>
        <label className="mb-1 block text-sm font-medium">{field.label}</label>

        <select
          value={countryCode}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(e) => {
            setCountryCode(e.target.value);

            const selectedCountry = countries.find(
              (c) => c.isoCode === e.target.value,
            );

            setValue(field.name, selectedCountry?.name || "");
          }}
        >
          <option value="">Select Country</option>
          {countries.map((country, idx) => (
            <option
              key={`country-${country.isoCode}-${idx}`}
              value={country.isoCode}
            >
              {country.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // STATE
  if (field.kind === "state") {
    return (
      <div key={field.name}>
        <label className="mb-1 block text-sm font-medium">{field.label}</label>

        <select
          value={stateCode}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(e) => {
            setStateCode(e.target.value);

            const selectedState = states.find(
              (s) => s.isoCode === e.target.value,
            );

            setValue(field.name, selectedState?.name || "");
          }}
        >
          <option value="">Select State</option>
          {states.map((state, idx) => (
            <option key={`state-${state.isoCode}-${idx}`} value={state.isoCode}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // CITY
  if (field.kind === "city") {
    return (
      <div key={field.name}>
        <label className="mb-1 block text-sm font-medium">{field.label}</label>

        <select
          value={cityValue || ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(e) => {
            const city = e.target.value;

            setCityValue(city);

            setValue(field.name, city, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        >
          <option value="">Select City</option>
          {cities.map((city, idx) => (
            <option key={`city-${city.name}-${idx}`} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // SELECT
  if (field.type === "select") {
    const choices =
      typeof field.options === "string"
        ? options[field.options] || []
        : field.options || [];

    return (
      <FormSelect
        key={field.name}
        label={field.label}
        error={errors[field.name]}
        {...register(field.name)}
      >
        <option value="">Select {field.label}</option>
        {choices.map((choice, idx) => {
          const value = choice.value ?? choice.id;
          const label =
            choice.label ?? choice.name ?? choice.company_name ?? choice.title;
          return (
            <option key={`${field.name}-opt-${idx}`} value={value ?? ""}>
              {label}
            </option>
          );
        })}
      </FormSelect>
    );
  }

  // DEFAULT INPUT
  return (
    <FormInput
      key={field.name}
      label={field.label}
      type={field.type || "text"}
      placeholder={field.placeholder}
      error={errors[field.name]}
      {...register(field.name)}
    />
  );
}
