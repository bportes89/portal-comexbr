'use client';

import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MessageSquare, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  Play,
  Pause,
  BarChart3,
  X,
  Loader2,
  Users,
  Send
} from 'lucide-react';
import { Header } from '../../../components/Header';
import api from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'paused';
  createdAt: string;
  stats?: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  messages?: Array<{ status: string }>;
  scheduledFor?: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  tags?: string[];
}

interface WhatsappSession {
  id: string;
  name: string;
  status: string;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // New Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCampaign, setReportCampaign] = useState<Campaign | null>(null);
  const [openCampaignMenuId, setOpenCampaignMenuId] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sessions, setSessions] = useState<WhatsappSession[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    delay: 5000,
    instanceName: ''
  });

  useEffect(() => {
    fetchCampaigns();
    fetchContacts();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSessions();
      fetchContacts();
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (!openCampaignMenuId) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-campaign-menu]')) return;
      setOpenCampaignMenuId(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenCampaignMenuId(null);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openCampaignMenuId]);

  const fetchSessions = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/whatsapp/sessions?userId=${user.id}`);
      setSessions(response.data);
      if (response.data.length > 0 && !formData.instanceName) {
        setFormData(prev => ({ ...prev, instanceName: response.data[0].name }));
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await api.get(
        user ? `/campaigns?userId=${encodeURIComponent(user.id)}` : '/campaigns',
      );
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      // Fallback data
      if (campaigns.length === 0) {
        setCampaigns([
          { 
            id: '1', 
            name: 'Welcome Series', 
            message: 'Hello! Welcome to Portal ComexBr...', 
            status: 'sending', 
            createdAt: new Date().toISOString(),
            stats: { sent: 120, delivered: 115, read: 90, failed: 5 }
          },
          { 
            id: '2', 
            name: 'Black Friday Promo', 
            message: 'Don\'t miss out on our deals!', 
            status: 'scheduled', 
            createdAt: new Date().toISOString(),
            scheduledFor: new Date(Date.now() + 86400000).toISOString(),
            stats: { sent: 0, delivered: 0, read: 0, failed: 0 }
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await api.get(
        user ? `/contacts?userId=${encodeURIComponent(user.id)}` : '/contacts',
      );
      setContacts(response.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      // Fallback contacts
      if (contacts.length === 0) {
        setContacts([
          { id: '1', name: 'João Silva', phone: '+55 11 99999-9999', tags: ['vip'] },
          { id: '2', name: 'Maria Souza', phone: '+55 11 88888-8888', tags: ['lead'] },
        ]);
      }
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedContacts.length === 0) {
      alert(t('campaigns.selectContactsError') || 'Please select at least one contact');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/campaigns', {
        ...formData,
        userId: user.id,
        contactIds: selectedContacts,
      });
      setIsModalOpen(false);
      setFormData({ name: '', message: '', delay: 5000, instanceName: 'Evolution1' });
      setSelectedContacts([]);
      fetchCampaigns(); // Refresh list
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'sending': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'scheduled': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle2;
      case 'sending': return Play;
      case 'scheduled': return Clock;
      case 'failed': return AlertCircle;
      case 'paused': return Pause;
      default: return MessageSquare;
    }
  };

  const getCampaignStats = (campaign: Campaign) => {
    if (campaign.stats) return campaign.stats;

    const messages = campaign.messages ?? [];
    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;

    for (const msg of messages) {
      const status = String(msg.status || '').toUpperCase();
      if (status === 'FAILED') failed += 1;
      if (status === 'READ') read += 1;
      if (status === 'DELIVERED') delivered += 1;
      if (status === 'SENT') sent += 1;
    }

    sent += delivered + read;
    delivered += read;

    return { sent, delivered, read, failed };
  };

  const openReport = (campaign: Campaign) => {
    setReportCampaign(campaign);
    setIsReportModalOpen(true);
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.left = '-1000px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const duplicateCampaign = (campaign: Campaign) => {
    setFormData((prev) => ({
      ...prev,
      name: `${campaign.name} (cópia)`,
      message: campaign.message,
    }));
    setSelectedContacts([]);
    setIsModalOpen(true);
  };

  const filters = ['all', 'sending', 'scheduled', 'completed', 'drafts'];

  return (
    <>
      <Header />
      
      <div className="space-y-6 mt-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('campaigns.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('campaigns.subtitle')}</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-green-600/20"
          >
            <Plus className="h-4 w-4" />
            {t('campaigns.new')}
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={t('campaigns.search')} 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            {filters.map((filter, i) => (
              <button 
                key={filter}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                  i === 0 
                    ? "bg-green-50 text-green-700 border border-green-200" 
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {t(`campaigns.filter.${filter}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Campaigns Grid */}
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 text-sm">{t('common.loading')}</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('campaigns.noCampaigns')}</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">{t('campaigns.createFirst')}</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('campaigns.new')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const StatusIcon = getStatusIcon(campaign.status);
              const stats = getCampaignStats(campaign);
              const progress = campaign.stats 
                ? Math.round(((campaign.stats.sent + campaign.stats.failed) / (campaign.stats.sent + campaign.stats.failed + (campaign.status === 'completed' ? 0 : 100))) * 100) 
                : 0;

              return (
                <div key={campaign.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5", getStatusColor(campaign.status))}>
                      <StatusIcon className="h-3 w-3" />
                      {t(`campaigns.status.${campaign.status}`)}
                    </div>
                    <div className="relative" data-campaign-menu>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCampaignMenuId((prev) =>
                            prev === campaign.id ? null : campaign.id,
                          )
                        }
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50"
                        aria-haspopup="menu"
                        aria-expanded={openCampaignMenuId === campaign.id}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {openCampaignMenuId === campaign.id && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenCampaignMenuId(null);
                              openReport(campaign);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <BarChart3 className="h-4 w-4 text-gray-500" />
                            {t('campaigns.viewReport')}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setOpenCampaignMenuId(null);
                              await copyToClipboard(campaign.message);
                              alert(t('common.success') || 'Sucesso');
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            Copiar mensagem
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenCampaignMenuId(null);
                              duplicateCampaign(campaign);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Plus className="h-4 w-4 text-gray-500" />
                            Duplicar campanha
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">{campaign.name}</h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10">{campaign.message}</p>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500 font-medium">{t('campaigns.progress')}</span>
                      <span className="text-gray-900 font-bold">{campaign.status === 'completed' ? '100%' : `${progress}%`}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: campaign.status === 'completed' ? '100%' : `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 py-4 border-t border-gray-50">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.sent')}</p>
                      <p className="text-sm font-bold text-gray-900">{stats.sent || 0}</p>
                    </div>
                    <div className="text-center border-l border-gray-50">
                      <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.read')}</p>
                      <p className="text-sm font-bold text-gray-900">{stats.read || 0}</p>
                    </div>
                    <div className="text-center border-l border-gray-50">
                      <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.failed')}</p>
                      <p className="text-sm font-bold text-gray-900">{stats.failed || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(campaign.createdAt).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}
                    </div>
                    <button
                      type="button"
                      onClick={() => openReport(campaign)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
                    >
                      <BarChart3 className="h-3 w-3" />
                      {t('campaigns.viewReport')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">{t('campaigns.new')}</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="campaign-form" onSubmit={handleCreateCampaign} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('campaigns.form.name') || 'Campaign Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="e.g. Black Friday Sale"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('campaigns.form.message') || 'Message'}
                  </label>
                  <textarea
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all h-32 resize-none"
                    placeholder="Type your message here..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('campaigns.form.delay') || 'Delay (ms)'}
                    </label>
                    <input
                      type="number"
                      required
                      min="1000"
                      step="1000"
                      value={formData.delay}
                      onChange={(e) => setFormData({ ...formData, delay: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('campaigns.form.instance') || 'Instance Name'}
                    </label>
                    <select
                      required
                      value={formData.instanceName}
                      onChange={(e) => setFormData({ ...formData, instanceName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all appearance-none bg-white"
                    >
                      <option value="" disabled>Select an instance</option>
                      {sessions.map(session => (
                        <option key={session.id} value={session.name}>
                          {session.name} ({session.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center justify-between">
                    <span>{t('campaigns.form.contacts') || 'Select Contacts'}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                      {selectedContacts.length} selected
                    </span>
                  </label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {contacts.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">No contacts found</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {contacts.map(contact => (
                          <div 
                            key={contact.id}
                            onClick={() => toggleContact(contact.id)}
                            className={cn(
                              "flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                              selectedContacts.includes(contact.id) && "bg-green-50 hover:bg-green-50"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                              selectedContacts.includes(contact.id) 
                                ? "bg-green-500 border-green-500 text-white" 
                                : "border-gray-300 bg-white"
                            )}>
                              {selectedContacts.includes(contact.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                              <p className="text-xs text-gray-500">{contact.phone}</p>
                            </div>
                            {contact.tags && contact.tags.length > 0 && (
                              <div className="flex gap-1">
                                {contact.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200/50 rounded-xl transition-colors"
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </button>
              <button 
                type="submit"
                form="campaign-form"
                disabled={isSubmitting || selectedContacts.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {t('campaigns.create')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {isReportModalOpen && reportCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{reportCampaign.name}</h2>
                <p className="text-sm text-gray-500">
                  {new Date(reportCampaign.createdAt).toLocaleString(
                    language === 'pt' ? 'pt-BR' : 'en-US',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportCampaign(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">{t('campaigns.form.message') || 'Message'}</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{reportCampaign.message}</p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {(() => {
                  const stats = getCampaignStats(reportCampaign);
                  return (
                    <>
                      <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.sent')}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">{stats.sent}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.delivered')}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">{stats.delivered}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.read')}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">{stats.read}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                        <p className="text-xs text-gray-400 uppercase font-semibold">{t('campaigns.stats.failed')}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">{stats.failed}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsReportModalOpen(false);
                    setReportCampaign(null);
                  }}
                  className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
