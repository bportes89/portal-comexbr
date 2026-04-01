'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Bot,
  Activity,
  Plug,
  FolderKanban,
  Users, 
  UsersRound,
  TrendingUp,
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();
  const { logout } = useAuth();

  const sidebarItems = [
    {
      name: t('sidebar.overview'),
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: t('sidebar.projects'),
      href: '/dashboard/projects',
      icon: FolderKanban,
    },
    {
      name: t('sidebar.scoring'),
      href: '/dashboard/scoring',
      icon: TrendingUp,
    },
    {
      name: t('sidebar.analytics'),
      href: '/dashboard/analytics',
      icon: Activity,
    },
    {
      name: t('sidebar.integrations'),
      href: '/dashboard/integrations',
      icon: Plug,
    },
    {
      name: t('sidebar.campaigns'),
      href: '/dashboard/campaigns',
      icon: MessageSquare,
    },
    {
      name: t('sidebar.groups'),
      href: '/dashboard/groups',
      icon: UsersRound,
    },
    {
      name: t('sidebar.automations'),
      href: '/dashboard/automations',
      icon: Bot,
    },
    {
      name: t('sidebar.contacts'),
      href: '/dashboard/contacts',
      icon: Users,
    },
    {
      name: t('sidebar.settings'),
      href: '/dashboard/settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800/80 backdrop-blur-md text-white rounded-xl shadow-lg border border-white/10"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-72 h-full transition-transform duration-300 lg:bg-transparent",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-full flex flex-col bg-slate-900/40 backdrop-blur-xl border-r border-white/5 lg:rounded-r-none relative overflow-hidden">
          {/* Glass Reflection Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

          {/* Logo Section */}
          <div className="p-8 flex flex-col items-center relative z-10">
            <div className="relative h-14 w-full mb-6 group cursor-pointer">
              <div className="absolute -inset-4 bg-green-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <Image 
                src="/logo.jpeg" 
                alt="Portal ComexBr" 
                fill 
                sizes="224px"
                className="object-contain relative z-10 drop-shadow-2xl"
                priority
              />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Portal ComexBr
              </h1>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">{t('sidebar.systemOnline')}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-none">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('sidebar.menu')}</p>
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block relative group"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/10 rounded-xl border border-green-500/20"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className={cn(
                    "relative flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-white group-hover:bg-white/5"
                  )}>
                    <div className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-5 w-5 transition-colors duration-300",
                        isActive ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "text-slate-500 group-hover:text-green-400"
                      )} />
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-black/20">
            <button 
              onClick={logout}
              className="group flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              {t('sidebar.signOut')}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
