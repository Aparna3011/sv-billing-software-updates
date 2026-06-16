import { useEffect, useMemo, useState } from "react";
import toast from "@utils/notify";
import GenericResourcePage from "../_shared/GenericResourcePage";
import ContentArea from "../../components/layout/ContentArea";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/tables/DataTable";
import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextarea";
import Modal from "../../components/modals/Modal";
import ConfirmationModal from "../../components/modals/ConfirmationModal";
import ReportExportButtons from "../../components/reports/ReportExportButtons";
import { getDefaultBankAccountId } from "../../utils/banking";
import { modules, call } from "../../utils/api";
import { date, money } from "../../utils/format";
import {
  Landmark,
  Wallet,
  ArrowLeftRight,
  History,
  BookOpen,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Settings2,
  Eye,
  RefreshCcw,
  LayoutDashboard,
  PieChart,
  Settings,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Pencil,
  Trash2,
  Search,
  X,
  List,
  User,
  Building,
  Clock,
  Settings as SettingsIcon,
} from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

const initialBankingEntry = {
  id: null,
  type: "payment", // payment, receipt, contra
  reference_type: "purchase",
  transaction_date: today,
  bank_account_id: "",
  to_account_id: "",
  party_key: "",
  party_name: "",
  customer_id: "",
  vendor_id: "",
  invoice_id: "",
  recurring_invoice_id: "",
  purchase_id: "",
  category_id: "",
  category: "Miscellaneous",
  amount: 0,
  mode: "bank_transfer",
  reference_no: "",
  cheque_no: "",
  notes: "",
};

