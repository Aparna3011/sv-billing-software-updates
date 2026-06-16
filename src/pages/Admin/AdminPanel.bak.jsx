import { useEffect, useMemo, useState } from 'react';
import {
  IndianRupee,
  Search,
  Plus,
  Filter,
  Pencil
} from 'lucide-react';

import toast from '@utils/notify';
import { modules } from '../../utils/api';

import ContentArea from '../../components/layout/ContentArea';
import PageHeader from '../../components/layout/PageHeader';

const tabs = [
  'Products',
  'Suppliers',
  'Categories',
  'Billing Types',
  'GST Rates',
  'Salesmen',
  'Customers',
  'Godowns/Branches'
];

const sampleProducts = [
  {
    name: '24 Inch Cotton File Lace',
    sku: '8',
    purchaseRate: '60',
    mrp: '80',
    gst: '0%',
    stock: '1'
  },
  {
    name: '272 Office File',
    sku: '9',
    purchaseRate: '12',
    mrp: '20',
    gst: '0%',
    stock: '48'
  },
  {
    name: '555 Lucky Spring File',
    sku: '11',
    purchaseRate: '22',
    mrp: '30',
    gst: '0%',
    stock: '23'
  }
];

export default function AdminPanel() {
  const [data, setData] = useState(null);

  useEffect(() => {
    modules
      .dashboard()
      .then(setData)
      .catch(error => toast.error(error.message));
  }, []);

  const customers = data?.recentCustomers || [];
  const services = data?.expiringServices || [];
  const quotations = data?.recentInvoices || [];

  const cards = [
    {
      title: 'Customers',
      count: data?.customers || 0,
      description: 'Manage GST customers and billing contacts.',
      icon: Users,
      to: '/customers'
    },
    {
      title: 'Services',
      count: data?.activeRecurringClients || 0,
      description: 'Software services, AMC, SaaS and hosting.',
      icon: Settings2,
      to: '/services'
    },
    {
      title: 'GST Rates',
      count: data?.activeGst || 0,
      description: 'Tax slabs and GST configurations.',
      icon: IndianRupee,
      to: '/gst-rates'
    },
    {
      title: 'Quotations',
      count: data?.unpaidInvoices || 0,
      description: 'Quotation management and approvals.',
      icon: FilePlus2,
      to: '/quotations'
    }
  ];

  return (
    <ContentArea>
      <PageHeader
        title="Admin Panel"
        subtitle="Manage customers, services, quotations, GST setup, and billing workspace"
      />

      {/* Top Tabs */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;

            return (
              <Link
                key={tab.title}
                to={tab.to}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  index === 0
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                {tab.title}
              </Link>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                placeholder="Search records"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white"
              />
            </div>

            <select className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-600">
  <option value="">All Categories</option>

  {[...new Set(services.map(service => service.category))]
    .filter(Boolean)
    .map(category => (
      <option key={category} value={category}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </option>
    ))}
</select>

            <select className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-600">
              <option>All Status</option>
              <option>Active</option>
              <option>Pending</option>
            </select>

            <button className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
              <Filter size={15} />
              More Filters
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/customers"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
            >
              <Plus size={15} />
              Add Customer
            </Link>

            <Link
              to="/services"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
            >
              <Plus size={15} />
              Add Service
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

      {/* Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;

          return (
            <Link
              key={card.title}
              to={card.to}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-teal-600 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {card.title}
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    {card.count}
                  </h2>
                </div>

                <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-700 text-white shadow-sm">
                  <Icon size={20} />
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-500">
                {card.description}
              </p>

              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-teal-700">
                Open Module
                <ChevronRight size={15} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Tables Section */}
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">

        {/* Customers */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Customers
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {customers.map(customer => (
              <div
                key={customer.id}
                className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {customer.company_name}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {customer.email}
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {customer.phone}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Services
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {services.map(service => (
              <div
                key={service.id}
                className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {service.title}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {service.company_name}
                  </p>
                </div>

                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  ₹{service.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quotations */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Quotations
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {quotations.map(quotation => (
              <div
                key={quotation.id}
                className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {quotation.invoice_no}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {quotation.company_name}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    ₹{quotation.grand_total}
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      quotation.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : quotation.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {quotation.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ContentArea>
  );
}