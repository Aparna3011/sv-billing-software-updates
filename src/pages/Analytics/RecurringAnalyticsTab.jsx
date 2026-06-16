import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { money, date } from "../../utils/format";
import { Calendar, RefreshCcw, AlertCircle, TrendingUp } from "lucide-react";

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#f43f5e", "#8b5cf6"];

export default function RecurringAnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.analytics
      .recurring()
      .then((res) => {
        console.log("Recurring Analytics FULL:", res);

        setData(res.data || res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="py-20 text-center text-slate-400">
        Loading Recurring Insights...
      </div>
    );
  if (!data) {
    return (
      <div className="p-6 text-red-500">No recurring analytics data found</div>
    );
  }

  const kpis = data?.kpis || {};
  const forecast = data?.forecast || [];
  const cycleDistribution = data?.cycleDistribution || [];
  const overdueList = data?.overdueList || [];
  const upcomingList = data?.upcomingList || [];

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Active Plans",
            value: kpis.active || 0,
            icon: RefreshCcw,
            color: "text-teal-600",
          },
          {
            label: "Overdue Cycles",
            value: kpis.overdue || 0,
            icon: AlertCircle,
            color: "text-rose-600",
          },
          {
            label: "Due This Month",
            value: kpis.dueThisMonth || 0,
            icon: Calendar,
            color: "text-indigo-600",
          },
          {
            label: "Upcoming (30d)",
            value: kpis.upcomingRenewals || 0,
            icon: TrendingUp,
            color: "text-amber-600",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {k.label}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {k.value}
                </p>
              </div>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Revenue Forecast */}
        <div className="col-span-2 bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6">
            Subscription Revenue Forecast (12m)
          </h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={forecast}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis dataKey="month" fontSize={10} axisLine={false} />
                <YAxis
                  fontSize={10}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v / 1000}k`}
                />
                <Tooltip formatter={(v) => money(v)} />
                <Bar
                  dataKey="projected"
                  name="Projected Revenue"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cycle Distribution */}
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6">
            Billing Cycle Mix
          </h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={cycleDistribution}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {cycleDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {cycleDistribution.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="capitalize text-slate-600">
                    {item.name.replace("_", " ")}
                  </span>
                </div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Lists */}
      <div className="grid grid-cols-2 gap-6">
        {/* Overdue List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-rose-50/30">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Overdue Collections
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {data.overdueList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm italic">
                No overdue plans
              </div>
            ) : (
              overdueList.map((item) => (
                <div
                  key={item.recurring_invoice_no}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {item.customer}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter mt-0.5">
                      {item.plan_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-600">
                      {money(item.pending_amount)}
                    </p>
                    <p className="text-[10px] font-bold text-rose-400 mt-0.5">
                      {item.overdue_days} days late
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-teal-50/30">
            <h3 className="text-sm font-bold text-teal-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Renewals (30 Days)
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {data.upcomingList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm italic">
                No renewals due
              </div>
            ) : (
              upcomingList.map((item) => (
                <div
                  key={item.recurring_invoice_no}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {item.customer}
                    </p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">
                        {item.billing_cycle}
                      </span>
                      {item.auto_generate === 1 && (
                        <RefreshCcw className="w-3 h-3 text-teal-500" />
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {money(item.amount)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Due: {date(item.renewal_date)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
