import { useState, useEffect } from "react";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import OverviewTab from "./OverviewTab";
import RevenueAnalyticsTab from "./RevenueAnalyticsTab";
import CustomerAnalyticsTab from "./CustomerAnalyticsTab";
import RecurringAnalyticsTab from "./RecurringAnalyticsTab";
import FinanceAnalyticsTab from "./FinanceAnalyticsTab";

const tabs = [
  { id: "Overview", label: "Overview", component: OverviewTab },
  { id: "Revenue", label: "Revenue", component: RevenueAnalyticsTab },
  { id: "Customers", label: "Customers", component: CustomerAnalyticsTab },
  { id: "Recurring", label: "Recurring", component: RecurringAnalyticsTab },
  { id: "Finance", label: "Finance", component: FinanceAnalyticsTab },
];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("Overview");

  const ActiveComponent =
    tabs.find((t) => t.id === activeTab)?.component || OverviewTab;
  return (
    <ContentArea>
      <div className="flex justify-between items-start mb-6">
        <PageHeader
          title="Analytics"
          subtitle="Business Intelligence & Performance Insights"
        />
      </div>

      <div className="mb-6 flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-teal-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-700" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        <ActiveComponent />
      </div>
    </ContentArea>
  );
}
