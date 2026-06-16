import Dashboard from "../pages/Dashboard/Dashboard";
import AdminPanel from "../pages/Admin/AdminPanel";
import CompanyInfo from "../pages/Company/CompanyInfo";
import CustomerList from "../pages/Customers/CustomerList";
import CustomerLedger from "../pages/Customers/CustomerLedger";
import VendorList from "../pages/Venders/VendorList";
import VendorLedger from "../pages/Venders/VendorLedger";
import ServiceList from "../pages/Services/ServiceList";
import GSTRates from "../pages/GSTRates/GSTRates";
import QuotationList from "../pages/Quotations/QuotationList";
import QuotationForm from "../pages/Quotations/QuotationForm";
import QuotationDetail from "../pages/Quotations/QuotationDetail";
import QuotationEdit from "../pages/Quotations/QuotationEdit";
import InvoiceList from "../pages/Invoices/InvoiceList";
import InvoiceForm from "../pages/Invoices/InvoiceForm";
import InvoiceEdit from "../pages/Invoices/InvoiceEdit";
import InvoiceDetail from "../pages/Invoices/InvoiceDetail";
import PaymentList from "../pages/Payments/PaymentList";
import PaymentForm from "../pages/Payments/PaymentForm";
import OutgoingPaymentList from "../pages/Payments/OutgoingPaymentList";
import RecurringList from "../pages/Recurring/RecurringList";
import RecurringForm from "../pages/Recurring/RecurringForm";
import RecurringEdit from "../pages/Recurring/RecurringEdit";
import RecurringDetails from "../pages/Recurring/RecurringDetails";
import RecurringHistory from "../pages/Recurring/RecurringHistory";
import RecurringHistoryAll from "../pages/Recurring/RecurringHistoryAll";
import ExpenseList from "../pages/Expenses/ExpenseList";
import ExpenseForm from "../pages/Expenses/ExpenseForm";
import ExpenseDetail from "../pages/Expenses/ExpenseDetail";
import PurchaseList from "../pages/Purchases/PurchaseList";
import PurchaseForm from "../pages/Purchases/PurchaseForm";
import PurchaseDetail from "../pages/Purchases/PurchaseDetail";
import AccountsDashboard from "../pages/Accounts/AccountsDashboard";
import Banking from "../pages/Accounts/Banking";
import Reports from "../pages/Reports/Reports";
import GSTReport from "../pages/Reports/GSTReport";
import RevenueReport from "../pages/Reports/RevenueReport";
import OutstandingReport from "../pages/Reports/OutstandingReport";
import CustomerLedgerReport from "../pages/Reports/CustomerLedgerReport";
import VendorLedgerReport from "../pages/Reports/VendorLedgerReport";
import CashFlowReport from "../pages/Reports/CashFlowReport";
import GSTSummaryReport from "../pages/Reports/GSTSummaryReport";
import PaymentReport from "../pages/Reports/PaymentReport";
import ExpenseReport from "../pages/Reports/ExpenseReport";
import ServiceIncomeReport from "../pages/Reports/ServiceIncomeReport";
import UserList from "../pages/Users/UserList";
import Settings from "../pages/Settings/Settings";
import BackupRestore from "../pages/Settings/BackupRestore";
import Numbering from "../pages/Settings/Numbering";
import Preferences from "../pages/Settings/Preferences";
import GstSettings from "../pages/Settings/GstSettings";
import ActivityLog from "../pages/ActivityLog/ActivityLog";
import Transactions from "../pages/Transactions/Transactions";

export default [
  { path: "/", element: Dashboard },
  { path: "admin", element: AdminPanel },
  { path: "company", element: CompanyInfo },
  { path: "customers", element: CustomerList },
  { path: "customers/:id/ledger", element: CustomerLedger },
  { path: "vendors", element: VendorList },
  { path: "vendors/:id/ledger", element: VendorLedger },
  { path: "services", element: ServiceList },
  { path: "gst-rates", element: GSTRates },
  { path: "quotations", element: QuotationList },
  { path: "quotations/new", element: QuotationForm },
  { path: "quotations/:id/edit", element: QuotationEdit },
  { path: "quotations/:id", element: QuotationDetail },
  { path: "invoices", element: InvoiceList },
  { path: "invoices/new", element: InvoiceForm },
  { path: "invoices/:id/edit", element: InvoiceEdit },
  { path: "invoices/:id", element: InvoiceDetail },
  { path: "payments", element: PaymentList },
  { path: "outgoing-payments", element: OutgoingPaymentList },
  { path: "payments/new", element: PaymentForm },
  { path: "payments/:id/edit", element: PaymentForm },
  { path: "recurring", element: RecurringList },
  { path: "recurring/history", element: RecurringHistoryAll },
  { path: "recurring/new", element: RecurringForm },
  { path: "recurring/:id/edit", element: RecurringEdit },
  { path: "recurring/:id/history", element: RecurringHistory },
  { path: "recurring/:id", element: RecurringDetails },
  { path: "expenses", element: ExpenseList },
  { path: "expenses/new", element: ExpenseForm },
  { path: "expenses/edit/:id", element: ExpenseForm },
  { path: "expenses/:id", element: ExpenseDetail },
  { path: "purchases", element: PurchaseList },
  { path: "purchases/new", element: PurchaseForm },
  { path: "purchases/edit/:id", element: PurchaseForm },
  { path: "purchases/:id", element: PurchaseDetail },
  { path: "accounts", element: AccountsDashboard },
  { path: "banking", element: Banking },
  { path: "reports", element: Reports },
  { path: "reports/gst", element: GSTReport },
  { path: "reports/revenue", element: RevenueReport },
  { path: "reports/outstanding", element: OutstandingReport },
  { path: "reports/customer-ledger", element: CustomerLedgerReport },
  { path: "reports/vendor-ledger", element: VendorLedgerReport },
  { path: "reports/cash-flow", element: CashFlowReport },
  { path: "reports/gst-summary", element: GSTSummaryReport },
  { path: "reports/payments", element: PaymentReport },
  { path: "reports/expenses", element: ExpenseReport },
  { path: "reports/service-income", element: ServiceIncomeReport },
  { path: "users", element: UserList },
  { path: "settings", element: Settings },
  { path: "settings/backup", element: BackupRestore },
  { path: "settings/numbering", element: Numbering },
  { path: "settings/preferences", element: Preferences },
  { path: "activity-log", element: ActivityLog },
  { path: "transactions", element: Transactions },
  { path: "settings/gst", element: GstSettings },
];
