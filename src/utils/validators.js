export const validators = {

  mobile(value) {

    return /^[6-9]\d{9}$/
      .test(value);

  },

  email(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(value);

  },

  pincode(value) {

    return /^[1-9][0-9]{5}$/
      .test(value);

  },

gstin(value) {
  if (!value || !value.trim()) return true;

  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
    .test(value.trim().toUpperCase());
},

pan(value) {
  if (!value || !value.trim()) return true;

  return /^[A-Z]{5}[0-9]{4}[A-Z]$/
    .test(value.trim().toUpperCase());
},

};