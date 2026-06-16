import GenericResourcePage from '../_shared/GenericResourcePage';
import { modules } from '../../utils/api';

export default function UserList() {
  return <GenericResourcePage title="Users" subtitle="Role-based access for super admins, accountants, and operators" api={modules.users} searchKeys={['name', 'email', 'role']} fields={[
    { name: 'name', label: 'Name', required: true },
    { name: 'email', label: 'Email', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true, requiredOnEdit: false },
    { name: 'role', label: 'Role', kind: 'select', required: true, defaultValue: 'operator', options: [
      { value: 'super_admin', label: 'Super Admin' },
      { value: 'accountant', label: 'Accountant' },
      { value: 'operator', label: 'Operator' }
    ] },
    { name: 'is_active', label: 'Active', kind: 'select', type: 'number', defaultValue: 1, options: [
      { value: 1, label: 'Yes' },
      { value: 0, label: 'No' }
    ] }
  ]} columns={[
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'is_active', label: 'Active', render: row => row.is_active ? 'Yes' : 'No' }
  ]} />;
}
