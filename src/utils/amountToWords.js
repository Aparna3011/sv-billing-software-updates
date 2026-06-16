import * as ntw from 'number-to-words';

const toWords =
  typeof ntw.toWords === 'function'
    ? ntw.toWords
    : typeof ntw.default === 'object' && ntw.default && typeof ntw.default.toWords === 'function'
      ? ntw.default.toWords
      : (n) => String(n);

export function amountToWords(amount) {
  const rupees = Math.floor(Number(amount || 0));
  const paise = Math.round((Number(amount || 0) - rupees) * 100);
  const rupeeWords = String(toWords(rupees)).replace(/\b\w/g, (c) => c.toUpperCase());
  return paise
    ? `${rupeeWords} Rupees and ${String(toWords(paise))} Paise Only`
    : `${rupeeWords} Rupees Only`;
}
