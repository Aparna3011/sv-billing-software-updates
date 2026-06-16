import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { money, date } from "../../utils/format";
const COLORS = [
  "#0d9488",
  "#6366f1",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#ec4899",
];

export default function FinanceAnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.analytics.finance().then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="py-20 text-center text-slate-400">
        Loading finance analytics...
      </div>
    );

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-6">
          GST Overview
        </h2>
        <div className="grid grid-cols-2 gap-6 h-72">
          <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">
              Output vs Input Trend
            </h3>
            <ResponsiveContainer>
              <AreaChart data={data.gst.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(v) => money(v)} />
                <Area
                  type="monotone"
                  dataKey="output"
                  name="Output GST"
                  stroke="#0d9488"
                  fill="#ccfbf1"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="input"
                  name="Input GST"
                  stroke="#6366f1"
                  fill="#e0e7ff"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-6 text-xs uppercase tracking-widest">
          Expense & Bank Analytics
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-6">
              Expense Category Breakdown
            </h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.expenses.categoryBreakdown}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={5}
                  >
                    {data.expenses.categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-6">
              Current Bank Balances
            </h3>
            <div className="space-y-4">
              {data.banking.accountBalances.map((acc) => (
                <div
                  key={acc.name}
                  className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 text-sm"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {acc.name}
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {money(acc.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
