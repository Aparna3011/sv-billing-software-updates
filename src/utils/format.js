import { format } from 'date-fns';

export function money(value) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
}

export function date(value) {
  return value ? format(new Date(value), 'dd/MM/yyyy') : '';
}

export function formatAddress(entity) {
  const parts = [
    entity.address,
    [entity.city, entity.state, entity.country].filter(Boolean).join(', ')
  ].filter(Boolean);
  return parts.join('\n');
}
