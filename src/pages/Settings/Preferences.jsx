import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import toast from "@utils/notify";

import ReportTable from "../_shared/ReportTable";
import { modules } from "../../utils/api";

function EditPreferenceForm({ row, onCancel, onSave }) {
  const [form, setForm] = useState({
    key: row.key || "",
    value: row.value || "",
  });

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div
      className="
        absolute
        right-16
        top-12
        z-[9999]
        w-72
        rounded-xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-2xl
      "
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Key
          </label>

          <input
            value={form.key}
            onChange={(e) => updateField("key", e.target.value)}
            className="
              w-full
              rounded-md
              border
              border-slate-300
              px-3
              py-2
              text-sm
              outline-none
              focus:border-teal-600
            "
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Value
          </label>

          <input
            value={form.value}
            onChange={(e) => updateField("value", e.target.value)}
            className="
              w-full
              rounded-md
              border
              border-slate-300
              px-3
              py-2
              text-sm
              outline-none
              focus:border-teal-600
            "
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="
              rounded-md
              border
              border-slate-300
              px-3
              py-2
              text-sm
            "
          >
            Cancel
          </button>

          <button
            onClick={() => onSave(form)}
            className="
              rounded-md
              bg-teal-700
              px-3
              py-2
              text-sm
              font-medium
              text-white
            "
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Preferences() {
  const [editingRow, setEditingRow] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    const allSettings = await modules.settings.list();
    // Filter only preference-related settings (currency, date format, etc.)
    return allSettings.filter((s) =>
      ["currency", "date_format", "time_format", "timezone"].includes(s.key)
    );
  };

  async function remove(row) {
    try {
      await modules.settings.set({
        key: row.key,
        value: "",
      });

      toast.success("Setting deleted");
      setEditingRow(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function save(form) {
    try {
      await modules.settings.update({
        oldKey: editingRow.key,
        key: form.key,
        value: form.value,
      });

      toast.success("Setting updated");
      setEditingRow(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      toast.error(error.message);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "key",
        label: "Key",
      },
      {
        key: "value",
        label: "Value",
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="relative flex items-center gap-2 overflow-visible">
            <button
              title="Edit"
              onClick={() => setEditingRow(row)}
              className="
                rounded-md
                p-1.5
                text-blue-600
                hover:bg-blue-50
              "
            >
              <Pencil size={16} />
            </button>

            <button
              title="Delete"
              onClick={() => remove(row)}
              className="
                rounded-md
                p-1.5
                text-red-600
                hover:bg-red-50
              "
            >
              <Trash2 size={16} />
            </button>

            {editingRow?.key === row.key && (
              <EditPreferenceForm
                row={row}
                onCancel={() => setEditingRow(null)}
                onSave={save}
              />
            )}
          </div>
        ),
      },
    ],
    [editingRow]
  );

  return (
    <ReportTable
      title="Preferences"
      subtitle="Currency, date format, and locale settings"
      load={load}
      columns={columns}
      refreshKey={refreshKey}
    />
  );
}
