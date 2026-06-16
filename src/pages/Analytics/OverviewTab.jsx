import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { money } from "../../utils/format";
import {
  TrendingUp,
  CheckCircle,
  Activity,
  Landmark,
  ShieldCheck,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    window.electronAPI.analytics
      .overview()
      .then((res) => {
        console.log("Analytics Response:", res);

        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Analytics Error:", err);

        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        Loading analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-red-500">
        Analytics data not available
      </div>
    );
  }

  const health = data?.businessHealth || {};

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: money(data.kpis.totalRevenue), icon: Landmark, color: 'text-teal-600' },
          { label: 'This Month', value: money(data.kpis.monthlyRevenue), icon: TrendingUp, color: 'text-indigo-600' },
          { label: 'Pending Payments', value: money(data.kpis.pendingPayments), icon: Clock, color: 'text-rose-600' },
          { label: 'Active Customers', value: data.kpis.activeCustomers, icon: CheckCircle, color: 'text-amber-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{kpi.value}</p>
              </div>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            Revenue vs Collection (Last 12 Months)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyRevenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }} />
                <Bar dataKey="invoiced" name="Invoiced" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="collected" name="Collected" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Cash Flow Trend (6 Months)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cashFlowTrend}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => money(v)} />
                <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#0d9488" fillOpacity={1} fill="url(#colorIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#f43f5e" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Business Health & Activity */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6">Business Health</h3>
          <div className="space-y-6">
            {[
              { label: 'Revenue Growth', value: health.revenueGrowth, unit: '%', status: health.revenueGrowth > 0 ? 'good' : 'bad' },
              { label: 'Collection Efficiency', value: health.collectionEfficiency, unit: '%', status: health.collectionEfficiency > 80 ? 'good' : 'avg' },
              { label: 'Recurring Health', value: health.recurringHealth, unit: '% Overdue', status: health.recurringHealth < 10 ? 'good' : 'bad' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-500 font-medium">{item.label}</span>
                  <span className={`font-bold ${item.status === 'good' ? 'text-emerald-600' : item.status === 'avg' ? 'text-amber-600' : 'text-rose-600'}`}>
                    {item.value?.toFixed(1)}{item.unit}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${item.status === 'good' ? 'bg-emerald-500' : item.status === 'avg' ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, item.label === 'Recurring Health' ? 100 - item.value : item.value))}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${health.gstCompliance ? 'text-emerald-500' : 'text-slate-300'}`} />
                <span className="text-xs font-medium text-slate-600">GST Compliance</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${health.cashFlowStatus ? 'text-emerald-500' : 'text-rose-500'}`} />
                <span className="text-xs font-medium text-slate-600">Cash Flow Positive</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700">Recent Invoices</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-3 font-bold">Invoice #</th>
                <th className="px-6 py-3 font-bold">Customer</th>
                <th className="px-6 py-3 font-bold text-right">Amount</th>
                <th className="px-6 py-3 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.recentActivity.invoices.map((inv) => (
                <tr key={inv.invoice_no} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-700">{inv.invoice_no}</td>
                  <td className="px-6 py-3 text-slate-600">{inv.customer}</td>
                  <td className="px-6 py-3 text-right font-bold text-slate-900">{money(inv.amount)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                      inv.status === 'partially_paid' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {inv.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}