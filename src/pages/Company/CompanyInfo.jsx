import { Country, State, City } from "country-state-city";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Building2, Upload, Edit, KeyRound } from "lucide-react";

import toast from "@utils/notify";

import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";

import FormInput from "../../components/forms/FormInput";
import FormTextarea from "../../components/forms/FormTextarea";

import { modules } from "../../utils/api";
import { validators } from "../../utils/validators";

export default function CompanyInfo() {
  const { register, handleSubmit, reset, setValue } = useForm({
    defaultValues: {
      logo_path: "",
    },
  });

  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityValue, setCityValue] = useState("");

  const countries = Country.getAllCountries();

  const states = State.getStatesOfCountry(countryCode);

  const cities = City.getCitiesOfState(countryCode, stateCode);

  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    modules.company
      .get()
      .then((data) => {
        reset(data);

        if (data?.logo_path) {
          setLogoPreview(data.logo_path);
        }

        // COUNTRY
        if (data?.country) {
          const countryObj = countries.find((c) => c.name === data.country);

          if (countryObj) {
            setCountryCode(countryObj.isoCode);

            // STATE
            if (data?.state) {
              const stateObj = State.getStatesOfCountry(
                countryObj.isoCode,
              ).find((s) => s.name === data.state);

              if (stateObj) {
                setStateCode(stateObj.isoCode);
              }
            }
          }
        }

        // CITY
        if (data?.city) {
          setCityValue(data.city);
        }
      })
      .catch((error) => toast.error(error.message));
  }, [reset]);

  async function save(values) {
    try {
      if (!validators.mobile(values.mobile)) {
        toast.error("Enter valid 10 digit mobile number");

        return;
      }

      if (values.phone && !validators.mobile(values.phone)) {
        toast.error("Enter valid phone number");

        return;
      }

      if (values.email && !validators.email(values.email)) {
        toast.error("Invalid email address");

        return;
      }

      if (values.pincode && !validators.pincode(values.pincode)) {
        toast.error("Invalid pincode");

        return;
      }

      if (values.gstin && !validators.gstin(values.gstin)) {
        toast.error("Invalid GSTIN");

        return;
      }

      if (values.pan && !validators.pan(values.pan)) {
        toast.error("Invalid PAN number");

        return;
      }

      await modules.company.update(values);

      toast.success("Company information updated");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64 = reader.result;

        const result = await modules.company.uploadLogo({
          base64,
        });

        setLogoPreview(result.filePath);

        setValue("logo_path", result.filePath);
        toast.success("Logo uploaded");
      } catch (error) {
        toast.error(error.message);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <ContentArea>
      <PageHeader
        title="Company Information"
        subtitle="Manage your business identity, GST details, banking information, and invoice settings"
        actions={
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Edit size={16} />
              Edit Information
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              <KeyRound size={16} />
              Change PIN
            </button>
          </div>
        }
      />

      <form
        onSubmit={handleSubmit(save)}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {/* Company Logo */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Company Logo
          </h2>

          <div className="flex items-center gap-6">
            <label className="flex h-36 w-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-teal-600 hover:bg-teal-50">
              {logoPreview ? (
                <img
                  key={logoPreview}
                  src={encodeURI(
                    `file:///${String(logoPreview).replace(/\\/g, "/")}`,
                  )}
                  alt="Company Logo"
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-slate-400">
                  <Building2 className="mb-2 h-12 w-12" />
                  <span className="text-sm font-medium">Upload Logo</span>
                </div>
              )}

              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleLogoChange}
              />
            </label>

            <div>
              <p className="text-sm text-slate-500">
                Supported formats: PNG, JPG, JPEG, SVG, WEBP
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Max size: 5MB recommended
              </p>

              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Upload size={15} />
                Upload Logo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
          </div>
        </div>
        <input
          type="hidden"
          {...register("logo_path")}
          value={logoPreview || ""}
        />

        {/* Basic Information */}
        <div className="mb-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormInput label="Company Name" {...register("name")} />

            <FormInput label="Tagline" {...register("tagline")} />
          </div>
        </div>

        {/* Address Information */}
        <div className="mb-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Address Information
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormTextarea label="Address" {...register("address")} />

            <div className="grid gap-5">
              {/* Country */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Country
                </label>

                <select
                  value={countryCode}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  onChange={(e) => {
                    setCountryCode(e.target.value);

                    const selectedCountry = countries.find(
                      (c) => c.isoCode === e.target.value,
                    );

                    setValue("country", selectedCountry?.name || "");
                  }}
                >
                  <option value="">Select Country</option>

                  {countries.map((country) => (
                    <option key={country.isoCode} value={country.isoCode}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* State */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  State
                </label>

                <select
                  value={stateCode}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  onChange={(e) => {
                    setStateCode(e.target.value);

                    const selectedState = states.find(
                      (s) => s.isoCode === e.target.value,
                    );

                    setValue("state", selectedState?.name || "");
                  }}
                >
                  <option value="">Select State</option>

                  {states.map((state) => (
                    <option key={state.isoCode} value={state.isoCode}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  City
                </label>

                <select
                  value={cityValue}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  onChange={(e) => {
                    setCityValue(e.target.value);
                    setValue("city", e.target.value);
                  }}
                >
                  <option value="">Select City</option>

                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <FormInput label="Pincode" {...register("pincode")} />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mb-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Contact Information
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormInput label="Phone"  maxLength={10}

  {...register("phone", {

    onChange: (e) => {

      e.target.value =
        e.target.value
          .replace(/\D/g, "")
          .slice(0, 10);

    },

  })} />

            <FormInput label="Mobile"  maxLength={10}

  {...register("mobile", {

    onChange: (e) => {

      e.target.value =
        e.target.value
          .replace(/\D/g, "")
          .slice(0, 10);

    },

  })} />

            <FormInput label="Email" {...register("email")} />

            <FormInput label="Website" {...register("website")} />
          </div>
        </div>

        {/* Legal Information */}
        <div className="mb-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Legal Information
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormInput label="GSTIN" {...register("gstin")} />

            <FormInput label="PAN" {...register("pan")} />

            <FormInput label="CIN" {...register("cin")} />
          </div>
        </div>

        {/* Bank Information */}
        <div className="mb-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Bank Information
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormInput label="Bank Name" {...register("bank_name")} />

            <FormInput label="Account Number" {...register("bank_account")} />

            <FormInput label="IFSC Code" {...register("ifsc")} />

            <FormInput label="UPI ID" {...register("upi_id")} />
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="mb-8">
          <h2 className="mb-5 text-lg font-semibold text-slate-900">
            Terms & Conditions
          </h2>

          <div className="space-y-4">
            <FormInput
              label="Term 1"
              placeholder="Enter term & condition point 1"
              {...register("term1")}
            />

            <FormInput
              label="Term 2"
              placeholder="Enter term & condition point 2"
              {...register("term2")}
            />

            <FormInput
              label="Term 3"
              placeholder="Enter term & condition point 3"
              {...register("term3")}
            />

            <FormInput
              label="Term 4"
              placeholder="Enter term & condition point 4"
              {...register("term4")}
            />

            <FormInput
              label="Term 5"
              placeholder="Enter term & condition point 5"
              {...register("term5")}
            />

            <FormTextarea
              label="Invoice Footer Text"
              {...register("invoice_footer")}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-teal-800"
          >
            Save Company Information
          </button>
        </div>
      </form>
    </ContentArea>
  );
}
