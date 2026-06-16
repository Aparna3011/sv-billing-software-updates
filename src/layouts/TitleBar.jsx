import { LogOut, Minus, Square, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function TitleBar() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white">
      <div className="flex-1 px-4 text-sm font-medium text-slate-700" style={{ WebkitAppRegion: 'drag' }}>
        {user?.name} - {user?.role}
      </div>
      <button title="Logout" onClick={logout} className="grid h-10 w-10 place-items-center text-slate-500 hover:bg-slate-100"><LogOut size={16} /></button>
      <button title="Minimize" onClick={() => window.electronAPI.window.minimize()} className="grid h-10 w-10 place-items-center text-slate-500 hover:bg-slate-100"><Minus size={16} /></button>
      <button title="Maximize" onClick={() => window.electronAPI.window.maximize()} className="grid h-10 w-10 place-items-center text-slate-500 hover:bg-slate-100"><Square size={14} /></button>
      <button title="Close" onClick={() => window.electronAPI.window.close()} className="grid h-10 w-10 place-items-center text-slate-500 hover:bg-red-600 hover:text-white"><X size={16} /></button>
    </header>
  );
}