export default function Banking() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({});
  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [isEntryModalOpen, setEntryModalOpen] = useState(false);
  const [isTransferModalOpen, setTransferModalOpen] = useState(false);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState(null);
  const [deleteCategory, setDeleteCategory] = useState(null);
  const [deleteTransaction, setDeleteTransaction] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [partySearch, setPartySearch] = useState("");
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const [bankingSettings, setBankingSettings] = useState({
    default_cash_account_id: "",
    default_bank_account_id: "",
    default_balance_type: "Debit",
    auto_create_cash_account: true,
    allow_negative_balance: false,
    require_narration: false,
  });

  const [categories, setCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "Expense",
    description: "",
    is_active: true,
    is_system: 0,
  });

  const [reportType, setReportType] = useState("statement"); // statement, cashflow, daybook
  const [reportData, setReportData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    bank_account_id: "",
    from_date: "",
    to_date: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState({
    type: "All",
    search: "",
  });

  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    bank_account_id: "",
    voucher_type: "All", // Payment, Receipt, Contra
    search: "",
    show_deleted: false,
  });

  const [ledgerFilters, setLedgerFilters] = useState({
    bank_account_id: "",
    from_date: "",
    to_date: "",
  });

  const [transfer, setTransfer] = useState({
    transaction_date: today,
    from_account_id: "",
    to_account_id: "",
    amount: 0,
    reference_no: "",
    notes: "",
  });

  const [newAccount, setNewAccount] = useState({
    account_name: "",
    bank_name: "",
    account_no: "",
    branch_name: "",
    ifsc: "",
    account_type: "Current",
    opening_balance: 0,
  });

  const [bankingEntry, setBankingEntry] = useState({
    ...initialBankingEntry,
  });
  const [lookupData, setLookupData] = useState({
    customers: [],
    vendors: [],
    invoices: [],
    purchases: [],
    expenses: [],
    recurringHistory: [],
    expenseCategories: [],
    incomeCategories: [],
  });

  const partyOptions = useMemo(() => {
    const options = [];

    if (bankingEntry.type === "receipt") {
      // For receipts, only show customers
      options.push(
        ...lookupData.customers.map((row) => ({
          key: `customer:${row.id}`,
          type: "customer",
          id: row.id,
          name: row.company_name,
          label: `${row.company_name} - Customer`,
        })),
      );
    } else if (bankingEntry.type === "payment") {
      // For payments, show vendors and recent/ad-hoc parties
      options.push(
        ...lookupData.vendors.map((row) => ({
          key: `vendor:${row.id}`,
          type: "vendor",
          id: row.id,
          name: row.company_name,
          label: `${row.company_name} - Vendor`,
        })),
      );

      // Add recent parties only for standalone expenses/payments
      if (
        bankingEntry.reference_type === "expense" ||
        bankingEntry.reference_type === "standalone"
      ) {
        const recent = transactions
          .map((row) =>
            String(row.notes || "")
              .match(/Party:\s*([^|]+)/)?.[1]
              ?.trim(),
          )
          .filter(Boolean)
          .filter(
            (name, index, names) =>
              names.findIndex(
                (item) => item.toLowerCase() === name.toLowerCase(),
              ) === index,
          )
          .slice(0, 8)
          .map((name) => ({
            key: `recent:${name}`,
            type: "recent",
            id: "",
            name,
            label: `${name} - Recent`,
          }));
        options.push(...recent);
      }
    }
    return options;
  }, [
    lookupData.customers,
    lookupData.vendors,
    transactions,
    bankingEntry.type,
    bankingEntry.reference_type,
  ]);

  const filteredParties = useMemo(() => {
    const term = partySearch.toLowerCase();
    const filtered = term
      ? partyOptions.filter((p) => p.name.toLowerCase().includes(term))
      : partyOptions;

    return {
      customers: filtered.filter((p) => p.type === "customer"),
      vendors: filtered.filter((p) => p.type === "vendor"),
      recent: filtered.filter((p) => p.type === "recent"),
    };
  }, [partyOptions, partySearch]);

  const filteredCategories = useMemo(() => {
    const isReceipt = bankingEntry.type === "receipt";
    const list = isReceipt
      ? lookupData?.incomeCategories || []
      : lookupData?.expenseCategories || [];

    const term = categorySearch.toLowerCase().trim();
    const filtered = term
      ? list.filter((c) => c.name.toLowerCase().includes(term))
      : list;

    const exactMatch = list.find((c) => c.name.toLowerCase() === term);
    const showCreate = term && !exactMatch;

    return {
      existing: filtered,
      showCreate,
      createName: categorySearch.trim(),
    };
  }, [categorySearch, lookupData, bankingEntry.type]);

  const latestRecurringRows = useMemo(() => {
    const map = new Map();
    lookupData.recurringHistory.forEach((row) => {
      if (!map.has(row.recurring_invoice_id))
        map.set(row.recurring_invoice_id, row);
    });
    return Array.from(map.values());
  }, [lookupData.recurringHistory]);

  const selectableInvoices = useMemo(
    () =>
      lookupData.invoices.filter(
        (row) =>
          (Number(row.balance_due || 0) > 0 ||
            Number(row.id) === Number(bankingEntry.invoice_id)) &&
          (!bankingEntry.customer_id ||
            Number(row.customer_id) === Number(bankingEntry.customer_id)),
      ),
    [lookupData.invoices, bankingEntry.customer_id, bankingEntry.invoice_id],
  );

  const selectableRecurring = useMemo(
    () =>
      latestRecurringRows.filter(
        (row) =>
          (Number(row.pending_amount || 0) > 0 ||
            Number(row.recurring_invoice_id) ===
              Number(bankingEntry.recurring_invoice_id)) &&
          (!bankingEntry.customer_id ||
            Number(row.customer_id) === Number(bankingEntry.customer_id)),
      ),
    [
      latestRecurringRows,
      bankingEntry.customer_id,
      bankingEntry.recurring_invoice_id,
    ],
  );

  const selectablePurchases = useMemo(
    () =>
      lookupData.purchases.filter(
        (row) =>
          (Number(row.balance_due || 0) > 0 ||
            Number(row.id) === Number(bankingEntry.purchase_id)) &&
          (!bankingEntry.vendor_id ||
            Number(row.vendor_id) === Number(bankingEntry.vendor_id)),
      ),
    [lookupData.purchases, bankingEntry.vendor_id, bankingEntry.purchase_id],
  );

  const selectableExpenses = useMemo(
    () =>
      (lookupData.expenses || []).filter(
        (row) =>
          (Number(row.balance_due || 0) > 0 ||
            row.status !== "paid" ||
            Number(row.id) === Number(bankingEntry.expense_id)) &&
          (!bankingEntry.vendor_id ||
            Number(row.vendor_id) === Number(bankingEntry.vendor_id)),
      ),
    [lookupData.expenses, bankingEntry.vendor_id, bankingEntry.expense_id],
  );

  function updateBankingEntry(updates) {
    setBankingEntry((prev) => ({ ...prev, ...updates }));
  }

  function setEntryType(type) {
    const reference_type =
      type === "receipt"
        ? "invoice"
        : type === "payment"
          ? "purchase"
          : "standalone";
    const defaultBankId = getDefaultBankAccountId(accounts);

    setBankingEntry({
      ...initialBankingEntry,
      type,
      reference_type,
      transaction_date: bankingEntry.transaction_date,
      bank_account_id: defaultBankId,
    });
    setCategorySearch("");
    setIsCategoryDropdownOpen(false);
  }

  function handlePartyChange(value) {
    const option = partyOptions.find((item) => item.key === value);
    if (!option) {
      updateBankingEntry({
        party_key: "",
        party_name: value,
        customer_id: "",
        vendor_id: "",
        invoice_id: "",
        recurring_invoice_id: "",
        purchase_id: "",
      });
      return;
    }
    updateBankingEntry({
      party_key: option.key,
      party_name: option.name,
      customer_id: option.type === "customer" ? option.id : "",
      vendor_id: option.type === "vendor" ? option.id : "",
      invoice_id: "",
      recurring_invoice_id: "",
      purchase_id: "",
      category_id: "",
      category: "",
    });
    setPartySearch("");
    setIsPartyDropdownOpen(false);
  }

  async function handleCategorySelection(option) {
    if (option.isNew) {
      if (!option.name.trim()) return;
      const toastId = toast.loading(`Creating category "${option.name}"...`);
      try {
        const isReceipt = bankingEntry.type === "receipt";
        const targetModule = isReceipt
          ? modules.incomeCategories
          : modules.expenseCategories;
        const newCat = await targetModule.create({
          name: option.name.trim(),
          is_active: true,
          description: "Created via banking entry",
        });
        toast.success("Category created", { id: toastId });
        await load();
        updateBankingEntry({
          category_id: newCat.id,
          category: newCat.name,
        });
      } catch (err) {
        toast.error(err.message, { id: toastId });
      }
    } else {
      updateBankingEntry({
        category_id: option.id,
        category: option.name,
      });
    }
    setCategorySearch("");
    setIsCategoryDropdownOpen(false);
  }

  // Filter transactions based on UI requirements
  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.reference_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.account_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFromDate =
        !filters.from_date || t.transaction_date >= filters.from_date;
      const matchesToDate =
        !filters.to_date || t.transaction_date <= filters.to_date;
      const matchesBank =
        !filters.bank_account_id ||
        Number(t.bank_account_id) === Number(filters.bank_account_id);
      const matchesVoucher =
        filters.voucher_type === "All" ||
        String(t.voucher_type || "").toUpperCase() ===
          String(filters.voucher_type).toUpperCase();

      return (
        matchesSearch &&
        matchesFromDate &&
        matchesToDate &&
        matchesBank &&
        matchesVoucher
      );
    });

    return filtered;
  }, [transactions, searchQuery, filters]);

  // Statistics for categories
  const catStats = useMemo(
    () => ({
      total:
        (lookupData?.expenseCategories?.length ?? 0) +
        (lookupData?.incomeCategories?.length ?? 0),
      expense: lookupData?.expenseCategories?.length ?? 0,
      income: lookupData?.incomeCategories?.length ?? 0,
    }),
    [lookupData?.expenseCategories, lookupData?.incomeCategories],
  );

  async function load(nextFilters = filters, nextCatFilters = categoryFilters) {
    try {
      // Initialize default cash account if missing
      await modules.bankAccounts.ensureDefaultCash();
      await modules.expenseCategories.ensureDefaults();
    } catch (e) {
      console.warn("Cash initialization skipped:", e.message);
    }

    try {
      const [
        accountRowsRaw,
        dashboardRaw,
        allSettingsRaw,
        customersRaw,
        vendorsRaw,
        invoicesRaw,
        purchasesRaw,
        recurringHistoryRaw,
        expensesRaw, // Fetch expenses
        expenseCatsRaw,
        incomeCatsRaw,
      ] = await Promise.all([
        modules.bankAccounts?.list?.() || [],
        modules.bankTransactions?.dashboard?.(nextFilters) || {},
        modules.settings?.list?.() || [],
        modules.customers?.list?.() || [],
        modules.vendors?.list?.() || [],
        modules.invoices?.list?.() || [],
        modules.purchases?.list?.() || [],
        modules.recurring?.historyAll?.() || [],
        modules.expenses?.list?.() || [], // Fetch expenses
        modules.expenseCategories?.list?.() || [],
        modules.incomeCategories?.list?.() || [],
      ]);

      // Requirement 6 & 7: Normalize response shapes (handles both array and {list: []} formats)
      const accountRows = Array.isArray(accountRowsRaw)
        ? accountRowsRaw
        : accountRowsRaw?.list || [];
      const dashboard = dashboardRaw || {};
      const allSettings = Array.isArray(allSettingsRaw)
        ? allSettingsRaw
        : allSettingsRaw?.list || [];
      const customers = Array.isArray(customersRaw)
        ? customersRaw
        : customersRaw?.list || [];
      const vendors = Array.isArray(vendorsRaw)
        ? vendorsRaw
        : vendorsRaw?.list || [];
      const invoices = Array.isArray(invoicesRaw)
        ? invoicesRaw
        : invoicesRaw?.list || [];
      const purchases = Array.isArray(purchasesRaw)
        ? purchasesRaw
        : purchasesRaw?.list || [];
      const expenses = Array.isArray(expensesRaw)
        ? expensesRaw
        : expensesRaw?.list || [];
      const recurringHistory = Array.isArray(recurringHistoryRaw)
        ? recurringHistoryRaw
        : recurringHistoryRaw?.list || [];
      const expenseCategoriesList = (
        Array.isArray(expenseCatsRaw)
          ? expenseCatsRaw
          : expenseCatsRaw?.list || []
      ).map((c) => ({ ...c, type: "Expense" }));
      const incomeCategoriesRows = (
        Array.isArray(incomeCatsRaw) ? incomeCatsRaw : incomeCatsRaw?.list || []
      ).map((c) => ({ ...c, type: "Income" }));

      setAccounts(accountRows);
      setSummary(dashboard);
      setTransactions(dashboard.transactions || []);

      // Requirement 8: Populate lookupData with fallbacks
      setLookupData({
        customers,
        vendors,
        invoices,
        purchases,
        expenses, // Add expenses to lookupData
        recurringHistory,
        expenseCategories: expenseCategoriesList,
        incomeCategories: incomeCategoriesRows,
      });

      // Load Banking Preferences
      const prefsEntry = allSettings.find(
        (s) => s.key === "banking_preferences",
      );
      if (prefsEntry) {
        try {
          setBankingSettings(JSON.parse(prefsEntry.value));
        } catch (e) {
          console.error("Failed to parse banking preferences:", e);
        }
      }

      setIncomeCategories(incomeCategoriesRows);

      // Apply filters for display
      let filteredIncomes = incomeCategoriesRows;
      if (nextCatFilters.search?.trim()) {
        const s = nextCatFilters.search.toLowerCase();
        filteredIncomes = filteredIncomes.filter((c) =>
          c.name.toLowerCase().includes(s),
        );
      }
      if (nextCatFilters.type !== "All" && nextCatFilters.type !== "Income") {
        filteredIncomes = [];
      }

      let filteredCats = expenseCategoriesList;
      if (nextCatFilters.type !== "All") {
        filteredCats = filteredCats.filter(
          (c) => c.type === nextCatFilters.type,
        );
      }
      if (nextCatFilters.search?.trim()) {
        const s = nextCatFilters.search.toLowerCase();
        filteredCats = filteredCats.filter(
          (c) =>
            c.name.toLowerCase().includes(s) ||
            (c.description || "").toLowerCase().includes(s),
        );
      }
      setCategories(filteredCats);
      setIncomeCategories(filteredIncomes);
    } catch (error) {
      console.error("Critical Render Error in load():", error);
      console.trace();
      toast.error("Error loading banking data: " + error.message);
    }
  }

  useEffect(() => {
    load().catch((error) => {
      console.error("Effect Load Error:", error);
    });
  }, []);

  async function handleBankingEntry(event) {
    event.preventDefault();
    if (bankingSettings.require_narration && !bankingEntry.notes?.trim()) {
      return toast.error("Please enter narration before saving.");
    }

    // Validation: Prevent accidental mapping where Party and Narration are the same
    if (
      bankingEntry.party_name &&
      bankingEntry.notes &&
      bankingEntry.party_name.trim().toLowerCase() ===
        bankingEntry.notes.trim().toLowerCase()
    ) {
      return toast.error("Narration cannot be the same as the Party name.");
    }

    if (!bankingEntry.bank_account_id)
      return toast.error("Please select a bank account");
    if (Number(bankingEntry.amount) <= 0)
      return toast.error("Amount must be greater than zero");

    if (bankingEntry.type === "contra" && !bankingEntry.to_account_id) {
      return toast.error("Please select the destination account");
    }

    if (
      bankingEntry.type === "receipt" &&
      bankingEntry.reference_type === "invoice" &&
      !bankingEntry.invoice_id
    )
      return toast.error("Please select an invoice");
    if (
      bankingEntry.type === "receipt" &&
      bankingEntry.reference_type === "recurring" &&
      !bankingEntry.recurring_invoice_id
    ) {
      return toast.error("Please select a recurring plan");
    }
    if (
      bankingEntry.type === "payment" &&
      bankingEntry.reference_type === "purchase" &&
      !bankingEntry.purchase_id
    ) {
      return toast.error("Please select a purchase");
    }
    // Validate category for standalone entries
    if (
      bankingEntry.type !== "contra" &&
      (bankingEntry.reference_type === "standalone" ||
        bankingEntry.reference_type === "expense") &&
      !bankingEntry.category_id
    ) {
      return toast.error("Please select a category");
    }

    const toastId = toast.loading("Saving entry...");
    try {
      if (bankingEntry.id) {
        // Edit existing transaction
        await call("bankTransactions:update", {
          id: bankingEntry.id,
          transaction_date: bankingEntry.transaction_date,
          bank_account_id: Number(bankingEntry.bank_account_id),
          to_account_id: bankingEntry.type === 'contra' ? Number(bankingEntry.to_account_id) : null,
          amount: Number(bankingEntry.amount),
          reference_no: bankingEntry.reference_no,
          customer_id: bankingEntry.customer_id,
          vendor_id: bankingEntry.vendor_id,
          notes: `Party: ${bankingEntry.party_name} | ${bankingEntry.notes}`,
          type: bankingEntry.type === "receipt" ? "credit" : "debit",
          category_id: bankingEntry.category_id,
          mode: bankingEntry.mode,
        });
      } else {
        // Create new entry
        await modules.banking.recordEntry({
          ...bankingEntry,
          bank_account_id: Number(bankingEntry.bank_account_id),
          to_account_id: bankingEntry.to_account_id
            ? Number(bankingEntry.to_account_id)
            : null,
          customer_id: bankingEntry.customer_id
            ? Number(bankingEntry.customer_id)
            : null,
          vendor_id: bankingEntry.vendor_id
            ? Number(bankingEntry.vendor_id)
            : null,
          invoice_id: bankingEntry.invoice_id
            ? Number(bankingEntry.invoice_id)
            : null,
          recurring_invoice_id: bankingEntry.recurring_invoice_id
            ? Number(bankingEntry.recurring_invoice_id)
            : null,
          purchase_id: bankingEntry.purchase_id
            ? Number(bankingEntry.purchase_id)
            : null,
          category_id: bankingEntry.category_id
            ? Number(bankingEntry.category_id)
            : null,
          amount: Number(bankingEntry.amount),
        });
      }
      toast.success("Banking entry saved", { id: toastId });
      setBankingEntry({
        ...initialBankingEntry,
        transaction_date: today, // Keep current date
        bank_account_id: bankingEntry.bank_account_id, // Keep selected bank account
      });
      setEntryModalOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function handleCreateAccount(event) {
    event.preventDefault();
    try {
      await modules.bankAccounts.create(newAccount);
      toast.success("Bank account created");
      setAccountModalOpen(false);
      setNewAccount({
        account_name: "",
        bank_name: "",
        account_no: "",
        branch_name: "",
        ifsc: "",
        account_type: "Current",
        opening_balance: 0,
      });
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleTransfer(event) {
    event.preventDefault();
    if (bankingSettings.require_narration && !transfer.notes?.trim()) {
      return toast.error("Please enter narration before saving.");
    }

    if (!transfer.from_account_id || !transfer.to_account_id) {
      return toast.error("Please select source and destination accounts");
    }
    if (transfer.from_account_id === transfer.to_account_id) {
      return toast.error("Source and destination accounts cannot be the same");
    }
    if (Number(transfer.amount) <= 0) {
      return toast.error("Amount must be greater than zero");
    }

    try {
      await modules.bankTransactions.transfer({
        ...transfer,
        from_account_id: Number(transfer.from_account_id),
        to_account_id: Number(transfer.to_account_id),
        amount: Number(transfer.amount),
      });
      toast.success("Fund transfer completed");
      setTransfer({
        transaction_date: today,
        from_account_id: "",
        to_account_id: "",
        amount: 0,
        reference_no: "",
        notes: "",
      });
      setTransferModalOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleGenerateReport() {
    if (reportType !== "daybook" && !reportFilters.bank_account_id) {
      return toast.error("Please select a bank account");
    }
    if (!reportFilters.from_date) {
      return toast.error("Please select a starting date");
    }
    if (!reportFilters.to_date) {
      return toast.error("Please select an ending date");
    }

    setIsGenerating(true);
    try {
      let data = null;
      if (reportType === "statement") {
        data = await modules.bankTransactions.list({
          bank_account_id: reportFilters.bank_account_id,
          from_date: reportFilters.from_date,
          to_date: reportFilters.to_date,
        });
      } else if (reportType === "cashflow") {
        data = await modules.reports.cashFlow(reportFilters);
      } else if (reportType === "daybook") {
        data = await modules.bankTransactions.list({
          from_date: reportFilters.from_date,
          to_date: reportFilters.to_date,
        });
      }
      setReportData(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveSettings() {
    const toastId = toast.loading("Saving preferences...");
    try {
      await modules.settings.set({
        key: "banking_preferences",
        value: JSON.stringify(bankingSettings),
      });
      toast.success("Banking preferences updated", { id: toastId });
      await load();
    } catch (e) {
      toast.error(e.message, { id: toastId });
    }
  }

  async function handleSaveCategory(event) {
    event.preventDefault();
    if (!categoryForm.name?.trim())
      return toast.error("Category name is required");
    if (!categoryForm.type?.trim())
      return toast.error("Category type is required");

    try {
      const targetModule =
        categoryForm.type === "Income"
          ? modules.incomeCategories
          : modules.expenseCategories;

      if (!targetModule) {
        throw new Error(
          `API Module for ${categoryForm.type} categories is not initialized.`,
        );
      }

      if (categoryForm.id) {
        await targetModule.update(categoryForm.id, categoryForm);
      } else {
        await targetModule.create(categoryForm);
      }

      toast.success("Transaction category saved");
      setCategoryModalOpen(false);
      setCategoryForm({
        name: "",
        type: "Expense",
        description: "",
        is_active: true,
        is_system: 0,
      });
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCategory) return;

    setIsDeleting(true);
    try {
      const targetModule =
        deleteCategory.type === "Income"
          ? modules.incomeCategories
          : modules.expenseCategories;

      await targetModule.delete(deleteCategory.id);
      toast.success("Category deleted successfully");
      setDeleteCategory(null);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteTransaction() {
    if (!deleteTransaction) return;
    setIsDeleting(true);
    try {
      await call("bankTransactions:delete", { id: deleteTransaction.id });
      toast.success("Transaction moved to recycle bin");
      setDeleteTransaction(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRestoreTransaction(row) {
    try {
      await call("bankTransactions:restore", { id: row.id });
      toast.success("Transaction restored successfully");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function handleEditTransaction(row) {
    const typeMap = {
      CONTRA: "contra",
      RECEIPT: "receipt",
      PAYMENT: "payment",
    };

    const refTypeMap = {
      expense: "expense",
      expense_payment: "expense",
      customer_payment: "invoice",
      purchase_payment: "purchase",
      transfer: "standalone",
      manual_adjustment: "standalone",
    };

    const notesParts = (row.notes || "").split("|");
    const partyName =
      row.customer_name ||
      row.vendor_name ||
      notesParts[0]?.replace("Party: ", "").trim() ||
      "";
    let cleanNotes = notesParts[1]?.trim() || "";

    // Fix: Extract narration for Contra entries which use ". " separator instead of "|"
    if (!cleanNotes && (row.source_type === "transfer" || typeMap[row.voucher_type] === "contra")) {
      const contraParts = (row.notes || "").split(". ");
      if (contraParts.length > 1) {
        cleanNotes = contraParts.slice(1).join(". ").trim();
      }
    }

    // Requirement 6: Remove generic fallback notes if document exists
    const isGenericNote = [
      "Invoice payment received from banking",
      "Recurring payment received from banking",
      "Purchase payment from banking",
      "Expense payment from banking",
      "Standalone receipt recorded from banking",
      "Standalone payment recorded from banking",
    ].includes(cleanNotes);

    if (isGenericNote) cleanNotes = "";

    // Requirement: Identify the sibling destination account for Contra entries
    let to_account_id = "";
    if (row.source_type === "transfer" || typeMap[row.voucher_type] === "contra") {
      const sibling = transactions.find(
        (t) =>
          t.source_type === "transfer" &&
          t.reference_no === row.reference_no &&
          t.amount === row.amount &&
          t.transaction_date === row.transaction_date &&
          t.id !== row.id,
      );
      if (sibling) to_account_id = sibling.bank_account_id;
    }

    let reference_type = refTypeMap[row.source_type] || "standalone";

    // Dynamically detect recurring plans for customer receipts
    if (row.source_type === "customer_payment" && row.recurring_invoice_id) {
      reference_type = "recurring";
    }

    setBankingEntry({
      id: row.id,
      type: typeMap[row.voucher_type] || "payment",
      reference_type,
      transaction_date: row.transaction_date,
      bank_account_id: row.bank_account_id,
      to_account_id: to_account_id,
      customer_id: row.customer_id || "",
      vendor_id: row.vendor_id || "",
      invoice_id: row.invoice_id || "",
      recurring_invoice_id: row.recurring_invoice_id || "",
      expense_id: row.expense_id || "", // Populate expense_id for editing
      purchase_id: row.purchase_id || "",
      party_name: partyName,
      amount: row.amount,
      reference_no: row.reference_no,
      category_id: row.category_id || "",
      mode: row.mode || "bank_transfer",
      notes: cleanNotes,
    });
    setEntryModalOpen(true);
  }

  const exportRows = useMemo(
    () =>
      (transactions || []).map((row) => ({
        transaction_date: date(row.transaction_date),
        reference_no: row.reference_no,
        description: row.notes || row.transaction_label || "",
        debit: money(row.debit),
        credit: money(row.credit),
        balance_after: money(row.balance_after),
      })),
    [transactions],
  );

  const reportExportRows = useMemo(() => {
    if (!reportData) return [];
    const entries = Array.isArray(reportData)
      ? reportData
      : reportData?.transactions || reportData?.entries || [];
    if (!Array.isArray(entries)) return [];

    return entries.map((row) => ({
      date: date(row.transaction_date || row.date),
      ref: row.reference_no || "Auto",
      type:
        row.transaction_label ||
        row.source ||
        (row.type === "credit" ? "Receipt" : "Payment"),
      account: row.account_name || row.account || "",
      amount: money(row.amount || row.inflow - (row.outflow || 0)),
      debit: money(row.debit || row.outflow),
      credit: money(row.credit || row.inflow),
      balance: money(row.balance_after || row.balance),
    }));
  }, [reportData]);

  const reportExportColumns = {
    statement: [
      { key: "date", label: "Date" },
      { key: "ref", label: "Reference" },
      { key: "type", label: "Description" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
      { key: "balance", label: "Balance" },
    ],
    cashflow: [
      { key: "date", label: "Date" },
      { key: "account", label: "Account" },
      { key: "type", label: "Type" },
      { key: "credit", label: "Inflow" },
      { key: "debit", label: "Outflow" },
    ],
    daybook: [
      { key: "date", label: "Date" },
      { key: "ref", label: "Voucher No" },
      { key: "type", label: "Type" },
      { key: "account", label: "Account" },
      { key: "amount", label: "Amount" },
    ],
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: History },
    { id: "reports", label: "Reports", icon: PieChart },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <ContentArea>
      <PageHeader
        title="Banking & Cash Management"
        subtitle="Manage bank accounts, transactions, and reconciliation"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTransfer({
                  ...transfer,
                  transaction_date: today,
                  from_account_id: getDefaultBankAccountId(accounts),
                });
                setTransferModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <ArrowLeftRight size={18} />
              Transfer Money
            </button>
            <button
              onClick={() => {
                setBankingEntry({
                  ...initialBankingEntry,
                  transaction_date: today,
                  bank_account_id: getDefaultBankAccountId(accounts),
                });
                setEntryModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <Settings2 size={18} />
              Manual Adjustment
            </button>
          </div>
        }
      />

      {activeTab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">
                Total Balance
              </p>
              <h3 className="text-3xl font-bold text-emerald-600">
                {money(summary.totalBankBalance)}
              </h3>
            </div>
            <div className="bg-emerald-50 p-4 rounded-full text-emerald-600">
              <Wallet size={28} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">
                Bank Accounts
              </p>
              <h3 className="text-3xl font-bold text-slate-900">
                {accounts?.length || 0}
              </h3>
            </div>
            <div className="bg-blue-50 p-4 rounded-full text-blue-600">
              <FileText size={28} />
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mt-8 border-b border-slate-200">
        <nav className="-mb-px flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "dashboard" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Landmark size={20} className="text-slate-400" />
                Bank Accounts
              </h3>
              <button
                onClick={() => setAccountModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 shadow-sm"
              >
                <Plus size={18} />
                Add Account
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Account Name</th>
                    <th className="px-6 py-4">Bank Name</th>
                    <th className="px-6 py-4">Account Number</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts?.map((acc) => (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-50/80 group cursor-pointer transition-colors focus:bg-slate-50 outline-none active:bg-slate-100"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setAccountModalOpen(true);
                      }}
                      onClick={(e) => {
                        const isInteractive = e.target.closest(
                          "button, a, input, select, textarea, svg, [role='button'], .action-cell",
                        );
                        if (isInteractive) return;

                        setAccountModalOpen(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {acc.account_name}
                        </div>
                        {acc.is_default ? (
                          <span className="text-[10px] text-teal-600 font-bold uppercase tracking-tighter">
                            Default
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {acc.bank_name}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono">
                        {acc.account_no}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${acc.account_type === "Cash" ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"}`}
                        >
                          {acc.account_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-teal-700">
                        {money(acc.current_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "transactions" && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Transactions
                </h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit">
                  <button
                    onClick={() => {
                      const f = { ...filters, show_deleted: false };
                      setFilters(f);
                      load(f);
                    }}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${!filters.show_deleted ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => {
                      const f = { ...filters, show_deleted: true };
                      setFilters(f);
                      load(f);
                    }}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${filters.show_deleted ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}
                  >
                    Recycle Bin
                  </button>
                </div>
              </div>
              {!filters.show_deleted && (
                <button
                  onClick={() => {
                    setBankingEntry({
                      ...initialBankingEntry,
                      transaction_date: today,
                      bank_account_id: getDefaultBankAccountId(accounts),
                    });
                    setEntryModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2 text-sm font-bold text-white hover:bg-teal-700 shadow-sm transition-all active:scale-95"
                >
                  <Plus size={18} />
                  New Transaction
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="p-4 bg-white border-b border-slate-100 grid grid-cols-5 gap-4 items-end">
              <FormInput
                label="Start Date"
                type="date"
                value={filters.from_date}
                onChange={(e) =>
                  setFilters({ ...filters, from_date: e.target.value })
                }
              />
              <FormInput
                label="End Date"
                type="date"
                value={filters.to_date}
                onChange={(e) =>
                  setFilters({ ...filters, to_date: e.target.value })
                }
              />
              <FormSelect
                label="Bank Account"
                value={filters.bank_account_id}
                onChange={(e) =>
                  setFilters({ ...filters, bank_account_id: e.target.value })
                }
              >
                <option value="">All Banks</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                  </option>
                ))}
              </FormSelect>
              <FormSelect
                label="Voucher Type"
                value={filters.voucher_type}
                onChange={(e) =>
                  setFilters({ ...filters, voucher_type: e.target.value })
                }
              >
                <option value="All">All Types</option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="Contra">Contra</option>
              </FormSelect>
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Search
                </label>
                <Search
                  className="absolute left-3 bottom-2.5 text-slate-400"
                  size={16}
                />
                <input
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Search voucher, party..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <DataTable
              data={filteredTransactions}
              onRowClick={(event, row) => {
                const isInteractive = event?.target?.closest(
                  "button, a, input, select, textarea, svg, [role='button'], .action-cell",
                );
                if (isInteractive) return;
                setViewingTransaction(row);
              }}
              columns={[
                {
                  accessorKey: "transaction_date",
                  header: "Date",
                  cell: (info) => (
                    <span className="text-slate-600">
                      {date(info.getValue())}
                    </span>
                  ),
                },
                {
                  accessorKey: "voucher_no",
                  header: "Voucher No",
                  cell: (info) => (
                    <span className="font-mono text-teal-600 font-medium">
                      {info.getValue() ||
                        info.row.original.reference_no ||
                        "Auto"}
                    </span>
                  ),
                },
                {
                  accessorKey: "voucher_type",
                  header: "Type",
                  cell: (info) => {
                    const type = info.getValue();
                    const colorMap = {
                      RECEIPT: "bg-emerald-50 text-emerald-600",
                      PAYMENT: "bg-red-50 text-red-600",
                      CONTRA: "bg-blue-50 text-blue-600",
                      REVERSAL: "bg-rose-50 text-rose-600",
                    };
                    return (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colorMap[type] || "bg-slate-50 text-slate-600"}`}
                      >
                        {type}
                      </span>
                    );
                  },
                },
                {
                  accessorKey: "notes",
                  header: "Party",
                  cell: (info) => {
                    const row = info.row.original;

                    if (row.source_type === "customer_payment") {
                      return (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {row.customer_name || "General Customer"}
                          </span>
                          <span className="text-[10px] text-teal-600 font-black uppercase tracking-tight">
                            {row.invoice_no || row.recurring_no || "Advance"} •{" "}
                            {row.service_names || "Services"}
                          </span>
                        </div>
                      );
                    }

                    if (row.source_type === "purchase_payment") {
                      return (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {row.vendor_name || "General Vendor"}
                          </span>
                          <span className="text-[10px] text-blue-600 font-black uppercase tracking-tight">
                            {row.bill_no || "Payment"} •{" "}
                            {row.purchase_services || "Procurement"}
                          </span>
                        </div>
                      );
                    }

                    if (
                      row.source_type === "expense_payment" ||
                      row.source_type === "expense"
                    ) {
                      return (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {row.vendor_name ||
                              row.notes
                                ?.split("|")[0]
                                ?.replace("Party: ", "")
                                .trim() ||
                              "General"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                            Ref:{" "}
                            <span className="text-rose-600">
                              {row.expense_no ||
                                row.expense_category ||
                                "Expense"}
                            </span>
                          </span>
                        </div>
                      );
                    }

                    if (row.source_type === "reversal") {
                      return (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {row.notes
                              ?.split("|")[0]
                              ?.replace("Party: ", "")
                              .trim() || "System"}
                          </span>
                          <span className="text-[10px] text-rose-600 font-black uppercase tracking-tight italic">
                            Transaction Reversal
                          </span>
                        </div>
                      );
                    }

                    // Manual Adjustment fallback
                    const partyFromNotes = row.notes
                      ?.split("|")[0]
                      ?.replace("Party: ", "")
                      .trim();
                    return (
                      <span className="font-bold text-slate-700">
                        {partyFromNotes || "General"}
                      </span>
                    );
                  },
                },
                {
                  accessorKey: "account_name",
                  header: "Bank",
                  cell: (info) => (
                    <span className="text-slate-500 text-xs">
                      {info.getValue()}
                    </span>
                  ),
                },
                {
                  accessorKey: "amount",
                  header: "Amount",
                  cell: (info) => (
                    <span className="font-bold text-slate-900">
                      {money(info.getValue())}
                    </span>
                  ),
                },
                {
                  accessorKey: "status",
                  header: "Status",
                  cell: (info) => (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${info.row.original.is_deleted ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      {info.row.original.is_deleted ? (
                        <Trash2 size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      {info.row.original.is_deleted ? "Deleted" : "Settled"}
                    </span>
                  ),
                },
                {
                  id: "actions",
                  header: () => <div className="text-right">Actions</div>,
                  cell: (info) => {
                    const row = info.row.original;
                    return (
                      <div className="flex items-center justify-end gap-1 action-cell">
                        <button
                          title="View Details"
                          onClick={() => setViewingTransaction(row)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <Eye size={16} />
                        </button>
                        {!row.is_deleted ? (
                          <>
                            <button
                              title="Edit"
                              onClick={() => handleEditTransaction(row)}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => setDeleteTransaction(row)}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            title="Restore"
                            onClick={() => handleRestoreTransaction(row)}
                            className="rounded p-1.5 text-teal-600 hover:bg-teal-50"
                          >
                            <RefreshCcw size={16} />
                          </button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
              emptyState={
                <div className="py-20 text-center text-slate-400 italic">
                  No transactions found
                </div>
              }
            />
          </section>
        )}

        {activeTab === "reports" && (
          <section className="space-y-6">
            {/* Report Type Selection */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                Select Report Type
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    id: "statement",
                    title: "Bank Statement",
                    icon: FileText,
                    desc: "Account statement with opening balance, transactions and closing balance.",
                  },
                  {
                    id: "cashflow",
                    title: "Cashflow Report",
                    icon: TrendingUp,
                    desc: "Cash inflow and outflow analysis.",
                  },
                  {
                    id: "daybook",
                    title: "Day Book",
                    icon: Calendar,
                    desc: "Daily transaction summary.",
                  },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setReportType(type.id);
                      setReportData(null);
                    }}
                    className={`text-left p-5 rounded-xl border-2 transition-all ${
                      reportType === type.id
                        ? "border-teal-600 bg-teal-50/50"
                        : "border-slate-100 hover:border-slate-300 bg-slate-50/30"
                    }`}
                  >
                    <type.icon
                      size={24}
                      className={
                        reportType === type.id
                          ? "text-teal-600"
                          : "text-slate-400"
                      }
                    />
                    <h4
                      className={`mt-3 font-bold ${reportType === type.id ? "text-teal-900" : "text-slate-900"}`}
                    >
                      {type.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {type.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Report Filters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
                Report Filters
              </h3>
              <div className="flex flex-wrap items-end gap-6">
                <div className="w-64">
                  <FormSelect
                    label="Bank Account *"
                    value={reportFilters.bank_account_id}
                    onChange={(e) =>
                      setReportFilters({
                        ...reportFilters,
                        bank_account_id: e.target.value,
                      })
                    }
                    disabled={reportType === "daybook"}
                  >
                    <option value="">
                      {reportType === "daybook"
                        ? "All Accounts"
                        : "Select Account"}
                    </option>
                    {accounts?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                <FormInput
                  label="From Date"
                  type="date"
                  value={reportFilters.from_date}
                  onChange={(e) =>
                    setReportFilters({
                      ...reportFilters,
                      from_date: e.target.value,
                    })
                  }
                />
                <FormInput
                  label="To Date"
                  type="date"
                  value={reportFilters.to_date}
                  onChange={(e) =>
                    setReportFilters({
                      ...reportFilters,
                      to_date: e.target.value,
                    })
                  }
                />
                <button
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="px-8 py-2.5 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>

            {/* Report Results */}
            {reportData && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-900">
                    {reportType === "statement" && "Bank Statement"}
                    {reportType === "cashflow" && "Cash Flow Analysis"}
                    {reportType === "daybook" && "Day Book Summary"}
                  </h3>
                  <div className="flex items-center gap-2">
                    {reportType === "statement" && (
                      <button
                        onClick={() =>
                          modules.pdf.bankStatement({
                            bank_account_id: reportFilters.bank_account_id,
                            documentMode: "print",
                          })
                        }
                        className="px-4 py-1.5 text-xs font-bold uppercase text-slate-600 hover:text-teal-600"
                      >
                        Print
                      </button>
                    )}
                    <ReportExportButtons
                      title={`${reportType.toUpperCase()} REPORT`}
                      columns={reportExportColumns[reportType]}
                      rows={reportExportRows}
                    />
                  </div>
                </div>

                {reportType === "cashflow" && (
                  <div className="p-6 grid grid-cols-3 gap-6 bg-white border-b border-slate-100">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-600 uppercase">
                        Total Inflow
                      </p>
                      <h4 className="text-xl font-bold text-emerald-700 mt-1">
                        {money(reportData.cashInflow)}
                      </h4>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-xs font-bold text-red-600 uppercase">
                        Total Outflow
                      </p>
                      <h4 className="text-xl font-bold text-red-700 mt-1">
                        {money(reportData.cashOutflow)}
                      </h4>
                    </div>
                    <div className="p-4 rounded-lg bg-teal-50 border border-teal-100">
                      <p className="text-xs font-bold text-teal-600 uppercase">
                        Net Cashflow
                      </p>
                      <h4 className="text-xl font-bold text-teal-700 mt-1">
                        {money(reportData.netCashFlow)}
                      </h4>
                    </div>
                  </div>
                )}

                <div className="p-0">
                  <DataTable
                    data={
                      Array.isArray(reportData)
                        ? reportData
                        : reportData?.transactions || reportData?.entries || []
                    }
                    columns={
                      reportType === "statement"
                        ? [
                            {
                              accessorKey: "transaction_date",
                              header: "Date",
                              cell: (info) => date(info.getValue()),
                            },
                            {
                              accessorKey: "reference_no",
                              header: "Reference",
                            },
                            {
                              accessorKey: "notes",
                              header: "Description",
                              cell: (info) => (
                                <span className="text-slate-600 italic text-xs">
                                  {info.getValue() ||
                                    info.row.original.transaction_label}
                                </span>
                              ),
                            },
                            {
                              accessorKey: "debit",
                              header: "Debit",
                              cell: (info) =>
                                info.getValue() > 0 ? (
                                  <span className="text-red-600">
                                    {money(info.getValue())}
                                  </span>
                                ) : (
                                  "-"
                                ),
                            },
                            {
                              accessorKey: "credit",
                              header: "Credit",
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
                              accessorKey: "balance_after",
                              header: "Balance",
                              cell: (info) => (
                                <span className="font-bold">
                                  {money(info.getValue())}
                                </span>
                              ),
                            },
                          ]
                        : reportType === "cashflow"
                          ? [
                              {
                                accessorKey: "date",
                                header: "Date",
                                cell: (info) => date(info.getValue()),
                              },
                              {
                                accessorKey: "reference_no",
                                header: "Reference",
                              },
                              { accessorKey: "source", header: "Type" },
                              {
                                accessorKey: "inflow",
                                header: "Inflow",
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
                                accessorKey: "outflow",
                                header: "Outflow",
                                cell: (info) =>
                                  info.getValue() > 0 ? (
                                    <span className="text-red-600">
                                      {money(info.getValue())}
                                    </span>
                                  ) : (
                                    "-"
                                  ),
                              },
                            ]
                          : [
                              {
                                accessorKey: "transaction_date",
                                header: "Date",
                                cell: (info) => date(info.getValue()),
                              },
                              {
                                accessorKey: "reference_no",
                                header: "Voucher No",
                              },
                              {
                                accessorKey: "transaction_label",
                                header: "Type",
                              },
                              {
                                accessorKey: "notes",
                                header: "Party",
                                cell: (info) =>
                                  info
                                    .getValue()
                                    ?.split("|")[0]
                                    ?.replace("Party: ", "") || "General",
                              },
                              {
                                accessorKey: "account_name",
                                header: "Account",
                              },
                              {
                                accessorKey: "amount",
                                header: "Amount",
                                cell: (info) => (
                                  <span className="font-bold">
                                    {money(info.getValue())}
                                  </span>
                                ),
                              },
                            ]
                    }
                    emptyState={
                      <div className="py-20 text-center text-slate-400 italic">
                        No report data available
                      </div>
                    }
                  />
                </div>
              </div>
            )}

            {!reportData && !isGenerating && (
              <div className="py-20 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200 border-dashed">
                Select filters and click Generate to view the report
              </div>
            )}
          </section>
        )}

        {activeTab === "settings" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Transaction Categories Section */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Transaction Categories
                  </h3>
                  <p className="text-sm text-slate-500">
                    Classify your income and expenses for accurate financial
                    reporting.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCategoryForm({
                      name: "",
                      type: "Expense",
                      description: "",
                      is_active: true,
                      is_system: 0,
                    });
                    setCategoryModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-700 shadow-md shadow-teal-100 transition-all active:scale-95"
                >
                  <Plus size={18} />
                  Add New Category
                </button>
              </div>

              <div className="p-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-5 transition-all hover:border-blue-200 hover:shadow-md">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                      <List size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Total Categories
                      </p>
                      <h4 className="text-2xl font-black text-slate-900 mt-0.5">
                        {catStats.total}
                      </h4>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-5 transition-all hover:border-red-200 hover:shadow-md">
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl">
                      <TrendingDown size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Expense
                      </p>
                      <h4 className="text-2xl font-black text-red-600 mt-0.5">
                        {catStats.expense}
                      </h4>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-5 transition-all hover:border-emerald-200 hover:shadow-md">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Income
                      </p>
                      <h4 className="text-2xl font-black text-emerald-600 mt-0.5">
                        {catStats.income}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Compact Toolbar */}
                <div className="flex flex-col lg:flex-row gap-3 items-center justify-between mb-6 p-3 bg-slate-100/50 rounded-lg border border-slate-200">
                  <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
                    <div className="w-full sm:w-48">
                      <FormSelect
                        value={categoryFilters.type}
                        onChange={(e) => {
                          const v = {
                            ...categoryFilters,
                            type: e.target.value,
                          };
                          setCategoryFilters(v);
                          load(filters, v);
                        }}
                        className="bg-white h-9 text-xs"
                      >
                        <option value="All">All Categories</option>
                        <option value="Expense">Expense Only</option>
                        <option value="Income">Income Only</option>
                      </FormSelect>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={14}
                      />
                      <input
                        className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                        placeholder="Search name or description..."
                        value={categoryFilters.search}
                        onChange={(e) => {
                          const v = {
                            ...categoryFilters,
                            search: e.target.value,
                          };
                          setCategoryFilters(v);
                          load(filters, v);
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                    {(categories?.length || 0) +
                      (incomeCategories?.length || 0)}{" "}
                    Categories Found
                  </div>
                </div>

                {/* Two-Column Desktop Layout */}
                <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Expense Column */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm self-start">
                    <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-100 flex items-center justify-between">
                      <h4 className="text-xs font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                        <TrendingDown size={14} /> Expense Categories (
                        {catStats.expense})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {categories?.[0] &&
                        categories
                          .filter((c) => c.type === "Expense")
                          .map((cat) => (
                            <div
                              key={cat.id}
                              className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">
                                    {cat.name}
                                  </span>
                                  <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-black uppercase">
                                    Expense
                                  </span>
                                  {cat.is_system === 1 && (
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase border border-slate-200">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 line-clamp-1">
                                  {cat.description ||
                                    "Standard transaction category"}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setCategoryForm(cat);
                                    setCategoryModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                {cat.is_system !== 1 && (
                                  <button
                                    onClick={() => setDeleteCategory(cat)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                      {categories?.filter((c) => c.type === "Expense")
                        .length === 0 && (
                        <div className="p-8 text-center text-xs text-slate-400 italic">
                          No expenses found
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Income Column */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm self-start">
                    <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between">
                      <h4 className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} /> Income Categories (
                        {catStats.income})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {incomeCategories?.[0] &&
                        incomeCategories.map((cat) => (
                          <div
                            key={cat.id}
                            className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">
                                  {cat.name}
                                </span>
                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black uppercase">
                                  Income
                                </span>
                                {cat.is_system === 1 && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase border border-slate-200">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 line-clamp-1">
                                {cat.description ||
                                  "Standard transaction category"}
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setCategoryForm(cat);
                                  setCategoryModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              {cat.is_system !== 1 && (
                                <button
                                  onClick={() => setDeleteCategory(cat)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      {incomeCategories?.length === 0 && (
                        <div className="p-8 text-center text-xs text-slate-400 italic">
                          No income found
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="grid grid-cols-1 gap-4 sm:hidden mt-2">
                  {categories?.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-slate-900">
                          {cat.name}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cat.type === "Expense" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}
                        >
                          {cat.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {cat.description || "No description provided"}
                      </p>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                        <span
                          className={`text-[10px] font-bold uppercase ${cat.is_active ? "text-emerald-600" : "text-slate-400"}`}
                        >
                          {cat.is_active ? "Active" : "Inactive"}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setCategoryForm(cat);
                              setCategoryModalOpen(true);
                            }}
                            className="p-2 bg-slate-50 rounded-lg text-slate-600"
                          >
                            <Pencil size={14} />
                          </button>
                          {cat.is_system !== 1 && (
                            <button
                              onClick={() => setDeleteCategory(cat)}
                              className="p-2 bg-red-50 rounded-lg text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Simplified Showing Records Footer */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    End of Categories List
                  </p>
                </div>
              </div>
            </section>

            {/* Banking Preferences Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                <SettingsIcon className="text-slate-400" size={20} />
                Banking Preferences
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <FormSelect
                    label="Default Cash Account"
                    value={bankingSettings.default_cash_account_id}
                    onChange={(e) =>
                      setBankingSettings((prev) => ({
                        ...prev,
                        default_cash_account_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select Account</option>
                    {accounts?.[0] &&
                      accounts
                        .filter((a) => a.account_type === "Cash")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_name}
                          </option>
                        ))}
                  </FormSelect>
                  <FormSelect
                    label="Default Bank Account"
                    value={bankingSettings.default_bank_account_id}
                    onChange={(e) =>
                      setBankingSettings((prev) => ({
                        ...prev,
                        default_bank_account_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select Account</option>
                    {accounts?.[0] &&
                      accounts
                        .filter((a) => a.account_type !== "Cash")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_name}
                          </option>
                        ))}
                  </FormSelect>
                  <FormSelect
                    label="Default Opening Balance Type"
                    value={bankingSettings.default_balance_type}
                    onChange={(e) =>
                      setBankingSettings((prev) => ({
                        ...prev,
                        default_balance_type: e.target.value,
                      }))
                    }
                  >
                    <option value="Debit">Debit (Positive)</option>
                    <option value="Credit">Credit (Negative/OD)</option>
                  </FormSelect>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      checked={bankingSettings.allow_negative_balance}
                      onChange={(e) =>
                        setBankingSettings((prev) => ({
                          ...prev,
                          allow_negative_balance: e.target.checked,
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-teal-600 transition-colors">
                        Allow Negative Balance
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      checked={bankingSettings.require_narration}
                      onChange={(e) =>
                        setBankingSettings((prev) => ({
                          ...prev,
                          require_narration: e.target.checked,
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-teal-600 transition-colors">
                        Require Narration
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      checked={bankingSettings.auto_create_cash_account}
                      onChange={(e) =>
                        setBankingSettings((prev) => ({
                          ...prev,
                          auto_create_cash_account: e.target.checked,
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-teal-600 transition-colors">
                        Auto Create Cash Account
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="px-10 py-2.5 bg-teal-600 text-white font-bold rounded-lg shadow-lg shadow-blue-200 hover:bg-teal-700 transition-all active:scale-95"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteCategory)}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
        loading={isDeleting}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setDeleteCategory(null)}
      />

      {/* Add Category Modal */}
      <Modal
        open={isCategoryModalOpen}
        title={
          categoryForm.id
            ? "Edit Transaction Category"
            : "Add Transaction Category"
        }
        onClose={() => setCategoryModalOpen(false)}
      >
        <form
          onSubmit={handleSaveCategory}
          className="grid gap-4 w-full max-w-2xl mx-auto py-2"
        >
          <FormInput
            label="Category Name *"
            value={categoryForm.name}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, name: e.target.value })
            }
            required
            placeholder="e.g. Interest Income"
          />
          <FormSelect
            label="Type *"
            value={categoryForm.type}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, type: e.target.value })
            }
            required
          >
            <option value="Expense">Expense</option>
            <option value="Income">Income</option>
          </FormSelect>
          <FormTextarea
            label="Description"
            value={categoryForm.description}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, description: e.target.value })
            }
            placeholder="Optional description..."
          />
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={categoryForm.is_active}
              onChange={(e) =>
                setCategoryForm({
                  ...categoryForm,
                  is_active: e.target.checked,
                })
              }
              className="w-4 h-4 text-teal-600 rounded"
            />
            <span className="text-sm font-medium text-slate-700">
              Category is active
            </span>
          </label>
          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="px-6 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-10 py-2 rounded-lg bg-teal-600 text-white font-bold shadow-md hover:bg-teal-700"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Account Modal */}
      <Modal
        open={isAccountModalOpen}
        title="Add Bank Account"
        onClose={() => setAccountModalOpen(false)}
      >
        <div className="w-full max-w-5xl mx-auto p-2">
          <form onSubmit={handleCreateAccount} className="space-y-8 py-4">
            <div className="grid gap-8">
              {/* Row 1: Account Name */}
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <FormInput
                  value={newAccount.account_name}
                  onChange={(e) =>
                    setNewAccount({
                      ...newAccount,
                      account_name: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g. Main Business Account"
                  className="h-[52px] text-lg px-4"
                />
              </div>

              {/* Row 2: Bank Details */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                    Bank Name
                  </label>
                  <FormInput
                    value={newAccount.bank_name}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        bank_name: e.target.value,
                      })
                    }
                    placeholder="e.g. HDFC Bank"
                    className="h-[52px] px-4"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                    Account Number
                  </label>
                  <FormInput
                    value={newAccount.account_no}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        account_no: e.target.value,
                      })
                    }
                    placeholder="Account number"
                    className="h-[52px] px-4"
                  />
                </div>
              </div>

              {/* Row 3: Branch & IFSC */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                    Branch Name
                  </label>
                  <FormInput
                    value={newAccount.branch_name}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        branch_name: e.target.value,
                      })
                    }
                    placeholder="Branch name"
                    className="h-[52px] px-4"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                    IFSC Code
                  </label>
                  <FormInput
                    value={newAccount.ifsc}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, ifsc: e.target.value })
                    }
                    placeholder="IFSC code"
                    className="h-[52px] px-4"
                  />
                </div>
              </div>

              {/* Row 4: Account Type & Opening Balance */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                    Account Type <span className="text-red-500">*</span>
                  </label>
                  <FormSelect
                    value={newAccount.account_type}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        account_type: e.target.value,
                      })
                    }
                    required
                    className="h-[52px] px-4"
                  >
                    <option value="Current">Current</option>
                    <option value="Savings">Savings</option>
                    <option value="Cash">Cash</option>
                  </FormSelect>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                    Opening Balance
                  </label>
                  <FormInput
                    type="number"
                    value={newAccount.opening_balance}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        opening_balance: e.target.value,
                      })
                    }
                    className="h-[52px] px-4 font-bold text-teal-700"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Information Note Box */}
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 mt-4">
              <h4 className="text-teal-900 font-bold text-sm mb-2">Note:</h4>
              <div className="text-[12px] text-teal-800 space-y-2 leading-relaxed">
                <p>
                  • Opening balance represents the starting amount in this
                  account.
                </p>
                <p>
                  • Select 'Debit (Positive)' if you have money in the account.
                </p>
                <p>• Select 'Credit (Negative)' if the account is overdrawn.</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end items-center gap-4 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="px-8 py-3 rounded-lg border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-10 py-3 rounded-lg bg-teal-600 text-white font-bold text-sm shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all active:scale-95"
              >
                Add Account
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Inter-Account Transfer Modal */}
      <Modal
        open={isTransferModalOpen}
        title="Inter-Account Fund Transfer"
        onClose={() => setTransferModalOpen(false)}
      >
        <form onSubmit={handleTransfer} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="From Account"
              value={transfer.from_account_id}
              onChange={(e) =>
                setTransfer({ ...transfer, from_account_id: e.target.value })
              }
              required
            >
              <option value="">Select source</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name} ({money(a.current_balance)})
                </option>
              ))}
            </FormSelect>
            <FormSelect
              label="To Account"
              value={transfer.to_account_id}
              onChange={(e) =>
                setTransfer({ ...transfer, to_account_id: e.target.value })
              }
              required
            >
              <option value="">Select destination</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name}
                </option>
              ))}
            </FormSelect>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Date"
              type="date"
              value={transfer.transaction_date}
              onChange={(e) =>
                setTransfer({ ...transfer, transaction_date: e.target.value })
              }
              required
            />
            <FormInput
              label="Amount (₹)"
              type="number"
              value={transfer.amount}
              onChange={(e) =>
                setTransfer({ ...transfer, amount: e.target.value })
              }
              required
            />
          </div>
          <FormInput
            label="Reference No"
            value={transfer.reference_no}
            onChange={(e) =>
              setTransfer({ ...transfer, reference_no: e.target.value })
            }
          />
          <FormTextarea
            label="Notes"
            value={transfer.notes}
            onChange={(e) =>
              setTransfer({ ...transfer, notes: e.target.value })
            }
          />
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-8 py-2 font-bold text-white hover:bg-teal-800 shadow-md transition-all active:scale-95"
            >
              Complete Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* New Banking Entry Modal */}
      <Modal
        open={isEntryModalOpen}
        title={bankingEntry.id ? "Edit Banking Entry" : "New Banking Entry"}
        onClose={() => setEntryModalOpen(false)}
      >
        <div className="w-full max-w-4xl mx-auto">
          <form onSubmit={handleBankingEntry} className="space-y-6 py-2">
            {/* Transaction Type Segmented Control */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {["payment", "receipt", "contra"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEntryType(type)}
                  className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-md transition-all ${
                    bankingEntry.type === type
                      ? "bg-white text-teal-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid gap-6">
              {/* Row 1: Date and Account */}
              <div className="grid grid-cols-2 gap-6">
                <FormInput
                  label="Date *"
                  type="date"
                  value={bankingEntry.transaction_date}
                  onChange={(e) =>
                    updateBankingEntry({ transaction_date: e.target.value })
                  }
                  required
                />
                <FormSelect
                  label="Bank Account *"
                  value={bankingEntry.bank_account_id}
                  onChange={(e) =>
                    updateBankingEntry({ bank_account_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select Account</option>
                  {accounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name} ({money(a.current_balance)})
                    </option>
                  ))}
                </FormSelect>
              </div>

              {/* Row 2: Party or Transfer To */}
              {bankingEntry.type === "contra" ? (
                <FormSelect
                  label="Transfer To Account *"
                  value={bankingEntry.to_account_id}
                  onChange={(e) =>
                    updateBankingEntry({ to_account_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select Destination Account</option>
                  {accounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name}
                    </option>
                  ))}
                </FormSelect>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-2 block">
                        Party
                      </label>
                      <div className="relative">
                        <FormInput
                          placeholder="Search customer, vendor or recent..."
                          value={
                            isPartyDropdownOpen
                              ? partySearch
                              : bankingEntry.party_name
                          }
                          onChange={(e) => {
                            setPartySearch(e.target.value);
                            if (!isPartyDropdownOpen)
                              setIsPartyDropdownOpen(true);
                            if (!e.target.value) handlePartyChange("");
                          }}
                          onFocus={() => setIsPartyDropdownOpen(true)}
                        />
                        {isPartyDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => {
                                setIsPartyDropdownOpen(false);
                                setPartySearch("");
                              }}
                            />
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto overflow-x-hidden py-2 animate-in fade-in zoom-in-95 duration-100">
                              {/* Group: Customers */}
                              {filteredParties.customers.length > 0 && (
                                <div className="mb-2">
                                  <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100 mb-1">
                                    Customers
                                  </div>
                                  {filteredParties.customers.map((p) => (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() => handlePartyChange(p.key)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left"
                                    >
                                      <User
                                        size={16}
                                        className="text-slate-400"
                                      />
                                      <span className="font-medium">
                                        {p.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Group: Vendors */}
                              {filteredParties.vendors.length > 0 && (
                                <div className="mb-2">
                                  <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100 mb-1">
                                    Vendors
                                  </div>
                                  {filteredParties.vendors.map((p) => (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() => handlePartyChange(p.key)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left"
                                    >
                                      <Building
                                        size={16}
                                        className="text-slate-400"
                                      />
                                      <span className="font-medium">
                                        {p.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Group: Recent */}
                              {filteredParties.recent.length > 0 && (
                                <div>
                                  <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100 mb-1">
                                    Recent
                                  </div>
                                  {filteredParties.recent.map((p) => (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() => handlePartyChange(p.key)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left"
                                    >
                                      <Clock
                                        size={16}
                                        className="text-slate-400"
                                      />
                                      <span className="font-medium">
                                        {p.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {Object.values(filteredParties).every(
                                (arr) => arr.length === 0,
                              ) && (
                                <div className="p-4 text-center text-xs text-slate-400 italic">
                                  No matches found
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <FormSelect
                      label="Reference Type *"
                      value={bankingEntry.reference_type}
                      onChange={(e) =>
                        updateBankingEntry({
                          reference_type: e.target.value,
                          invoice_id: "",
                          recurring_invoice_id: "",
                          purchase_id: "",
                          amount: 0,
                          category_id: "", // Clear category on reference type change
                        })
                      }
                      required
                    >
                      {bankingEntry.type === "receipt" ? (
                        <>
                          <option value="invoice">Invoice</option>
                          <option value="recurring">Recurring</option>
                          <option value="standalone">Standalone</option>
                        </>
                      ) : (
                        <>
                          <option value="purchase">Purchase</option>
                          <option value="expense">Expense</option>
                          <option value="standalone">Standalone</option>
                        </>
                      )}
                    </FormSelect>
                  </div>

                  {bankingEntry.type === "receipt" &&
                    bankingEntry.reference_type === "invoice" && (
                      <FormSelect
                        label="Pending Invoice *"
                        value={bankingEntry.invoice_id}
                        onChange={(e) => {
                          const invoice = selectableInvoices.find(
                            (row) => Number(row.id) === Number(e.target.value),
                          );
                          updateBankingEntry({
                            invoice_id: e.target.value,
                            customer_id:
                              invoice?.customer_id || bankingEntry.customer_id,
                            party_name:
                              invoice?.company_name || bankingEntry.party_name,
                            amount: invoice?.balance_due || 0,
                          });
                        }}
                        required
                      >
                        <option value="">Select invoice</option>
                        {selectableInvoices?.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.invoice_no} - {row.company_name} - Due{" "}
                            {money(row.balance_due)}
                          </option>
                        ))}
                      </FormSelect>
                    )}

                  {bankingEntry.type === "receipt" &&
                    bankingEntry.reference_type === "recurring" && (
                      <FormSelect
                        label="Recurring Plan *"
                        value={bankingEntry.recurring_invoice_id}
                        onChange={(e) => {
                          const plan = selectableRecurring.find(
                            (row) =>
                              Number(row.recurring_invoice_id) ===
                              Number(e.target.value),
                          );
                          updateBankingEntry({
                            recurring_invoice_id: e.target.value,
                            customer_id:
                              plan?.customer_id || bankingEntry.customer_id,
                            party_name:
                              plan?.company_name || bankingEntry.party_name,
                            amount: plan?.pending_amount || 0,
                          });
                        }}
                        required
                      >
                        <option value="">Select recurring plan</option>
                        {selectableRecurring?.map((row) => (
                          <option
                            key={row.recurring_invoice_id}
                            value={row.recurring_invoice_id}
                          >
                            {row.recurring_invoice_no} - {row.company_name} -
                            Pending {money(row.pending_amount)}
                          </option>
                        ))}
                      </FormSelect>
                    )}

                  {bankingEntry.type === "payment" &&
                    bankingEntry.reference_type === "purchase" && (
                      <FormSelect
                        label="Pending Purchase *"
                        value={bankingEntry.purchase_id}
                        onChange={(e) => {
                          const purchase = selectablePurchases.find(
                            (row) => Number(row.id) === Number(e.target.value),
                          );
                          updateBankingEntry({
                            purchase_id: e.target.value,
                            vendor_id:
                              purchase?.vendor_id || bankingEntry.vendor_id,
                            party_name:
                              purchase?.vendor_name ||
                              purchase?.vendor ||
                              bankingEntry.party_name,
                            amount: purchase?.balance_due || 0,
                          });
                        }}
                        required
                      >
                        <option value="">Select purchase</option>
                        {selectablePurchases?.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.bill_no} - {row.vendor_name || row.vendor} -
                            Due {money(row.balance_due)}
                          </option>
                        ))}
                      </FormSelect>
                    )}

                  {bankingEntry.type === "payment" &&
                    bankingEntry.reference_type === "expense" && (
                      <FormSelect
                        label="Pending Expense *"
                        value={bankingEntry.expense_id}
                        onChange={(e) => {
                          const expense = selectableExpenses.find(
                            (row) => Number(row.id) === Number(e.target.value),
                          );
                          updateBankingEntry({
                            expense_id: e.target.value,
                            vendor_id:
                              expense?.vendor_id || bankingEntry.vendor_id,
                            party_name:
                              expense?.vendor_name ||
                              expense?.vendor ||
                              bankingEntry.party_name,
                            amount: expense?.balance_due || 0,
                            notes: expense?.notes || bankingEntry.notes,
                            reference_no:
                              expense?.expense_no || bankingEntry.reference_no,
                          });
                        }}
                        required
                      >
                        <option value="">Select expense</option>
                        {selectableExpenses?.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.expense_no} - {row.vendor_name || row.vendor} -
                            Due {money(row.balance_due)}
                          </option>
                        ))}
                      </FormSelect>
                    )}

                  {/* UI Rule: Hide Category for linked documents, show and require for standalone/expense */}
                  {(bankingEntry.reference_type === "standalone" ||
                    bankingEntry.reference_type === "expense") && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="relative">
                        <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wide mb-2 block">
                          Category *
                        </label>
                        <div className="relative">
                          <FormInput
                            placeholder="Search or create category..."
                            value={
                              isCategoryDropdownOpen
                                ? categorySearch
                                : bankingEntry.category || ""
                            }
                            onChange={(e) => {
                              setCategorySearch(e.target.value);
                              if (!isCategoryDropdownOpen)
                                setIsCategoryDropdownOpen(true);
                              if (!e.target.value) {
                                updateBankingEntry({
                                  category_id: "",
                                  category: "",
                                });
                              }
                            }}
                            onFocus={() => setIsCategoryDropdownOpen(true)}
                            required
                          />
                          {isCategoryDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => {
                                  setIsCategoryDropdownOpen(false);
                                  setCategorySearch("");
                                }}
                              />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-2 animate-in fade-in zoom-in-95 duration-100">
                                {filteredCategories.showCreate && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCategorySelection({
                                        isNew: true,
                                        name: filteredCategories.createName,
                                      })
                                    }
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 font-bold border-b border-slate-100"
                                  >
                                    <Plus size={16} />
                                    Create "{filteredCategories.createName}"
                                  </button>
                                )}

                                {filteredCategories.existing.map((cat) => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() =>
                                      handleCategorySelection({
                                        id: cat.id,
                                        name: cat.name,
                                      })
                                    }
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                  >
                                    <div
                                      className={`w-2 h-2 rounded-full ${bankingEntry.type === "receipt" ? "bg-emerald-400" : "bg-rose-400"}`}
                                    />
                                    <span className="font-medium">
                                      {cat.name}
                                    </span>
                                  </button>
                                ))}

                                {filteredCategories.existing.length === 0 &&
                                  !filteredCategories.showCreate && (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">
                                      No categories found
                                    </div>
                                  )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <FormSelect
                        label="Mode"
                        value={bankingEntry.mode}
                        onChange={(e) =>
                          updateBankingEntry({ mode: e.target.value })
                        }
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                        <option value="card">Card</option>
                      </FormSelect>
                    </div>
                  )}
                </>
              )}

              {/* Row 3: Amount */}
              <FormInput
                label="Amount *"
                type="number"
                className="text-lg font-bold text-teal-700"
                value={bankingEntry.amount}
                onChange={(e) => updateBankingEntry({ amount: e.target.value })}
                required
              />

              {/* Row 4: Narration */}
              <FormTextarea
                label={
                  bankingSettings.require_narration
                    ? "Narration *"
                    : "Narration"
                }
                placeholder="Enter transaction details"
                value={bankingEntry.notes}
                onChange={(e) => updateBankingEntry({ notes: e.target.value })}
                className={
                  bankingSettings.require_narration &&
                  !bankingEntry.notes?.trim()
                    ? "border-red-500 focus:ring-red-500"
                    : ""
                }
              />

              {/* Additional Fields */}
              <div className="grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                <FormInput
                  label="Reference Number"
                  value={bankingEntry.reference_no}
                  onChange={(e) =>
                    updateBankingEntry({ reference_no: e.target.value })
                  }
                />
                <FormInput
                  label="Cheque Number"
                  value={bankingEntry.cheque_no}
                  onChange={(e) =>
                    updateBankingEntry({ cheque_no: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEntryModalOpen(false)}
                className="px-8 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  bankingSettings.require_narration &&
                  !bankingEntry.notes?.trim()
                }
                className="px-12 py-2.5 rounded-lg bg-teal-600 text-white font-bold shadow-lg hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Entry
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* View Transaction Modal */}
      <Modal
        open={Boolean(viewingTransaction)}
        title="Transaction Details"
        onClose={() => setViewingTransaction(null)}
      >
        {viewingTransaction && (
          <div className="grid grid-cols-2 gap-6 py-2">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Voucher No
                </label>
                <p className="text-sm font-mono font-bold text-teal-700">
                  {viewingTransaction.reference_no || "Auto"}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Transaction Type
                </label>
                <p className="text-sm font-semibold">
                  {viewingTransaction.voucher_type}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Bank Account
                </label>
                <p className="text-sm font-medium">
                  {viewingTransaction.account_name}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Created Date
                </label>
                <p className="text-sm text-slate-600">
                  {date(viewingTransaction.created_at)}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Date
                </label>
                <p className="text-sm font-medium">
                  {date(viewingTransaction.transaction_date)}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Party
                </label>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">
                    {viewingTransaction.customer_name ||
                      viewingTransaction.vendor_name ||
                      viewingTransaction.notes
                        ?.split("|")[0]
                        ?.replace("Party: ", "")
                        .trim() ||
                      "General"}
                  </span>
                  <span className="text-[10px] text-teal-600 font-bold">
                    {viewingTransaction.invoice_no ||
                      viewingTransaction.bill_no ||
                      viewingTransaction.expense_no ||
                      "Manual Entry"}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Amount
                </label>
                <p className="text-lg font-black text-slate-900">
                  {money(viewingTransaction.amount)}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Status
                </label>
                <span
                  className={`block w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${viewingTransaction.is_deleted ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {viewingTransaction.is_deleted ? "Deleted" : "Settled"}
                </span>
              </div>
            </div>
            <div className="col-span-2 pt-4 border-t">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Narration
              </label>
              <p className="text-sm text-slate-600 italic leading-relaxed">
                {viewingTransaction.notes?.split("|")[1]?.trim() ||
                  viewingTransaction.notes ||
                  "No narration provided"}
              </p>
            </div>
            <div className="col-span-2 flex justify-end pt-4">
              <button
                onClick={() => setViewingTransaction(null)}
                className="px-6 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Transaction Confirmation */}
      <ConfirmationModal
        isOpen={Boolean(deleteTransaction)}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This will automatically reverse the impact on your bank balance."
        loading={isDeleting}
        onConfirm={handleDeleteTransaction}
        onCancel={() => setDeleteTransaction(null)}
      />
    </ContentArea>
  );
}
