'use client';

import { 
  Bell, 
  Search,
  User,
  ArrowLeft,
  Languages
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  const canGoBack = pathname !== '/dashboard';

  const handleBack = () => {
    if (!canGoBack) return;
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/dashboard');
  };

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 py-4 mb-6 rounded-2xl bg-slate-900/40 backdrop-blur-xl border border-white/5 shadow-lg transition-all">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Link
          href="/dashboard"
          className="flex items-center rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-colors h-10 w-10"
          title="Portal ComexBr"
        >
          <Image src="/logo.jpeg" alt="Portal ComexBr" width={40} height={40} className="object-cover" />
        </Link>

        <button
          type="button"
          onClick={handleBack}
          disabled={!canGoBack}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        {/* Search Bar */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white/5 rounded-xl border border-white/10 focus-within:ring-2 focus-within:ring-green-500/50 focus-within:border-green-500/50 transition-all flex-1 min-w-0 max-w-md group hover:bg-white/10">
          <Search className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
          <input 
            type="text" 
            placeholder={t('common.search')}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-500 text-slate-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <button 
          onClick={toggleLanguage}
          className="relative p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/5 flex items-center gap-2"
          title={language === 'pt' ? t('common.switchToEnglish') : t('common.switchToPortuguese')}
        >
          <Languages className="h-5 w-5" />
          <span className="text-xs font-medium uppercase">{language}</span>
        </button>

        <button className="relative p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/5">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-slate-900 animate-pulse"></span>
        </button>
        
        <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block"></div>

        <button className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5 group">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-900/20 group-hover:scale-105 transition-transform">
            <User className="h-5 w-5" />
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{t('common.adminUser')}</span>
            <span className="text-[10px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">{t('common.proPlan')}</span>
          </div>
        </button>
      </div>
    </header>
  );
}
