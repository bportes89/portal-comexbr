'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2, Loader2, Search, TrendingUp, Webhook } from 'lucide-react';
import { Header } from '../../../components/Header';
import api from '../../../lib/api';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { cn } from '../../../lib/utils';

type Rule = {
  id: string;
  name?: string | null;
  eventType: string;
  points: number;
  conditions?: unknown;
  createdAt: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
  tags?: string[];
  score?: number;
};

export default function ScoringPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [rules, setRules] = useState<Rule[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [minScore, setMinScore] = useState('0');
  const [ruleForm, setRuleForm] = useState({
    eventType: 'lead.created',
    points: 10,
    conditions: '',
  });

  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [rulesResp, contactsResp] = await Promise.all([
        api.get(`/lead-scoring/rules?userId=${encodeURIComponent(user.id)}`),
        api.get(
          `/contacts?userId=${encodeURIComponent(user.id)}&minScore=${encodeURIComponent(minScore)}`,
        ),
      ]);
      setRules(rulesResp.data);
      setContacts(contactsResp.data);
    } catch (error) {
      console.error('Error fetching scoring data:', error);
      setRules((prev) => (prev.length > 0 ? prev : []));
      setContacts((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  }, [user, minScore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) => {
      const hay = `${c.name} ${c.phone} ${(c.tags ?? []).join(' ')}`.toLowerCase();
      return hay.includes(term);
    });
  }, [contacts, search]);

  const createRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      let conditions: Record<string, unknown> | undefined = undefined;
      const raw = ruleForm.conditions.trim();
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        conditions = parsed;
      }

      await api.post('/lead-scoring/rules', {
        userId: user.id,
        eventType: ruleForm.eventType,
        points: Number(ruleForm.points),
        conditions,
      });

      setRuleForm({ eventType: 'lead.created', points: 10, conditions: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating rule:', error);
      alert(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRule = async (id: string) => {
    const confirmed = window.confirm(t('common.confirmDelete'));
    if (!confirmed) return;
    try {
      await api.delete(`/lead-scoring/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert(t('common.error'));
    }
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/events/ingest`;

  return (
    <>
      <Header />

      <div className="space-y-6 mt-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('scoring.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('scoring.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-bold text-gray-900">{t('scoring.rules')}</h2>
                </div>
              </div>

              <form onSubmit={createRule} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t('scoring.eventType')}
                  </label>
                  <input
                    type="text"
                    value={ruleForm.eventType}
                    onChange={(e) => setRuleForm((p) => ({ ...p, eventType: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="lead.created"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t('scoring.points')}
                  </label>
                  <input
                    type="number"
                    value={ruleForm.points}
                    onChange={(e) =>
                      setRuleForm((p) => ({ ...p, points: Number(e.target.value) }))
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors',
                    isSubmitting && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t('scoring.newRule')}
                </button>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {t('scoring.conditions')}
                  </label>
                  <input
                    type="text"
                    value={ruleForm.conditions}
                    onChange={(e) => setRuleForm((p) => ({ ...p, conditions: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder='{"urlContains":"checkout","tagIn":"vip"}'
                  />
                </div>
              </form>

              <div className="mt-5 divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                {rules.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">—</div>
                ) : (
                  rules.map((r) => (
                    <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">
                          {r.eventType}{' '}
                          <span className="text-green-700 font-bold">
                            {r.points > 0 ? `+${r.points}` : r.points}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {r.conditions ? JSON.stringify(r.conditions) : '{}'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteRule(r.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-xl transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">{t('scoring.contacts')}</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    placeholder={t('scoring.minScore')}
                  />
                  <button
                    type="button"
                    onClick={fetchData}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-medium transition-colors"
                  >
                    {t('common.filter')}
                  </button>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                />
              </div>

              {isLoading ? (
                <div className="p-10 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500 text-sm">{t('common.loading')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 px-4 py-3">
                          {t('common.name')}
                        </th>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 px-4 py-3">
                          {t('common.phone')}
                        </th>
                        <th className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 px-4 py-3">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredContacts.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                          <td className="px-4 py-3 text-sm font-bold text-green-700">
                            {typeof c.score === 'number' ? c.score : 0}
                          </td>
                        </tr>
                      ))}
                      {filteredContacts.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-sm text-gray-500" colSpan={3}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Webhook className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">{t('scoring.webhookTitle')}</h2>
              </div>
              <p className="text-sm text-gray-600">{t('scoring.webhookSubtitle')}</p>

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700 mb-1">URL</div>
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3 break-all">
                  {webhookUrl}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700 mb-1">Payload</div>
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3 break-all">
                  {JSON.stringify(
                    {
                      userId: user?.id ?? 'USER_ID',
                      type: 'lead.created',
                      phone: '+5511999999999',
                      metadata: { url: 'https://meusite.com/checkout', text: 'quero comprar' },
                    },
                    null,
                    2,
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-900">Condições</h2>
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3">
                  {JSON.stringify({ urlContains: 'checkout' })}
                </div>
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3">
                  {JSON.stringify({ textContains: 'preço' })}
                </div>
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3">
                  {JSON.stringify({ tagIn: 'vip' })}
                </div>
                <div className="text-xs bg-gray-50 border border-gray-100 rounded-xl p-3">
                  {JSON.stringify({ minScore: 50 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
