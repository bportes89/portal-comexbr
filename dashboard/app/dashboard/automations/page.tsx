'use client';

import { useMemo, useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Bot, 
  Zap, 
  ShoppingCart,
  Loader2,
  MoreVertical, 
  Edit, 
  Trash2,
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

function parseAutomationResponse(response: string):
  | { type: 'text'; text: string }
  | { type: 'sequence'; steps: Array<{ text: string; delayMs?: number }> }
  | {
      type: 'media';
      mediaType: string;
      mimeType: string;
      media: string;
      fileName: string;
      caption?: string;
      delayMs?: number;
    } {
  const trimmed = response.trim();
  if (!trimmed.startsWith('{')) return { type: 'text', text: response };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return { type: 'text', text: response };
    const record = parsed as Record<string, unknown>;

    if (record.type === 'sequence' && Array.isArray(record.steps)) {
      const steps = record.steps
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const step = s as Record<string, unknown>;
          const text = typeof step.text === 'string' ? step.text : '';
          const delayMs = typeof step.delayMs === 'number' ? step.delayMs : undefined;
          if (!text.trim()) return null;
          return delayMs === undefined ? { text } : { text, delayMs };
        })
        .filter((s): s is { text: string; delayMs?: number } => !!s);
      if (steps.length > 0) return { type: 'sequence', steps };
    }

    if (record.type === 'media') {
      const mediaType = typeof record.mediaType === 'string' ? record.mediaType : '';
      const mimeType = typeof record.mimeType === 'string' ? record.mimeType : '';
      const media = typeof record.media === 'string' ? record.media : '';
      const fileName = typeof record.fileName === 'string' ? record.fileName : '';
      const caption = typeof record.caption === 'string' ? record.caption : undefined;
      const delayMs = typeof record.delayMs === 'number' ? record.delayMs : undefined;
      if (mediaType && mimeType && media && fileName) {
        return { type: 'media', mediaType, mimeType, media, fileName, caption, delayMs };
      }
    }
  } catch {
    return { type: 'text', text: response };
  }
  return { type: 'text', text: response };
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
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ keyword: '', response: '' });
  const [formType, setFormType] = useState<'text' | 'sequence' | 'media'>('text');
  const [sequenceSteps, setSequenceSteps] = useState<Array<{ text: string; delayMs: number }>>([
    { text: '', delayMs: 0 },
  ]);
  const [mediaForm, setMediaForm] = useState<{
    mediaType: string;
    mimeType: string;
    media: string;
    fileName: string;
    caption: string;
    delayMs: number;
  }>({
    mediaType: 'image',
    mimeType: 'image/png',
    media: '',
    fileName: 'image.png',
    caption: '',
    delayMs: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAutomations();
  }, [user]);

  const fetchAutomations = async () => {
    try {
      const url = user
        ? `/automations?userId=${encodeURIComponent(user.id)}`
        : '/automations';
      const response = await api.get(url);
      setRules(response.data);
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyCartAbandonedTemplate = async () => {
    if (!user) return;
    setIsApplyingTemplate(true);
    try {
      await api.post('/automations/templates/apply', {
        templateKey: 'cart_abandoned',
        userId: user.id,
      });
      await fetchAutomations();
    } catch (error) {
      console.error('Error applying template:', error);
      alert('Falha ao aplicar template');
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({ keyword: '', response: '' });
    setFormType('text');
    setSequenceSteps([{ text: '', delayMs: 0 }]);
    setMediaForm({
      mediaType: 'image',
      mimeType: 'image/png',
      media: '',
      fileName: 'image.png',
      caption: '',
      delayMs: 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: AutomationRule) => {
    setEditingId(rule.id);
    const parsed = parseAutomationResponse(rule.response);
    setFormData({
      keyword: rule.keyword,
      response: parsed.type === 'text' ? parsed.text : rule.response,
    });
    if (parsed.type === 'sequence') {
      setFormType('sequence');
      setSequenceSteps(
        parsed.steps.map((s) => ({ text: s.text, delayMs: s.delayMs ?? 0 })),
      );
    } else if (parsed.type === 'media') {
      setFormType('media');
      setMediaForm({
        mediaType: parsed.mediaType,
        mimeType: parsed.mimeType,
        media: parsed.media,
        fileName: parsed.fileName,
        caption: parsed.caption ?? '',
        delayMs: parsed.delayMs ?? 0,
      });
    } else {
      setFormType('text');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const response =
        formType === 'text'
          ? formData.response
          : formType === 'sequence'
            ? JSON.stringify({
                type: 'sequence',
                steps: sequenceSteps
                  .map((s) => ({ text: s.text.trim(), delayMs: Number(s.delayMs) || 0 }))
                  .filter((s) => s.text.length > 0),
              })
            : JSON.stringify({
                type: 'media',
                mediaType: mediaForm.mediaType,
                mimeType: mediaForm.mimeType,
                media: mediaForm.media,
                fileName: mediaForm.fileName,
                caption: mediaForm.caption,
                delayMs: Number(mediaForm.delayMs) || 0,
              });

      if (editingId) {
        await api.patch(`/automations/${editingId}`, {
          keyword: formData.keyword,
          response,
        });
      } else {
        await api.post('/automations', {
          keyword: formData.keyword,
          response,
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

  const responsePreviewById = useMemo(() => {
    const map = new Map<string, string>();
    for (const rule of rules) {
      const parsed = parseAutomationResponse(rule.response);
      if (parsed.type === 'sequence') {
        map.set(rule.id, `Sequência: ${parsed.steps.length} etapa(s)`);
      } else if (parsed.type === 'media') {
        map.set(rule.id, `Mídia: ${parsed.mediaType} (${parsed.fileName})`);
      } else {
        map.set(rule.id, parsed.text);
      }
    }
    return map;
  }, [rules]);

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as 'text' | 'sequence' | 'media')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                >
                  <option value="text">Texto</option>
                  <option value="sequence">Sequência</option>
                  <option value="media">Mídia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('automations.response')}
                </label>
                {formType === 'text' ? (
                  <textarea
                    required
                    rows={4}
                    placeholder="A mensagem para responder..."
                    value={formData.response}
                    onChange={e => setFormData({...formData, response: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
                  />
                ) : formType === 'sequence' ? (
                  <div className="space-y-3">
                    {sequenceSteps.map((step, idx) => (
                      <div key={idx} className="grid grid-cols-1 gap-2 bg-gray-50 border border-gray-100 rounded-2xl p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-1">
                            <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">Delay (ms)</label>
                            <input
                              type="number"
                              min={0}
                              step={500}
                              value={step.delayMs}
                              onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                setSequenceSteps((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, delayMs: value } : s)),
                                );
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">Mensagem</label>
                            <input
                              type="text"
                              value={step.text}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSequenceSteps((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, text: value } : s)),
                                );
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                              placeholder="Digite a mensagem..."
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          {sequenceSteps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSequenceSteps((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-sm font-medium text-red-600 hover:text-red-700"
                              disabled={isSubmitting}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSequenceSteps((prev) => [...prev, { text: '', delayMs: 0 }])}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar etapa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">Tipo</label>
                        <select
                          value={mediaForm.mediaType}
                          onChange={(e) => setMediaForm((p) => ({ ...p, mediaType: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                        >
                          <option value="image">Imagem</option>
                          <option value="video">Vídeo</option>
                          <option value="document">Documento</option>
                          <option value="audio">Áudio</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">MIME Type</label>
                        <input
                          type="text"
                          value={mediaForm.mimeType}
                          onChange={(e) => setMediaForm((p) => ({ ...p, mimeType: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                          placeholder="image/png"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">URL/Base64</label>
                      <input
                        type="text"
                        required
                        value={mediaForm.media}
                        onChange={(e) => setMediaForm((p) => ({ ...p, media: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">Nome do arquivo</label>
                        <input
                          type="text"
                          required
                          value={mediaForm.fileName}
                          onChange={(e) => setMediaForm((p) => ({ ...p, fileName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">Delay (ms)</label>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={mediaForm.delayMs}
                          onChange={(e) => setMediaForm((p) => ({ ...p, delayMs: Number(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">Legenda</label>
                      <input
                        type="text"
                        value={mediaForm.caption}
                        onChange={(e) => setMediaForm((p) => ({ ...p, caption: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 bg-white"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                )}
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
          <div className="flex items-center gap-3">
            <button
              onClick={applyCartAbandonedTemplate}
              disabled={isApplyingTemplate || !user}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-bold transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplyingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              Fluxo: Carrinho abandonado
            </button>
            <button 
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              {t('automations.new')}
            </button>
          </div>
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
                <p className="text-slate-300 text-sm">{responsePreviewById.get(rule.id)}</p>
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
