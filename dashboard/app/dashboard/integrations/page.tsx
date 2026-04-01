'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2, Webhook, Plug } from 'lucide-react';
import { Header } from '../../../components/Header';
import api from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';

type IncomingEndpoint = {
  id: string;
  name: string;
  provider: string;
  token: string;
  enabled: boolean;
  projectId?: string | null;
  createdAt: string;
};

type OutgoingWebhook = {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  projectId?: string | null;
  createdAt: string;
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [incoming, setIncoming] = useState<IncomingEndpoint[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingWebhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [incomingForm, setIncomingForm] = useState({
    name: 'Hotmart Webhook',
    provider: 'HOTMART',
    phoneField: 'buyer.phone',
    eventTypeField: 'event',
  });

  const [outgoingForm, setOutgoingForm] = useState({
    name: 'Webhook CRM',
    url: '',
    eventTypes: 'purchase.cart_abandoned,purchase.approved',
    secret: '',
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [incomingResp, outgoingResp] = await Promise.all([
        api.get(`/integrations/incoming-endpoints?userId=${encodeURIComponent(user.id)}`),
        api.get(`/integrations/outgoing-webhooks?userId=${encodeURIComponent(user.id)}`),
      ]);
      setIncoming(incomingResp.data ?? []);
      setOutgoing(outgoingResp.data ?? []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const apiBase = useMemo(() => {
    const base =
      (api.defaults.baseURL && String(api.defaults.baseURL)) || 'http://localhost:3000';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const createIncoming = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      await api.post('/integrations/incoming-endpoints', {
        userId: user.id,
        name: incomingForm.name,
        provider: incomingForm.provider,
        mapping: {
          phoneField: incomingForm.phoneField,
          eventTypeField: incomingForm.eventTypeField,
        },
      });
      await fetchData();
    } catch (error) {
      console.error('Error creating incoming endpoint:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteIncoming = async (id: string) => {
    if (!user) return;
    try {
      await api.delete(
        `/integrations/incoming-endpoints/${encodeURIComponent(id)}?userId=${encodeURIComponent(user.id)}`,
      );
      await fetchData();
    } catch (error) {
      console.error('Error deleting incoming endpoint:', error);
    }
  };

  const createOutgoing = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const eventTypes = outgoingForm.eventTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.post('/integrations/outgoing-webhooks', {
        userId: user.id,
        name: outgoingForm.name,
        url: outgoingForm.url,
        eventTypes,
        secret: outgoingForm.secret || undefined,
      });
      await fetchData();
    } catch (error) {
      console.error('Error creating outgoing webhook:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOutgoing = async (id: string) => {
    if (!user) return;
    try {
      await api.delete(
        `/integrations/outgoing-webhooks/${encodeURIComponent(id)}?userId=${encodeURIComponent(user.id)}`,
      );
      await fetchData();
    } catch (error) {
      console.error('Error deleting outgoing webhook:', error);
    }
  };

  return (
    <>
      <Header />
      <main className="p-6 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Plug className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('sidebar.integrations')}</h1>
              <p className="text-sm text-slate-400">
                Webhooks de entrada/saída e mapeamento de eventos → ações
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-green-400" />
                  Entrada (receber eventos)
                </h2>
              </div>

              <form onSubmit={createIncoming} className="space-y-3 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={incomingForm.name}
                    onChange={(e) => setIncomingForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nome do endpoint"
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                  <select
                    value={incomingForm.provider}
                    onChange={(e) =>
                      setIncomingForm((p) => ({ ...p, provider: e.target.value }))
                    }
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  >
                    <option value="HOTMART">Hotmart</option>
                    <option value="ACTIVECAMPAIGN">ActiveCampaign</option>
                    <option value="CRM">CRM</option>
                    <option value="WEBHOOK">Webhook</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={incomingForm.phoneField}
                    onChange={(e) =>
                      setIncomingForm((p) => ({ ...p, phoneField: e.target.value }))
                    }
                    placeholder="Campo do telefone (ex: buyer.phone)"
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                  <input
                    value={incomingForm.eventTypeField}
                    onChange={(e) =>
                      setIncomingForm((p) => ({ ...p, eventTypeField: e.target.value }))
                    }
                    placeholder="Campo do evento (ex: event)"
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Criar endpoint
                </button>
              </form>

              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <div className="space-y-3">
                  {incoming.map((e) => (
                    <div
                      key={e.id}
                      className="p-4 bg-slate-800/30 rounded-xl border border-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{e.name}</div>
                          <div className="text-xs text-slate-400">{e.provider}</div>
                          <div className="mt-2 text-xs text-slate-300 break-all">
                            URL: {apiBase}/integrations/in/{e.token}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteIncoming(e.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {incoming.length === 0 && (
                    <div className="text-sm text-slate-400">Nenhum endpoint criado.</div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-green-400" />
                  Saída (enviar eventos)
                </h2>
              </div>

              <form onSubmit={createOutgoing} className="space-y-3 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={outgoingForm.name}
                    onChange={(e) => setOutgoingForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nome da assinatura"
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                  <input
                    value={outgoingForm.url}
                    onChange={(e) => setOutgoingForm((p) => ({ ...p, url: e.target.value }))}
                    placeholder="URL do webhook (https://...)"
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                  />
                </div>
                <input
                  value={outgoingForm.eventTypes}
                  onChange={(e) =>
                    setOutgoingForm((p) => ({ ...p, eventTypes: e.target.value }))
                  }
                  placeholder="Tipos de evento (separados por vírgula)"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                />
                <input
                  value={outgoingForm.secret}
                  onChange={(e) =>
                    setOutgoingForm((p) => ({ ...p, secret: e.target.value }))
                  }
                  placeholder="Segredo (opcional)"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Criar assinatura
                </button>
              </form>

              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <div className="space-y-3">
                  {outgoing.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 bg-slate-800/30 rounded-xl border border-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{w.name}</div>
                          <div className="text-xs text-slate-400 break-all">{w.url}</div>
                          <div className="mt-2 text-xs text-slate-300">
                            Eventos: {(w.eventTypes ?? []).join(', ') || '-'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteOutgoing(w.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {outgoing.length === 0 && (
                    <div className="text-sm text-slate-400">Nenhuma assinatura criada.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

