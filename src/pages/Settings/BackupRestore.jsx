import { useEffect, useState } from 'react';
import toast from '@utils/notify';
import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/tables/DataTable';
import { modules } from '../../utils/api';

export default function BackupRestore() {
  const [rows, setRows] = useState([]);
  const load = () => modules.backup.list().then(setRows).catch(error => toast.error(error.message));
  useEffect(() => { load(); }, []);
  async function create() {
    try {
      await modules.backup.create('manual');
      toast.success('Backup created');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function restore(path) {
    const confirmed = window.confirm(
      "Are you sure you want to restore this backup? The current database will be replaced, and the application will reload."
    );
    if (!confirmed) return;

    try {
      await modules.backup.restore(path);
      toast.success("Database restored successfully");
      // Give the user a moment to see the success message before reloading
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <ContentArea>
      <PageHeader 
        title="Backup & Restore" 
        subtitle="Local SQLite backup files (System maintains the 4 latest copies)" 
        actions={<button onClick={create} className="rounded-md bg-teal-700 px-3 py-2 text-sm text-white">Create manual backup</button>} 
      />
      <DataTable 
        data={rows} 
        onRowClick={(event, row) => {
          const isInteractive = event?.target?.closest("button, a, input, select, textarea, svg, [role='button'], .action-cell");
          if (isInteractive) return;

          console.log("DEBUG: Row Clicked (DataTable) - Backup File:", row.filename);
          // Currently no detail view for backups, but click is captured
        }}
        columns={[
          { accessorKey: 'filename', header: 'File' }, 
          { 
            accessorKey: 'size', 
            header: 'Size',
            cell: ({ getValue }) => `${(getValue() / 1024 / 1024).toFixed(2)} MB`
          }, 
          { accessorKey: 'created', header: 'Created' },
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
              <div className="action-cell">
              <button 
                  onClick={() => restore(row.original.path)}
                className="font-medium text-teal-700 hover:text-teal-900 text-sm"
              >
                Restore
              </button>
              </div>
            )
          }
        ]} 
      />
    </ContentArea>
  );
}
