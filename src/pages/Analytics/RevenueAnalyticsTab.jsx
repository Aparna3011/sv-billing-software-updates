import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { money } from '../../utils/format';

const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];

export default function RevenueAnalyticsTab() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    window.electronAPI.analytics.revenue({ period }).then(res => setData(res.data));
  }, [period]);

  if (!data) return <div className="py-20 text-center text-slate-400">Loading Revenue Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        {['month', 'quarter', 'year', 'all'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${period === p ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white p-6 border border-slate-200 rounded-xl">
          <h3 className="text-sm font-semibold mb-6">Revenue by Service (Top 10)</h3>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart layout="vertical" data={data.byService}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="service" type="category" width={140} fontSize={10} />
                <Tooltip formatter={v => money(v)} />
                <Bar dataKey="revenue" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-xl">
          <h3 className="text-sm font-semibold mb-6">Invoice Status Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.statusDistribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.statusDistribution.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-xs uppercase">Top 10 Customers By Revenue</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2 text-right">Invoices</th>
              <th className="px-4 py-2 text-right">Total Revenue</th>
              <th className="px-4 py-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.topCustomers.map((c, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{c.customer}</td>
                <td className="px-4 py-3 text-right">{c.invoices}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(c.revenue)}</td>
                <td className="px-4 py-3 text-right text-red-600">{money(c.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}