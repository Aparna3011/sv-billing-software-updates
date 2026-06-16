import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  Users,
  FilePlus,
  Layers,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';

import toast from '@utils/notify';
import { modules } from '../../utils/api';
import { date, money } from '../../utils/format';

import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';

const moduleLinks = [
  { label: 'Customers', icon: Users },
  { label: 'Services', icon: Layers },
  { label: 'GST Rates', icon: SlidersHorizontal },
  { label: 'Quotations', icon: FilePlus },
  { label: 'Invoices', icon: BarChart3 },
  { label: 'Recurring', icon: FilePlus }
];

function CustomersSection({ customers }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Customers</h2>
          <p className="mt-1 text-sm text-slate-500">Browse registered customers, contacts, GSTIN, and payment terms.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">{customers.length} customers</span>
          <Link to="/customers" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            <Plus size={16} /> Add Customer
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Company</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Contact</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">GSTIN</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Phone</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">State</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  No customers available.
                </td>
              </tr>
            ) : (
              customers.map(customer => (
                <tr key={customer.id || customer.company_name} className="hover:bg-slate-50">
                  <td className="px-5 py-4">{customer.company_name || '-'}</td>
                  <td className="px-5 py-4">{customer.contact_person || '-'}</td>
                  <td className="px-5 py-4">{customer.gstin || '-'}</td>
                  <td className="px-5 py-4">{customer.phone || '-'}</td>
                  <td className="px-5 py-4">{customer.state || '-'}</td>
                  <td className="px-5 py-4">
                    <Link
                      to="/customers"
                      className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServicesSection({ services }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Service Catalog</h2>
          <p className="mt-1 text-sm text-slate-500">Browse services backed by the actual database records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">{services.length} services</span>
          <Link to="/services" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            <Plus size={16} /> Add Service
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Service</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Category</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">SAC</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Billing Type</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Rate</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">GST %</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            {services.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                  No services match your current filters.
                </td>
              </tr>
            ) : (
              services.map(service => (
                <tr key={service.id || service.name} className="hover:bg-slate-50">
                  <td className="px-5 py-4">{service.name}</td>
                  <td className="px-5 py-4">{service.category || 'General'}</td>
                  <td className="px-5 py-4">{service.sac_code || '-'}</td>
                  <td className="px-5 py-4">{service.billing_type || '-'}</td>
                  <td className="px-5 py-4">₹{service.rate ?? '-'}</td>
                  <td className="px-5 py-4">{service.gst_rate ?? '-'}%</td>
                  <td className="px-5 py-4">
                    <Link
                      to="/services"
                      className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GstRatesSection({ gstRates }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">GST Rates</h2>
          <p className="mt-1 text-sm text-slate-500">Manage tax slabs used throughout invoices and quotations.</p>
        </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-500">{gstRates.length} rates</span>
            <Link to="/gst-rates" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
              <Plus size={16} /> Add GST Rate
            </Link>
          </div>
        </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Label</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Rate</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            {gstRates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">
                  No GST rates configured yet.
                </td>
              </tr>
            ) : (
              gstRates.map(rate => (
                <tr key={rate.id || rate.rate} className="hover:bg-slate-50">
                  <td className="px-5 py-4">{rate.label || 'GST'}</td>
                  <td className="px-5 py-4">{rate.rate != null ? `${rate.rate}%` : '-'}</td>
                  <td className="px-5 py-4">{rate.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-5 py-4">
                    <Link
                      to="/gst-rates"
                      className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuotationsSection({ quotations }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Quotations</h2>
          <p className="mt-1 text-sm text-slate-500">Review saved quotations and proposal totals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">{quotations.length} quotations</span>
          <Link to="/quotations/new" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            <Plus size={16} /> New Quotation
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Quotation</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Customer</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Date</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Total</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  No quotations available.
                </td>
              </tr>
            ) : (
              quotations.map(row => (
                <tr key={row.id || row.quotation_no} className="hover:bg-slate-50">
                  <td className="px-5 py-4">{row.quotation_no || '-'}</td>
                  <td className="px-5 py-4">{row.company_name || '-'}</td>
                  <td className="px-5 py-4">{row.quotation_date ? date(row.quotation_date) : '-'}</td>
                  <td className="px-5 py-4">{row.grand_total != null ? money(row.grand_total) : '-'}</td>
                  <td className="px-5 py-4">{row.status || '-'}</td>
                  <td className="px-5 py-4">
                    <Link
                      to={`/quotations/${row.id}`}
                      className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoicesSection({ invoices }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
          <p className="mt-1 text-sm text-slate-500">View invoices, paid amounts, dues, and customer totals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">{invoices.length} invoices</span>
          <Link to="/invoices/new" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            <Plus size={16} /> New Invoice
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Invoice</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Customer</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Date</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Total</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Due</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                  No invoices available.
                </td>
              </tr>
            ) : (
              invoices.map(row => (
                <tr key={row.id || row.invoice_no} className="hover:bg-slate-50">
                  <td className="px-5 py-4">{row.invoice_no || '-'}</td>
                  <td className="px-5 py-4">{row.company_name || '-'}</td>
                  <td className="px-5 py-4">{row.invoice_date ? date(row.invoice_date) : '-'}</td>
                  <td className="px-5 py-4">{row.grand_total != null ? money(row.grand_total) : '-'}</td>
                  <td className="px-5 py-4">{row.balance_due != null ? money(row.balance_due) : '-'}</td>
                  <td className="px-5 py-4">{row.display_status || row.status || '-'}</td>
                  <td className="px-5 py-4">
                    <Link
                      to={`/invoices/${row.id}`}
                      className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecurringSection({ recurrings }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recurring Billing</h2>
          <p className="mt-1 text-sm text-slate-500">Manage active subscriptions, cycles, and next invoice dates.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">{recurrings.length} recurring items</span>
          <Link to="/recurring" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            <Plus size={16} /> Add Recurring
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Title</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Customer</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Cycle</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Amount</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Next Date</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            {recurrings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                  No recurring billing items found.
                </td>
              </tr>
            ) : (
              recurrings.map(row => (
                <tr key={row.id || row.title} className="hover:bg-slate-50">
                  <td className="px-5 py-4">{row.title || '-'}</td>
                  <td className="px-5 py-4">{row.company_name || '-'}</td>
                  <td className="px-5 py-4">{row.billing_cycle || '-'}</td>
                  <td className="px-5 py-4">{row.amount != null ? money(row.amount) : '-'}</td>
                  <td className="px-5 py-4">{row.next_invoice_date ? date(row.next_invoice_date) : '-'}</td>
                  <td className="px-5 py-4">{row.status || '-'}</td>
                  <td className="px-5 py-4">
                    <Link
                      to="/recurring"
                      className="inline-flex rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [activeModule, setActiveModule] = useState('Services');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [gstFilter, setGstFilter] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [services, setServices] = useState([]);
  const [gstRates, setGstRates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [recurrings, setRecurrings] = useState([]);

  useEffect(() => {
    Promise.all([
      modules.dashboard(),
      modules.services.list(),
      modules.gst.list(),
      modules.customers.list(),
      modules.quotations.list(),
      modules.invoices.list(),
      modules.recurring.list()
    ])
      .then(([
        dashboardResponse,
        servicesResponse,
        gstResponse,
        customersResponse,
        quotationsResponse,
        invoicesResponse,
        recurringsResponse
      ]) => {
        setDashboardData(dashboardResponse);
        setServices(servicesResponse || []);
        setGstRates(gstResponse || []);
        setCustomers(customersResponse || []);
        setQuotations(quotationsResponse || []);
        setInvoices(invoicesResponse || []);
        setRecurrings(recurringsResponse || []);
      })
      .catch(error => toast.error(error.message));
  }, []);

  const categories = useMemo(
    () => [...new Set(services.map(service => service.category).filter(Boolean))],
    [services]
  );

  const gstOptions = useMemo(
    () => [...new Set(gstRates.map(rate => `${rate.rate}%`))],
    [gstRates]
  );

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return services.filter(service => {
      const matchesSearch =
        query === '' ||
        service.name?.toLowerCase().includes(query) ||
        service.category?.toLowerCase().includes(query) ||
        service.sac_code?.toString().toLowerCase().includes(query);

      const matchesCategory = categoryFilter === '' || service.category === categoryFilter;
      const matchesGst = gstFilter === '' || `${service.gst_rate}%` === gstFilter;

      return matchesSearch && matchesCategory && matchesGst;
    });
  }, [services, searchQuery, categoryFilter, gstFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setGstFilter('');
  };

  return (
    <ContentArea>
      <PageHeader
        title="Admin Panel"
        subtitle="Manage customers, services, quotations, GST rates, invoices, and recurring billing from your real data."
      />

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          {moduleLinks.map(link => {
            const Icon = link.icon;
            return (
              <button
                key={link.label}
                type="button"
                onClick={() => setActiveModule(link.label)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition duration-200 ${
                  activeModule === link.label
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                {link.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search services"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-teal-600"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={gstFilter}
              onChange={e => setGstFilter(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-teal-600"
            >
              <option value="">GST%</option>
              {gstOptions.map(gst => (
                <option key={gst} value={gst}>
                  {gst}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              <Filter size={15} />
              Clear Filters
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/services"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
            >
              <Plus size={15} />
              Manage Services
            </Link>

            <Link
              to="/gst-rates"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
            >
              <Plus size={15} />
              GST Rates
            </Link>

            <Link
              to="/quotations/new"
              className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800"
            >
              <Plus size={15} />
              Create Quotation
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveModule('Customers')}
          className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-600"
        >
          <div className="text-sm font-medium text-slate-500">Customers</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{dashboardData?.customers || 0}</div>
          <p className="mt-3 text-sm text-slate-500">Active customers in your billing database.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('Services')}
          className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-600"
        >
          <div className="text-sm font-medium text-slate-500">Services</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{services.length}</div>
          <p className="mt-3 text-sm text-slate-500">Service items available for invoices and quotations.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('GST Rates')}
          className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-600"
        >
          <div className="text-sm font-medium text-slate-500">GST Rates</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{gstRates.length}</div>
          <p className="mt-3 text-sm text-slate-500">Tax slabs currently configured in the system.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('Invoices')}
          className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-600"
        >
          <div className="text-sm font-medium text-slate-500">Pending Invoices</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{dashboardData?.unpaidInvoices || 0}</div>
          <p className="mt-3 text-sm text-slate-500">Invoices with outstanding balances.</p>
        </button>
      </div>

      {activeModule === 'Customers' && <CustomersSection customers={customers} />}
      {activeModule === 'Services' && <ServicesSection services={filteredServices} />}
      {activeModule === 'GST Rates' && <GstRatesSection gstRates={gstRates} />}
      {activeModule === 'Quotations' && <QuotationsSection quotations={quotations} />}
      {activeModule === 'Invoices' && <InvoicesSection invoices={invoices} />}
      {activeModule === 'Recurring' && <RecurringSection recurrings={recurrings} />}
    </ContentArea>
  );
}
