const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('electronAPI', {
  invoke,

  company: {
    uploadLogo: payload => invoke('company:uploadLogo', payload)
  },

  auth: {
    login: payload => invoke('auth:login', payload),
    logout: () => invoke('auth:logout')
  },

  window: {
    minimize: () => invoke('window:minimize'),
    maximize: () => invoke('window:maximize'),
    close: () => invoke('window:close')
  },
  analytics: {
    overview: () => invoke('analytics:overview'),
    revenue: (f) => invoke('analytics:revenue', f),
    customers: (f) => invoke('analytics:customers', f),
    recurring: (f) => invoke('analytics:recurring', f),
    finance: (f) => invoke('analytics:finance', f),
  },
  expenseCategories: {
    list: () => invoke('expenseCategories:list'),
    create: (p) => invoke('expenseCategories:create', p),
    update: (id, p) => invoke('expenseCategories:update', { id, ...p }),
    delete: (id) => invoke('expenseCategories:delete', id)
  },
  incomeCategories: {
    list: () => invoke('incomeCategories:list'),
    create: (p) => invoke('incomeCategories:create', p),
    update: (id, p) => invoke('incomeCategories:update', { id, ...p }),
    delete: (id) => invoke('incomeCategories:delete', id)
  }
});
