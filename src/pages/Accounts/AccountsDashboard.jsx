import React, { useEffect, useState } from "react";
import toast from "@utils/notify";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import { modules } from "../../utils/api";
import { money, date } from "../../utils/format";
import {
  TrendingUp,
  TrendingDown,
  UserCheck,
  Truck,
  Users,
  ArrowLeft,
  Landmark,
  ReceiptText,
  History,
  FileText,
  Scale,
} from "lucide-react";
// import { useNavigate } from "react-router-dom";

export default function AccountsDashboard() {
  const [data, setData] = useState(null);
  const [selectedParty, setSelectedParty] = useState(null);
  const [details, setDetails] = useState(null);
  // const navigate = useNavigate();

  useEffect(() => {
    modules.accounts
      .dashboard()
      .then(setData)
      .catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (selectedParty) {
      const companyName = selectedParty.name;
      const payload = { companyName };

      console.log("Route Params", { name: companyName }); // Trace parity for drill-down context
      console.log("API Payload", payload);
      console.log("2. API Request (companyName):", companyName);

      modules.accounts
        .getPartyStatement(companyName)
        .then((response) => {
          console.log("3. API Response (details):", response);
          setDetails(response);
        })
        .catch((error) => toast.error(error.message));
    } else {
      setDetails(null);
    }
  }, [selectedParty]);

  if (selectedParty) {
    // Use detailed summary if available, fallback to selectedParty row data
    const customerOS = details?.summary ? details.summary.customer_outstanding : (selectedParty.customer_outstanding || selectedParty.outstanding || 0);
    const vendorOS = details?.summary ? details.summary.vendor_outstanding : (selectedParty.vendor_outstanding || (selectedParty.total_purchases ? selectedParty.outstanding : 0));
    
    const net = customerOS - vendorOS;
    let statusLabel = "Settled";
    let statusColor = "bg-slate-500/20 text-slate-400";

    if (customerOS > 0 && vendorOS > 0) {
      statusLabel = "Mixed Position";
      statusColor = "bg-amber-500/20 text-amber-500";
    } else if (net > 0.01) {
      statusLabel = "Customer Owes Us";
      statusColor = "bg-emerald-500/20 text-emerald-400";
    } else if (net < -0.01) {
      statusLabel = "We Owe Vendor";
      statusColor = "bg-rose-500/20 text-rose-400";
    }

    return (
      <ContentArea>
        <div className="mb-4">
          <button
            onClick={() => setSelectedParty(null)}
            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Accounts
          </button>
        </div>

        <PageHeader
          title={selectedParty.name}
          subtitle="Consolidated Party Financial Statement"
        />

        {/* 1. Net Position Summary */}
        <div className="rounded-2xl bg-slate-900 p-8 text-white flex flex-col md:flex-row justify-between items-center gap-8 mb-8 shadow-xl border border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 w-full md:w-auto">
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                Customer Receivable
              </div>
              <div className="text-xl font-bold text-teal-400">
                {money(customerOS)}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                Vendor Payable
              </div>
              <div className="text-xl font-bold text-blue-400">
                {money(vendorOS)}
              </div>
            </div>
            <div className="col-span-2 md:col-span-1">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                Net Position
              </div>
              <div className="text-2xl font-black">{money(Math.abs(net))}</div>
            </div>
          </div>
          <div
            className={`px-8 py-3 rounded-full font-black text-sm uppercase tracking-tight shadow-lg ${statusColor}`}
          >
            {statusLabel}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 2. Customer Summary */}
          <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
            <h3 className="text-teal-700 font-black uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
              <UserCheck size={18} /> Receivable Summary (Customer)
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <SummaryField
                label="Total Sales"
                value={money(details?.summary?.customer_generated ?? selectedParty.total_invoiced)}
              />
              <SummaryField
                label="Total Received"
                value={money(details?.summary?.customer_received ?? selectedParty.total_received)}
              />
              <SummaryField
                label="Outstanding"
                value={money(details?.summary?.customer_outstanding ?? selectedParty.customer_outstanding)}
                color="text-rose-600"
              />
              <SummaryField
                label="Overdue"
                value={money(details?.summary?.customer_overdue ?? selectedParty.customer_overdue)}
                color="text-rose-400"
              />
              <SummaryField
                label="Open Invoices"
                value={details?.summary?.open_invoice_count ?? selectedParty.open_invoice_count}
              />
            </div>
          </div>

          {/* 3. Vendor Summary */}
          <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h3 className="text-blue-700 font-black uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
              <Truck size={18} /> Payable Summary (Vendor)
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <SummaryField
                label="Total Purchases"
                value={money(details?.summary?.vendor_generated ?? selectedParty.total_purchases)}
              />
              <SummaryField
                label="Total Paid"
                value={money(details?.summary?.vendor_paid ?? selectedParty.total_paid)}
              />
              <SummaryField
                label="Outstanding"
                value={money(details?.summary?.vendor_outstanding ?? selectedParty.vendor_outstanding)}
                color="text-blue-600"
              />
              <SummaryField
                label="Overdue"
                value={money(details?.summary?.vendor_overdue ?? selectedParty.vendor_overdue)}
                color="text-rose-400"
              />
              <SummaryField
                label="Open Bills"
                value={details?.summary?.open_bill_count ?? selectedParty.open_bill_count}
              />
            </div>
          </div>
        </div>

          {/* 4. Recurring Summary */}
          <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="text-indigo-700 font-black uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
              <TrendingUp size={18} /> Recurring Summary (SaaS / AMC)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
              <SummaryField
                label="Total Generated"
                value={money(details?.summary?.recurring_generated)}
              />
              <SummaryField
                label="Total Collected"
                value={money(details?.summary?.recurring_collected)}
              />
              <SummaryField
                label="Outstanding"
                value={money(details?.summary?.recurring_outstanding)}
                color="text-indigo-600"
              />
              <div className="flex items-center">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Separated from Invoice AR
                 </span>
              </div>
            </div>
          </div>
        

        <div className="space-y-8">
          {/* 4. Customer Documents Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-800 uppercase text-[10px] tracking-widest">
              <FileText size={14} className="text-teal-600" /> Customer Invoices
            </h4>
            <DataTable
              data={details?.invoices || []}
              columns={[
                { accessorKey: "invoice_no", header: "Invoice #" },
                {
                  accessorKey: "invoice_date",
                  header: "Date",
                  cell: (info) => date(info.getValue()),
                },
                {
                  accessorKey: "grand_total",
                  header: "Amount",
                  cell: (info) => money(info.getValue()),
                },
                {
                  accessorKey: "paid_amount",
                  header: "Paid",
                  cell: (info) => (
                    <span className="text-emerald-600">
                      {money(info.getValue())}
                    </span>
                  ),
                },
                {
                  accessorKey: "balance_due",
                  header: "Balance",
                  cell: (info) => (
                    <span className="font-bold text-rose-600">
                      {money(info.getValue())}
                    </span>
                  ),
                },
                { accessorKey: "status", header: "Status" },
              ]}
            />
          </div>

          {/* 5. Vendor Documents Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-800 uppercase text-[10px] tracking-widest">
              <FileText size={14} className="text-blue-600" /> Vendor Bills &
              Expenses
            </h4>
            <DataTable
              data={details?.bills || []}
              columns={[
                { accessorKey: "doc_no", header: "Voucher #" },
                { accessorKey: "type", header: "Type" },
                {
                  accessorKey: "date",
                  header: "Date",
                  cell: (info) => date(info.getValue()),
                },
                {
                  accessorKey: "amount",
                  header: "Amount",
                  cell: (info) => money(info.getValue()),
                },
                {
                  accessorKey: "paid_amount",
                  header: "Paid",
                  cell: (info) => (
                    <span className="text-emerald-600">
                      {money(info.getValue())}
                    </span>
                  ),
                },
                {
                  accessorKey: "balance_due",
                  header: "Balance",
                  cell: (info) => (
                    <span className="font-bold text-blue-600">
                      {money(info.getValue())}
                    </span>
                  ),
                },
                { accessorKey: "status", header: "Status" },
              ]}
            />
          </div>

          {/* 6. Combined Party Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-6 flex items-center gap-2 font-bold text-slate-800 uppercase text-[10px] tracking-widest">
              <History size={14} className="text-indigo-600" /> Combined
              Financial Timeline
            </h4>
            <DataTable
              data={details?.timeline || []}
              columns={[
                {
                  accessorKey: "date",
                  header: "Date",
                  cell: (info) => date(info.getValue()),
                },
                { accessorKey: "type", header: "Transaction" },
                { accessorKey: "ref", header: "Reference" },
                {
                  accessorKey: "debit",
                  header: "Debit (+)",
                  cell: (info) =>
                    info.getValue() > 0 ? money(info.getValue()) : "-",
                },
                {
                  accessorKey: "credit",
                  header: "Credit (-)",
                  cell: (info) =>
                    info.getValue() > 0 ? (
                      <span className="text-emerald-600">
                        {money(info.getValue())}
                      </span>
                    ) : (
                      "-"
                    ),
                },
                {
                  accessorKey: "balance",
                  header: "Running Balance",
                  cell: (info) => (
                    <span className="font-black">{money(info.getValue())}</span>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </ContentArea>
    );
  }

  return (
    <ContentArea>
      <PageHeader
        title="Accounts"
        subtitle="Receivables & Payables Workspace"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Customer Receivable",
            value: data?.summary?.totalReceivable,
            icon: UserCheck,
            color: "text-teal-600",
          },
          {
            label: "Vendor Payable",
            value: data?.summary?.totalPayable,
            icon: Truck,
            color: "text-blue-600",
          },
          {
            label: "Overdue Receivable",
            value: data?.summary?.overdueReceivable,
            icon: TrendingUp,
            color: "text-rose-600",
          },
          {
            label: "Overdue Payable",
            value: data?.summary?.overduePayable,
            icon: TrendingDown,
            color: "text-orange-600",
          },
          {
            label: "Recurring Outstanding",
            value: data?.summary?.recurringOutstanding,
            icon: ReceiptText,
            color: "text-indigo-600",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <item.icon size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
            </div>
            <div className={`text-xl font-black ${item.color}`}>
              {money(item.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        {/* Customer Receivables Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-6 flex items-center gap-2 font-black text-slate-800 uppercase text-xs tracking-widest">
            <UserCheck size={18} className="text-teal-600" /> Customer
            Receivables
          </h2>
          <DataTable
            data={data?.customers || []}
            columns={[
              { accessorKey: "name", header: "Customer Name" },
              {
                accessorKey: "total_invoiced",
                header: "Total Invoiced",
                cell: (info) => money(info.getValue()),
              },
              {
                accessorKey: "total_received",
                header: "Total Received",
                cell: (info) => money(info.getValue()),
              },
              {
                accessorKey: "customer_outstanding",
                header: "Outstanding",
                cell: (info) => (
                  <span className="font-black text-rose-600">
                    {money(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "overdue",
                header: "Overdue",
                cell: (info) => (
                  <span className="font-bold text-rose-400">
                    {money(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "last_activity",
                header: "Last Activity",
                cell: (info) => (
                  <span className="text-slate-400">
                    {date(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "id",
                header: "Action",
                cell: (info) => (
                  <button
                    onClick={() => setSelectedParty(info.row.original)}
                    className="text-indigo-600 font-bold hover:underline text-xs"
                  >
                    View Ledger
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* Vendor Payables Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-6 flex items-center gap-2 font-black text-slate-800 uppercase text-xs tracking-widest">
            <Truck size={18} className="text-blue-600" /> Vendor Payables
          </h2>
          <DataTable
            data={data?.vendors || []}
            columns={[
              { accessorKey: "name", header: "Vendor Name" },
              {
                accessorKey: "total_purchases",
                header: "Total Purchases",
                cell: (info) => money(info.getValue()),
              },
              {
                accessorKey: "total_paid",
                header: "Total Paid",
                cell: (info) => money(info.getValue()),
              },
              {
                accessorKey: "vendor_outstanding",
                header: "Outstanding",
                cell: (info) => (
                  <span className="font-black text-blue-600">
                    {money(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "overdue",
                header: "Overdue",
                cell: (info) => (
                  <span className="font-bold text-rose-400">
                    {money(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "last_activity",
                header: "Last Activity",
                cell: (info) => (
                  <span className="text-slate-400">
                    {date(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "id",
                header: "Action",
                cell: (info) => (
                  <button
                    onClick={() => setSelectedParty(info.row.original)}
                    className="text-indigo-600 font-bold hover:underline text-xs"
                  >
                    View Ledger
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* Party Accounts Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-6 flex items-center gap-2 font-black text-slate-800 uppercase text-xs tracking-widest">
            <Users size={18} className="text-indigo-600" /> Party Accounts
            (Customer + Vendor)
          </h2>
          <DataTable
            data={data?.parties || []}
            columns={[
              { accessorKey: "name", header: "Company Name" },
              {
                accessorKey: "customer_outstanding",
                header: "Customer O/S",
                cell: (info) => (
                  <span className="font-bold text-rose-600">
                    {money(info.getValue())}
                  </span>
                ),
              },
              {
                accessorKey: "vendor_outstanding",
                header: "Vendor O/S",
                cell: (info) => (
                  <span className="font-bold text-blue-600">
                    {money(info.getValue())}
                  </span>
                ),
              },
              {
                id: "net_position",
                header: "Net Position",
                cell: (info) => {
                  const row = info.row.original;
                  const net = row.customer_outstanding - row.vendor_outstanding;
                  return (
                    <span
                      className={`font-black ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {money(net)}
                    </span>
                  );
                },
              },
            ]}
            onRowClick={(e, row) => {
              console.log("Clicked Row Data:", row);
              setSelectedParty(row);
            }}
          />
        </div>
      </div>
    </ContentArea>
  );
}

function SummaryField({ label, value, color = "text-slate-900" }) {
  return (
    <div className="border-b border-slate-50 pb-2">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">
        {label}
      </div>
      <div className={`text-sm font-black ${color}`}>{value}</div>
    </div>
  );
}

function DetailItem({ label, value, highlight = "text-slate-900" }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className={`text-sm font-black ${highlight}`}>{money(value)}</span>
    </div>
  );
}
