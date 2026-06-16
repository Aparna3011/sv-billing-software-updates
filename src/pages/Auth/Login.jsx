import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LockKeyhole } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import FormInput from '../../components/forms/FormInput';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export default function Login() {
  const login = useAuthStore(state => state.login);
  const loading = useAuthStore(state => state.loading);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { email: 'admin@svithub.local', password: 'admin123' } });
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-teal-700 text-white"><LockKeyhole size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold">SV IT Hub Billing</h1>
            <p className="text-sm text-slate-500">Offline GST Billing & Service Management</p>
          </div>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit(login)}>
          <FormInput label="Email" error={errors.email} {...register('email')} />
          <FormInput label="Password" type="password" error={errors.password} {...register('password')} />
          <button disabled={loading} className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
