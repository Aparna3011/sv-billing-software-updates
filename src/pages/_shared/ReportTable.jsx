import { useEffect, useState } from "react";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";

export default function ReportTable({ title, subtitle, load, columns, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    load()
      .then(setRows)
      .catch((error) => toast.error(error.message));
  }, [refreshKey]);
  return (
    <ContentArea>
      <PageHeader title={title} subtitle={subtitle} />
      <DataTable
        data={rows}
        columns={columns.map((col) => ({
          accessorKey: col.key,
          header: col.label,
          cell: (info) =>
            col.render ? col.render(info.row.original) : info.getValue(),
        }))}
      />
    </ContentArea>
  );
}
