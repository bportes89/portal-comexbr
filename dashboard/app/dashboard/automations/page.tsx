'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Bot, 
  Zap, 
  MoreVertical, 
  Edit, 
  Trash2,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { Header } from '../../../components/Header';
import { cn } from '../../../lib/utils';
import api from '../../../lib/api';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { motion } from 'framer-motion';

interface AutomationRule {
  id: string;
  keyword: string;
  response: string;
  createdAt: string;
}

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

export default function Automations() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ keyword: '', response: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const response = await api.get('/automations');
      setRules(response.data);
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({ keyword: '', response: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: AutomationRule) => {
    setEditingId(rule.id);
    setFormData({ keyword: rule.keyword, response: rule.response });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await api.patch(`/automations/${editingId}`, {
          keyword: formData.keyword,
          response: formData.response,
        });
      } else {
        await api.post('/automations', {
          keyword: formData.keyword,
          response: formData.response,
          userId: user.id
        });
      }
      setIsModalOpen(false);
      setFormData({ keyword: '', response: '' });
      setEditingId(null);
      fetchAutomations();
    } catch (error) {
      console.error('Error saving automation:', error);
      alert('Failed to save automation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm(t('common.confirmDelete') || 'Are you sure?')) return;
    try {
      await api.delete(`/automations/${id}`);
      setRules(rules.filter(rule => rule.id !== id));
    } catch (error) {
      console.error('Error deleting automation:', error);
    }
  };

  return (
    <>
      <Header />
      
      {/* Add/Edit Automation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? t('automations.edit') || 'Edit Automation' : t('automations.new')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('automations.keyword')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. price, hello, help"
                  value={formData.keyword}
                  onChange={e => setFormData({...formData, keyword: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('automations.response')}</label>
                <textarea
                  required
                  rows={4}
                  placeholder="The message to send back..."
                  value={formData.response}
                  onChange={e => setFormData({...formData, response: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? t('common.processing') : (editingId ? t('common.update') || 'Update' : t('common.save'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 mt-6"
      >
        {/* Page Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('automations.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('automations.subtitle')}</p>
          </div>
          <button 
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            {t('automations.new')}
          </button>
        </motion.div>

        {/* Filters Bar */}
        <motion.div variants={item} className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5 flex items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('automations.search')}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 transition-all"
            />
          </div>
        </motion.div>

        {/* Rules Grid */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
             <div className="col-span-full p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-slate-400 text-sm">{t('common.loading')}</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 backdrop-blur-xl p-12 rounded-2xl shadow-xl border border-white/5 text-center">
              <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Bot className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('automations.noRules')}</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">{t('automations.createFirst')}</p>
              <button 
                onClick={handleOpenAddModal}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                {t('automations.new')}
              </button>
            </div>
          ) : (
            rules.map((rule) => (
            <div key={rule.id} className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Zap className="h-24 w-24 text-green-500" />
              </div>

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg border border-white/5 bg-green-500/10 text-green-400")}>
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{rule.keyword}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium bg-white/5 px-2 py-0.5 rounded text-slate-400 border border-white/5">{t('automations.keyword')}: {rule.keyword}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 mb-4 relative z-10 border border-white/5">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">{t('automations.response')}</p>
                <p className="text-slate-300 text-sm">{rule.response}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 relative z-10">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium text-white">0</span>
                  <span>{t('automations.triggers')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenEditModal(rule)}
                    className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )))}
        </motion.div>
      </motion.div>
    </>
  );
}
