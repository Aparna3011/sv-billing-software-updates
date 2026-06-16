import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';

export default function GSTRates() {
  return <GenericResourcePage title="GST Rates" subtitle="Tax rates used by software service invoices" api={modules.gst} searchKeys={['label']} fields={[
    { name: 'rate', label: 'Rate', type: 'number', required: true },
    { name: 'label', label: 'Label', required: true }
  ]} columns={[
    { key: 'label', label: 'Label' },
    { key: 'rate', label: 'Rate %' },
    { key: 'is_active', label: 'Active', render: row => row.is_active ? 'Yes' : 'No' }
  ]} />;
}
