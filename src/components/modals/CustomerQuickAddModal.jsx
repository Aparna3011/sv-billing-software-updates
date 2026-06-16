import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "@utils/notify";
import { Country, State, City } from "country-state-city";
import { modules } from "../../utils/api";
import Modal from "./Modal";
import FormInput from "../forms/FormInput";
import FormSelect from "../forms/FormSelect";
import FormTextarea from "../forms/FormTextarea";

const customerSchema = z.object({
  company_name: z.string().min(1, "Company Name is required"),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  gstin: z.string().optional(),
  gst_treatment: z.string().min(1, "GST Treatment is required"),
  address: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  state: z.string().optional(),
  city: z.string().optional(),
  opening_balance: z.coerce.number().optional().default(0),
  payment_terms: z.coerce.number().optional().default(15),
});

export default function CustomerQuickAddModal({ isOpen, onClose, onSuccess }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      company_name: "",
      contact_person: "",
      phone: "",
      email: "",
      gstin: "",
      gst_treatment: "registered",
      address: "",
      country: "",
      state: "",
      city: "",
      opening_balance: 0,
      payment_terms: 15,
    },
  });

  const [gstTreatments, setGstTreatments] = useState([]);
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");

  const countries = Country.getAllCountries();
  const states = State.getStatesOfCountry(countryCode);
  const cities = City.getCitiesOfState(countryCode, stateCode);

  useEffect(() => {
    if (isOpen) {
      reset();
      setCountryCode("");
      setStateCode("");
      modules.gst.listGstTreatments().then(setGstTreatments).catch(toast.error);
    }
  }, [isOpen, reset]);

  async function onSubmit(data) {
    try {
      const saved = await modules.customers.create(data);
      toast.success("Customer created successfully!");
      onSuccess(saved);
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Add New Customer">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Company Name *"
            {...register("company_name")}
            error={errors.company_name}
            required
          />
          <FormInput
            label="Contact Person"
            {...register("contact_person")}
            error={errors.contact_person}
          />
          <FormInput
            label="Phone"
            {...register("phone")}
            error={errors.phone}
          />
          <FormInput
            label="Email"
            type="email"
            {...register("email")}
            error={errors.email}
          />
          <FormInput
            label="GSTIN"
            {...register("gstin")}
            error={errors.gstin}
          />
          <FormSelect
            label="GST Treatment *"
            {...register("gst_treatment")}
            error={errors.gst_treatment}
            required
          >
            <option value="">Select Treatment</option>
            {gstTreatments.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormSelect>
          <div className="md:col-span-2">
            <FormTextarea
              label="Address"
              {...register("address")}
              error={errors.address}
              rows={2}
            />
          </div>
          <FormSelect
            label="Country"
            value={countryCode}
            required
            onChange={(e) => {
              const code = e.target.value;
              setCountryCode(code);
              setStateCode("");
              const selected = countries.find(c => c.isoCode === code);
              setValue("country", selected?.name || "");
              setValue("state", "");
              setValue("city", "");
            }}
            error={errors.country}
          >
            <option value="">Select Country</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            label="State"
            value={stateCode}
            onChange={(e) => {
              const code = e.target.value;
              setStateCode(code);
              const selected = states.find(s => s.isoCode === code);
              setValue("state", selected?.name || "");
              setValue("city", "");
            }}
            disabled={!countryCode}
            error={errors.state}
          >
            <option value="">Select State</option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.isoCode}>
                {s.name}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            label="City"
            {...register("city")}
            onChange={(e) => {
              const name = e.target.value;
              setValue("city", name, { shouldValidate: true, shouldDirty: true });
            }}
            disabled={!stateCode}
            error={errors.city}
          >
            <option value="">Select City</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          <FormInput
            label="Opening Balance"
            type="number"
            step="0.01"
            {...register("opening_balance")}
            error={errors.opening_balance}
          />
          <FormInput
            label="Payment Terms (days)"
            type="number"
            {...register("payment_terms")}
            error={errors.payment_terms}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}