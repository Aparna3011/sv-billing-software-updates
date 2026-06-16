import { create } from 'zustand';
import toast from '@utils/notify';
import { modules } from '../utils/api';

export const useAuthStore = create(set => ({
  user: JSON.parse(localStorage.getItem('sv-user') || 'null'),
  loading: false,
  login: async values => {
    set({ loading: true });
    try {
      const user = await modules.login(values);
      localStorage.setItem('sv-user', JSON.stringify(user));
      set({ user, loading: false });
      toast.success('Logged in');
      return user;
    } catch (error) {
      set({ loading: false });
      toast.error(error.message);
      throw error;
    }
  },
  logout: () => {
    localStorage.removeItem('sv-user');
    set({ user: null });
    toast.success('Logged out');
  }
}));
