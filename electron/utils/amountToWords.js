const converter = require('number-to-words');

function amountToWords(amount) {
  const rupees = Math.floor(Number(amount || 0));
  const paise = Math.round((Number(amount || 0) - rupees) * 100);
  const rupeeWords = converter.toWords(rupees).replace(/\b\w/g, c => c.toUpperCase());
  return paise ? `${rupeeWords} Rupees and ${converter.toWords(paise)} Paise Only` : `${rupeeWords} Rupees Only`;
}

module.exports = { amountToWords };
