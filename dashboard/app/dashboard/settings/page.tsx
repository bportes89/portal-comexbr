'use client';

import { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Smartphone, 
  Globe, 
  Bell, 
  Shield, 
  Save,
  QrCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Header } from '../../../components/Header';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../lib/api';
import { motion } from 'framer-motion';

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

export default function Settings() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState('');

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      try {
        const response = await api.get(`/whatsapp/sessions?userId=${user.id}`);
        if (response.data && response.data.length > 0) {
          const session = response.data[0];
          setInstanceName(session.name);
          if (session.status === 'CONNECTED') {
            setIsConnected(true);
          }
        }
      } catch (error) {
        console.error('Error checking WhatsApp status:', error);
      }
    };

    run();
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    const userId = user.id;
    setIsScanning(true);
    setQrCode(null);
    
    try {
      // Generate a unique instance name if not exists
      const name = instanceName || `user_${userId.substring(0, 8)}`;
      setInstanceName(name);

      const response = await api.post('/whatsapp/connect', {
        instanceName: name,
        userId
      });

      if (response.data && response.data.qrcode) {
        setQrCode(response.data.qrcode.base64 || response.data.qrcode);
      } else if (response.data && response.data.base64) {
        setQrCode(response.data.base64);
      } else if (response.data && response.data.instance && response.data.instance.status === 'open') {
         setIsConnected(true);
         setIsScanning(false);
      }

    } catch (error) {
      console.error('Error connecting to WhatsApp:', error);
      alert('Failed to generate QR Code');
      setIsScanning(false);
    }
  };

  const handleDisconnect = async () => {
    // TODO: Implement disconnect endpoint in backend
    setIsConnected(false);
    setQrCode(null);
  };

  return (
    <>
      <Header />
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 mt-6"
      >
        {/* Page Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('settings.subtitle')}</p>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Settings Sidebar */}
          <motion.div variants={item} className="w-full lg:w-64 flex-shrink-0">
            <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
              {[
                { id: 'profile', label: t('settings.tabs.profile'), icon: User },
                { id: 'whatsapp', label: t('settings.tabs.whatsapp'), icon: Smartphone },
                { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
                { id: 'security', label: t('settings.tabs.security'), icon: Shield },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap border border-transparent",
                      activeTab === tab.id 
                        ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-lg shadow-green-900/20" 
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </motion.div>

          {/* Settings Content */}
          <motion.div variants={item} className="flex-1">
            <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5 min-h-[400px]">
              
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6 max-w-2xl"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white">{t('settings.profile.title')}</h2>
                    <p className="text-slate-400 text-sm mt-1">{t('settings.profile.subtitle')}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 pb-6 border-b border-white/5">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-green-900/20 border border-white/10">
                      AU
                    </div>
                    <div>
                      <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors hover:border-white/20">
                        {t('settings.profile.changePhoto')}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t('settings.profile.firstName')}</label>
                      <input type="text" defaultValue="Admin" className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 placeholder:text-slate-600" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">{t('settings.profile.lastName')}</label>
                      <input type="text" defaultValue="User" className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 placeholder:text-slate-600" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-300">{t('settings.profile.email')}</label>
                      <input type="email" defaultValue="admin@portalcomexbr.com" className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 placeholder:text-slate-600" />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5">
                      <Save className="h-4 w-4" />
                      {t('settings.profile.save')}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* WhatsApp Tab */}
              {activeTab === 'whatsapp' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6 w-full"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white">{t('settings.whatsapp.title')}</h2>
                    <p className="text-slate-400 text-sm mt-1">{t('settings.whatsapp.subtitle')}</p>
                  </div>


                  <div className={cn(
                    "p-6 rounded-xl border flex flex-col md:flex-row items-center gap-6 transition-all duration-300",
                    isConnected 
                      ? "bg-green-500/10 border-green-500/20 shadow-lg shadow-green-900/10" 
                      : "bg-slate-800/30 border-white/5"
                  )}>
                    <div className={cn(
                      "h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg",
                      isConnected ? "bg-green-500/20 text-green-400 ring-2 ring-green-500/20" : "bg-slate-700/50 text-slate-400 ring-2 ring-white/5"
                    )}>
                      <Smartphone className="h-8 w-8" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-base font-bold text-white">
                        {isConnected ? t('settings.whatsapp.deviceConnected') : t('settings.whatsapp.noDeviceConnected')}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {isConnected 
                          ? t('settings.whatsapp.connectedMessage') 
                          : t('settings.whatsapp.scanMessage')}
                      </p>
                    </div>
                    <div>
                      {isConnected ? (
                        <button 
                          onClick={handleDisconnect}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors hover:border-red-500/30 shadow-lg shadow-red-900/10"
                        >
                          {t('settings.whatsapp.disconnect')}
                        </button>
                      ) : (
                        <button 
                          onClick={handleConnect}
                          disabled={isScanning}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5"
                        >
                          {isScanning ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              {t('settings.whatsapp.generatingQR')}
                            </>
                          ) : (
                            <>
                              <QrCode className="h-4 w-4" />
                              {t('settings.whatsapp.connectDevice')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isScanning && !isConnected && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-xl bg-slate-800/30"
                    >
                      <div className="h-48 w-48 bg-white p-2 rounded-lg shadow-xl mb-4">
                        {qrCode ? (
                          <img src={qrCode} alt="WhatsApp QR Code" className="h-full w-full object-contain" />
                        ) : (
                          <div className="h-full w-full bg-slate-900 flex items-center justify-center text-white text-xs rounded border border-white/10">
                            {t('settings.whatsapp.qrCodeSimulation')}
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white">{t('settings.whatsapp.scanInstructions.title')}</p>
                      <ol className="text-sm text-slate-400 mt-4 space-y-2 list-decimal list-inside">
                        <li>{t('settings.whatsapp.scanInstructions.step1')}</li>
                        <li>{t('settings.whatsapp.scanInstructions.step2')}</li>
                        <li>{t('settings.whatsapp.scanInstructions.step3')}</li>
                        <li>{t('settings.whatsapp.scanInstructions.step4')}</li>
                      </ol>
                    </motion.div>
                  )}
                  
                  {isConnected && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800/30 p-4 rounded-xl border border-white/5"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-slate-700/50 flex items-center justify-center border border-white/5">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{t('settings.whatsapp.businessAccount')}</p>
                          <p className="text-xs text-slate-400">+55 11 99999-9999</p>
                        </div>
                        <div className="ml-auto">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('common.active')}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('settings.whatsapp.connectedSince')} {new Date().toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Placeholder for other tabs */}
              {(activeTab === 'notifications' || activeTab === 'security') && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="h-16 w-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <Shield className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t('common.comingSoon')}</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-xs">
                    {t('common.underDevelopment')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
