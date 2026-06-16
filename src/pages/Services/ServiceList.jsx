import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';
import { money } from '../../utils/format';
import { BILLING_TYPE_OPTIONS } from '../../utils/constants';

export default function ServiceList() {
  return <GenericResourcePage title="Services" subtitle="Software services, SaaS, hosting, cloud, consulting, and AMC offerings" api={modules.services} searchKeys={['name', 'category']} fields={[
    { name: 'name', label: 'Service Name', required: true },
    { name: 'description', label: 'Description', type: 'textarea'},
    { name: 'sac_code', label: 'SAC' },
    { name: 'billing_type', label: 'Billing Type', type: 'select', options: BILLING_TYPE_OPTIONS, defaultValue: 'Fixed Price', required: true },
    { name: 'rate', label: 'Rate', type: 'number' },
    { name: 'gst_rate', label: 'GST Rate', type: 'number' },
    { name: 'category', label: 'Category' }
  ]} columns={[
    { key: 'name', label: 'Service' },
    { key: 'category', label: 'Category' },
    { key: 'sac_code', label: 'SAC' },
    { key: 'rate', label: 'Rate', render: row => money(row.rate) },
    { key: 'gst_rate', label: 'GST %' }
  ]} />;
}
