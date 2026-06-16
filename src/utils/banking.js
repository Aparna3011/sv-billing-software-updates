/**
 * Centralized logic to determine the default bank account for payment forms.
 * Priority: account_name 'Cash' > bank_name 'Cash in Hand' > is_default flag > Fallback to first account.
 */
export function getDefaultBankAccountId(accounts) {
  if (!accounts || accounts.length === 0) return "";
  const cashAcc = accounts.find(a => a.account_name === 'Cash') || 
                 accounts.find(a => a.bank_name === 'Cash in Hand') || 
                 accounts.find(a => a.is_default === 1);
  return cashAcc ? cashAcc.id : accounts[0].id;
}