import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { money, date } from "../../utils/format";

export default function CustomerAnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.analytics.customers().then(res => {
      setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-20 text-center text-slate-400">Loading analytics...</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: data.kpis.total },
          { label: 'Active (90d)', value: data.kpis.active },
          { label: 'New This Month', value: data.kpis.newThisMonth },
          { label: 'Inactive', value: data.kpis.inactive },
        ].map(k => (
          <div key={k.label} className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold mb-6">Customer Growth Trend</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data.growthTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="new_customers" name="New Customers" stroke="#0d9488" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold mb-6">Revenue Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" name="Customers" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-semibold text-sm">Top Customers & Behaviour</div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Total Revenue</th>
              <th className="px-6 py-3">Outstanding</th>
              <th className="px-6 py-3">Behaviour</th>
              <th className="px-6 py-3">Last Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.topCustomers.map((c, i) => (
              <tr key={i} className={`hover:bg-slate-50 ${c.pending / c.revenue > 0.3 ? 'bg-red-50/50' : ''}`}>
                <td className="px-6 py-4 font-medium text-slate-900">{c.customer}</td>
                <td className="px-6 py-4">{money(c.revenue)}</td>
                <td className="px-6 py-4 text-rose-600 font-medium">{money(c.pending)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    c.pending / c.revenue < 0.05 ? 'bg-green-100 text-green-700' :
                    c.pending / c.revenue < 0.2 ? 'bg-teal-100 text-teal-700' :
                    c.pending / c.revenue < 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {c.pending / c.revenue < 0.05 ? 'Excellent' : c.pending / c.revenue < 0.2 ? 'Good' : c.pending / c.revenue < 0.4 ? 'Average' : 'Poor'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{date(c.lastInvoice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}