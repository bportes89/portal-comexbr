'use client';

import Link from 'next/link';
import { 
  Send, 
  Smartphone, 
  TrendingUp, 
  ArrowRight, 
  MoreHorizontal,
  Zap,
  Activity
} from 'lucide-react';
import { Header } from '../../components/Header';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../../lib/api';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [overview, setOverview] = useState<{
    messagesTotal: number;
    activeCampaigns: number;
    connectedNumbers: number;
  } | null>(null);
  const [systemStatus, setSystemStatus] = useState<{
    whatsappApi: { configured: boolean };
    messageQueue: { ok: boolean };
    database: { ok: boolean };
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      try {
        const resp = await api.get(
          `/analytics/overview?userId=${encodeURIComponent(user.id)}`,
        );
        const totals = resp.data?.totals;
        const messagesTotal = Number(totals?.messages?.total ?? 0);
        const activeCampaigns = Number(totals?.activeCampaigns ?? 0);
        const connectedNumbers = Number(totals?.connectedNumbers ?? 0);
        setOverview({
          messagesTotal,
          activeCampaigns,
          connectedNumbers,
        });
      } catch (error) {
        console.error('Error fetching analytics overview:', error);
      }
    };
    run();
  }, [user]);

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await api.get('/system/status');
        setSystemStatus(resp.data);
      } catch (error) {
        console.error('Error fetching system status:', error);
        setSystemStatus(null);
      }
    };
    run();
  }, []);

  return (
    <>
      <Header />
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Welcome Section */}
        <motion.div 
          variants={item}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-green-500/20 transition-colors duration-1000" />
          
          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              {t('dashboard.welcome')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">{t('common.adminUser')}</span> 👋
            </h1>
            <p className="text-slate-400 text-lg mt-2 font-light">
              {t('dashboard.performance')} <span className="text-green-400 font-semibold">{t('dashboard.better')}</span> {t('dashboard.today')}
            </p>
          </div>
          <Link href="/dashboard/campaigns" className="relative z-10 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-4 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:-translate-y-1 active:translate-y-0 border border-white/10 group">
            <Send className="h-4 w-4 group-hover:rotate-12 transition-transform" />
            {t('dashboard.newCampaign')}
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 - Messages Sent */}
          <motion.div 
            variants={item}
            className="bg-gradient-to-br from-green-600/90 to-emerald-900/90 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/10 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
                  <Send className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-bold bg-black/20 px-3 py-1 rounded-full text-green-300 backdrop-blur-sm border border-white/5 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +12.5%
                </span>
              </div>
              <h3 className="text-emerald-100/70 text-sm font-medium uppercase tracking-widest">{t('dashboard.stats.messages')}</h3>
              <p className="text-5xl font-bold text-white mt-2 tracking-tight drop-shadow-lg">
                {(overview?.messagesTotal ?? 12345).toLocaleString()}
              </p>
            </div>
          </motion.div>

          {/* Card 2 - Active Campaigns */}
          <motion.div 
            variants={item}
            className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden group hover:bg-slate-800/40 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <Activity className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                {t('dashboard.stats.active')}
              </span>
            </div>
            <div className="relative z-10">
              <h3 className="text-slate-500 text-sm font-medium uppercase tracking-widest">{t('dashboard.stats.activeCampaigns')}</h3>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-5xl font-bold text-white tracking-tight">
                  {overview?.activeCampaigns ?? 3}
                </p>
                <span className="text-sm text-slate-400 font-medium">{t('dashboard.runningNow')}</span>
              </div>
              <div className="w-full bg-slate-800/50 h-1.5 rounded-full mt-6 overflow-hidden border border-white/5">
                <div className="bg-blue-500 h-1.5 rounded-full w-3/5 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
              </div>
            </div>
          </motion.div>

          {/* Card 3 - Connected Numbers */}
          <motion.div 
            variants={item}
            className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden group hover:bg-slate-800/40 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                </span>
                <span className="text-xs font-bold text-green-400 tracking-wide uppercase">{t('common.online')}</span>
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-slate-500 text-sm font-medium uppercase tracking-widest">{t('dashboard.connectedNumbers')}</h3>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-5xl font-bold text-white tracking-tight">
                  {overview?.connectedNumbers ?? 1}
                </p>
                <span className="text-sm text-slate-400 font-medium">{t('dashboard.device')}</span>
              </div>
              <div className="mt-6 flex -space-x-3 overflow-hidden">
                <div className="inline-block h-10 w-10 rounded-full ring-2 ring-slate-900 bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-white/10 shadow-lg">
                  <Smartphone className="h-5 w-5" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Campaigns Table */}
          <motion.div 
            variants={item}
            className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/5 overflow-hidden shadow-xl flex flex-col"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-xl font-bold text-white">{t('dashboard.recentCampaigns')}</h3>
                <p className="text-sm text-slate-400 mt-1">{t('dashboard.recentCampaignsSubtitle')}</p>
              </div>
              <Link href="/dashboard/campaigns" className="text-sm font-bold text-green-400 hover:text-green-300 flex items-center gap-1 hover:gap-2 transition-all bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">
                {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.02]">
                  <tr>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{t('dashboard.table.campaignName')}</th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{t('common.status')}</th>
                    <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500">{t('campaigns.progress')}</th>
                    <th className="px-8 py-5 text-right text-xs font-bold uppercase tracking-widest text-slate-500">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-green-400 font-bold text-xs border border-green-500/20 shadow-lg shadow-green-900/20">
                            BF
                          </div>
                          <span className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors">Black Friday Promo {i}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm",
                          i === 1 ? "bg-green-500/10 text-green-400 border-green-500/20" :
                          i === 2 ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        )}>
                          {i === 1 ? t('campaigns.status.completed') : i === 2 ? t('campaigns.status.sending') : t('campaigns.status.draft')}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-white/5">
                            <div 
                              className={cn("h-1.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]", i === 1 ? "bg-green-500 w-full" : i === 2 ? "bg-blue-500 w-1/2 animate-pulse" : "bg-slate-600 w-0")}
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-bold">
                            {i === 1 ? "100%" : i === 2 ? "50%" : "0%"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right">
                        <button className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Quick Actions / Tips */}
          <div className="space-y-6">
            <motion.div 
              variants={item}
              className="bg-gradient-to-br from-indigo-600 to-violet-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden border border-white/10 group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
                <Smartphone className="h-48 w-48 -rotate-12 translate-x-10 -translate-y-10" />
              </div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
              
              <div className="relative z-10">
                <div className="h-12 w-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/20 shadow-inner">
                  <Zap className="h-6 w-6 text-yellow-300" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{t('dashboard.connectDevice.title')}</h3>
                <p className="text-indigo-100 text-sm mb-8 leading-relaxed font-light">
                  {t('dashboard.connectDevice.description')}
                </p>
                <Link 
                  href="/dashboard/settings"
                  className="inline-flex w-full items-center justify-center px-6 py-4 bg-white text-indigo-900 rounded-2xl text-sm font-bold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  {t('dashboard.connectDevice.button')}
                </Link>
              </div>
            </motion.div>

            <motion.div 
              variants={item}
              className="bg-slate-900/40 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/5"
            >
              <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                {t('dashboard.systemStatus.title')}
              </h3>
              <div className="space-y-5">
                {[
                  {
                    label: t('dashboard.systemStatus.whatsappApi'),
                    ok: systemStatus ? systemStatus.whatsappApi.configured : true,
                  },
                  {
                    label: t('dashboard.systemStatus.messageQueue'),
                    ok: systemStatus ? systemStatus.messageQueue.ok : true,
                  },
                  {
                    label: t('dashboard.systemStatus.database'),
                    ok: systemStatus ? systemStatus.database.ok : true,
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 transition-colors border border-white/5',
                          item.ok
                            ? 'group-hover:text-green-400 group-hover:bg-green-500/10'
                            : 'group-hover:text-red-400 group-hover:bg-red-500/10',
                        )}
                      >
                        <Activity className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-slate-300 font-medium">{item.label}</span>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide border',
                        item.ok
                          ? 'text-green-400 bg-green-500/10 border-green-500/20'
                          : 'text-red-400 bg-red-500/10 border-red-500/20',
                      )}
                    >
                      {item.ok
                        ? t('dashboard.systemStatus.operational')
                        : t('dashboard.systemStatus.offline')}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
