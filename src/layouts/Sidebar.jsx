import { NavLink } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  IndianRupee,
  LayoutDashboard,
  RefreshCcw,
  Settings,
  Users,
  Wallet,
  ShoppingCart,
  Receipt,
  Landmark,
  Briefcase,
  Banknote,
  PieChart,
} from "lucide-react";
import { useState, useEffect } from "react";

const groups = [
  [
    "Workspace",
    [
      ["/", "Dashboard", Home],
      ["/admin", "Admin Panel", LayoutDashboard],
      ["/company", "Company", Building2],
      ["/customers", "Customers", Users],
      ["/vendors", "Vendors", Users], 
      ["/services", "Services", Briefcase],
      ["/gst-rates", "GST Rates", IndianRupee],
      ["/analytics", "Analytics", BarChart3],
    ],
  ],
  [
    "Billing",
    [
      ["/quotations", "Quotations", FileText],
      ["/invoices", "Invoices", Receipt],
      // ["/payments", "Payments", CreditCard],
      ["/recurring", "Recurring", RefreshCcw], 
      ["/transactions", "Transactions", Activity],
    ],
  ],
  [
    "Accounts",
    [
      ["/expenses", "Expenses", Wallet],
      ["/purchases", "Purchases", ShoppingCart],
      // ["/outgoing-payments", "Outgoing Payments", IndianRupee],
      ["/accounts", "Accounts", Landmark],
      ["/banking", "Banking", Banknote],
      ["/reports", "Reports", PieChart],
    ],
  ],
  [
    "System",
    [
      ["/users", "Users", Users],
      ["/settings", "Settings", Settings],
      ["/activity-log", "Activity Log", Activity],
    ],
  ],
];

export default function Sidebar() {
  useEffect(() => {
    const handleShortcut = (event) => {
      // ESC → TOGGLE SIDEBAR
      if (event.key === "Escape") {
        setIsCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`flex shrink-0 flex-col bg-slate-950 text-slate-100 transition-all duration-300 ${isCollapsed ? "w-16" : "w-72"}`}
    >
      <div className="border-b border-white/10 px-5 py-5 flex items-start justify-between gap-3">
        {!isCollapsed && (
          <div>
            <div className="text-lg font-semibold leading-tight">SV IT Hub</div>
            <div className="text-lg font-semibold leading-tight">Billing</div>
            <div className="mt-1 text-xs text-slate-400">
              Offline GST service management
            </div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      <nav
        className={`flex-1 overflow-auto py-4 ${isCollapsed ? "px-2" : "px-3"}`}
      >
        {groups.map(([label, items]) => (
          <div key={label} className="mb-5">
            <div
              className={` mb-2 font-semibold uppercase tracking-wider text-slate-500  ${isCollapsed ? "px-2 text-center text-[10px]" : "px-3 text-[11px]"}`}
            >
              {isCollapsed ? label.charAt(0) : label}
            </div>
            <div className="space-y-1">
              {items.map(([to, name, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `
    flex
    items-center
    rounded-md
    py-2
    text-sm
    transition-all

    ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"}

    ${
      isActive
        ? "bg-teal-600 text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }
  `
                  }
                >
                  <Icon size={17} />
                  {!isCollapsed && <span>{name}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
