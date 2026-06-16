import { useRef } from "react";
import { Trash2 } from "lucide-react";

const pointText = (point) =>
  typeof point === "string" ? point : point?.point_text || "";

const normalizePoints = (points = []) => points.map(pointText);

const compactPoints = (points = []) =>
  normalizePoints(points).filter(
    (point) => point.trim() && point.trim() !== "[object Object]",
  );

const descriptionFromPoints = (points = []) =>
  compactPoints(points)
    .map((point) => `- ${point}`)
    .join("\n");

export default function LineItemRow({
  item,
  onChange,
  onRemove,
  services,
  isLastRow,
  onAddNext,
  gst = [],
  lineDiscountDisplay,
  lineGrossDisplay,
  serviceLabel = "Service",
  isGstEnabled = true, // Add this prop
}) {
  const descriptionRef = useRef(null);
  const descriptionPoints = normalizePoints(item.descriptionPoints || []);
  const displayedPoints = descriptionPoints.length ? descriptionPoints : [""];

  const updateDescriptionPoints = (points) => {
    const updated = normalizePoints(points);

    onChange({
      ...item,
      descriptionPoints: updated,
      description: descriptionFromPoints(updated),
    });
  };

  const removeDescriptionPoint = (index) => {
    updateDescriptionPoints(displayedPoints.filter((_, i) => i !== index));
  };

  const focusDescriptionPoint = (index) => {
    setTimeout(() => {
      const inputs =
        descriptionRef.current?.querySelectorAll(".desc-point-input") || [];

      inputs[index]?.focus();
    }, 0);
  };

  const applyService = (serviceId) => {
    if (serviceId === "" || serviceId === null || serviceId === undefined) {
      onChange({
        ...item,
        service_id: "",
        name: "",
        description: "",
        descriptionPoints: [],
        sac_code: "",
        billing_type: serviceLabel,
        rate: 0,
        gst_rate: serviceLabel === "Category" ? 0 : 18,
      });

      return;
    }

    const service = services.find(
      (row) => String(row.id) === String(serviceId),
    );

    if (service) {
      const nextDescriptionPoints = compactPoints(
        service.descriptionPoints || [],
      );

      onChange({
        ...item,
        service_id: service.id,
        name: service.name,
        description:
          descriptionFromPoints(nextDescriptionPoints) ||
          service.description ||
          "",
        descriptionPoints: nextDescriptionPoints,
        sac_code: service.sac_code || " ",
        billing_type: service.billing_type || serviceLabel,
        rate: Number(service.rate || 0),
        gst_rate: Number(service.gst_rate || (serviceLabel === "Category" ? 0 : 18)),
      });
    }
  };

  const handleRowKeyDown = (event) => {
    if (event.key !== "Delete") return;
    if (descriptionRef.current?.contains(event.target)) return;

    event.preventDefault();
    onRemove();
  };

  const base = Number(item.qty || 0) * Number(item.rate || 0);
  const gstRate = isGstEnabled ? Number(item.gst_rate || 0) : 0; // Modified GST rate calculation
  const tax =
    gstRate == null || !Number.isFinite(gstRate)
      ? 0
      : (base * gstRate) / 100;
  const displayTotal =
    lineGrossDisplay != null ? Number(lineGrossDisplay) : base + tax;
  const displayDiscount =
    lineDiscountDisplay != null ? Number(lineDiscountDisplay) : 0;

  return (
    <tr onKeyDown={handleRowKeyDown}>
      <td className="p-2">
        <select
          value={item.service_id || ""}
          onChange={(event) => applyService(event.target.value)}
          className="w-full rounded border px-2 py-1"
        >
          <option value="">Custom {serviceLabel}</option>

          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>

        <input
          value={item.name || ""}
          onChange={(event) =>
            onChange({
              ...item,
              name: event.target.value,
            })
          }
          className="mt-1 w-full rounded border px-2 py-1"
          placeholder={`${serviceLabel} Name`}
        />
      </td>
      <td className="p-2">
        <div ref={descriptionRef} className="space-y-2">
          {displayedPoints.map((point, index) => {
            return (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={point}
                  placeholder={`Enter ${serviceLabel.toLowerCase()} detail...`}
                  className="desc-point-input w-full rounded border border-slate-300 px-2 py-2 text-sm outline-none focus:border-teal-600"
                  onChange={(event) => {
                    const updated = [...displayedPoints];

                    updated[index] = event.target.value;
                    updateDescriptionPoints(updated);
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      (event.key === "Backspace" || event.key === "Delete")
                    ) {
                      event.preventDefault();
                      removeDescriptionPoint(index);
                      return;
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();

                      const updated = [...displayedPoints];
                      updated.splice(index + 1, 0, "");
                      updateDescriptionPoints(updated);
                      focusDescriptionPoint(index + 1);
                    }

                    if (
                      (event.key === "Backspace" || event.key === "Delete") &&
                      !point.trim() &&
                      displayedPoints.length > 1
                    ) {
                      event.preventDefault();
                      removeDescriptionPoint(index);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </td>
      <td className="p-2">
        <input
          value={item.sac_code || ""}
          onChange={(event) =>
            onChange({ ...item, sac_code: event.target.value })
          }
          placeholder=" "
          className="w-24 rounded border px-2 py-1"
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          value={item.qty || 1}
          onChange={(event) =>
            onChange({ ...item, qty: Number(event.target.value) })
          }
          placeholder="1"
          className="w-20 rounded border px-2 py-1"
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          value={item.rate || 0}
          onChange={(event) =>
            onChange({ ...item, rate: Number(event.target.value) })
          }
          placeholder="0.00"
          className="w-28 rounded border px-2 py-1"
        />
      </td>
      <td className="p-2 text-right font-medium">
        {displayDiscount.toFixed(2)}
      </td>
      {isGstEnabled && ( // Conditional rendering for GST % dropdown
        <td className="p-2">
          <select
            value={item.gst_rate ?? null}
            onChange={(event) =>
              onChange({
                ...item,
                gst_rate: Number(event.target.value),
              })
            }
            className="w-20 rounded border px-2 py-1"
          >
            {gst?.map((rate) => (
              <option key={rate.id} value={rate.rate}>
                {rate.label}
              </option>
            ))}
          </select>
        </td>
      )}
      <td className="p-2 text-right font-medium">{displayTotal.toFixed(2)}</td>
      <td className="p-2">
        <button
          type="button"
          title="Remove row"
          onClick={onRemove}
          onKeyDown={(event) => {
            if (event.key === "Tab" && !event.shiftKey && isLastRow) {
              event.preventDefault();
              onAddNext();
            }
          }}
          className="rounded p-2 text-red-500 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}
