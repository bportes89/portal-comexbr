'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { Header } from '../../../components/Header';
import api from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../lib/utils';

type Project = {
  id: string;
  name: string;
};

type Breakdown = {
  range: { from: string; to: string };
  totalsByStatus: Record<string, number>;
  byInstance: Record<string, Record<string, number>>;
  byCampaign: Array<{
    id: string;
    name: string;
    instanceName?: string;
    counts: Record<string, number>;
  }>;
  derived?: {
    total: number;
    totalNonPending: number;
    deliveryRate: number;
    readRate: number;
    failureRate: number;
  };
};

type GroupBreakdown = {
  range: { from: string; to: string };
  items: Array<{
    groupId: string | null;
    name: string;
    whatsappId: string;
    countsByStatus: Record<string, number>;
    responses: number;
    total: number;
  }>;
};

const STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const;

function sumCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function getCount(counts: Record<string, number>, statuses: string[]) {
  return statuses.reduce((acc, s) => acc + (counts?.[s] ?? 0), 0);
}

function formatPct(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${(safe * 100).toFixed(1)}%`;
}

function toDateInputValue(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Breakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groupData, setGroupData] = useState<GroupBreakdown | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [failures, setFailures] = useState<
    Array<{
      id: string;
      createdAt: string;
      instanceName?: string;
      campaignId?: string;
      campaignName?: string;
      contactId: string;
      contactName?: string;
      contactPhone?: string;
    }>
  >([]);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [logs, setLogs] = useState<
    Array<{
      id: string;
      action: string;
      entityType?: string;
      entityId?: string;
      projectId?: string;
      createdAt: string;
      metadata?: unknown;
    }>
  >([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsAction, setLogsAction] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get(`/projects?userId=${encodeURIComponent(user.id)}`);
      setProjects(response.data ?? []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  }, [user]);

  const fetchBreakdown = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      if (selectedInstance.trim()) params.set('instanceName', selectedInstance.trim());
      if (selectedCampaign.trim()) params.set('campaignId', selectedCampaign.trim());
      const resp = await api.get(`/analytics/messages-breakdown?${params.toString()}`);
      setData(resp.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId, from, to, selectedInstance, selectedCampaign]);

  const fetchGroupBreakdown = useCallback(async () => {
    if (!user) return;
    setGroupLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      if (selectedInstance.trim()) params.set('instanceName', selectedInstance.trim());
      const resp = await api.get(`/analytics/groups-breakdown?${params.toString()}`);
      setGroupData(resp.data);
    } catch (error) {
      console.error('Error fetching group analytics:', error);
      setGroupData(null);
    } finally {
      setGroupLoading(false);
    }
  }, [user, projectId, from, to, selectedInstance]);

  const fetchFailures = useCallback(async () => {
    if (!user) return;
    setFailuresLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      params.set('take', '50');
      if (projectId.trim()) params.set('projectId', projectId.trim());
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      if (selectedInstance.trim()) params.set('instanceName', selectedInstance.trim());
      if (selectedCampaign.trim()) params.set('campaignId', selectedCampaign.trim());
      const resp = await api.get(`/analytics/failures?${params.toString()}`);
      setFailures(resp.data?.items ?? []);
    } catch (error) {
      console.error('Error fetching failures:', error);
      setFailures([]);
    } finally {
      setFailuresLoading(false);
    }
  }, [user, projectId, from, to, selectedInstance, selectedCampaign]);

  useEffect(() => {
    fetchBreakdown();
    fetchGroupBreakdown();
    fetchFailures();
  }, [fetchBreakdown, fetchGroupBreakdown, fetchFailures]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      params.set('take', '50');
      if (logsAction.trim()) params.set('action', logsAction.trim());
      const resp = await api.get(`/audit/logs?${params.toString()}`);
      setLogs(resp.data ?? []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [user, logsAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totals = useMemo(() => {
    const totalsByStatus = data?.totalsByStatus ?? {};
    const total = sumCounts(totalsByStatus);
    return { totalsByStatus, total };
  }, [data]);

  const instances = useMemo(() => {
    const byInstance = data?.byInstance ?? {};
    return Object.entries(byInstance).map(([name, counts]) => ({
      name,
      counts,
      total: sumCounts(counts),
    }));
  }, [data]);

  const derived = useMemo(() => {
    const fallback = {
      total: totals.total,
      totalNonPending:
        (totals.totalsByStatus?.SENT ?? 0) +
        (totals.totalsByStatus?.DELIVERED ?? 0) +
        (totals.totalsByStatus?.READ ?? 0) +
        (totals.totalsByStatus?.FAILED ?? 0),
      deliveryRate: 0,
      readRate: 0,
      failureRate: 0,
    };

    const d = data?.derived;
    const merged = d
      ? { ...fallback, ...d }
      : fallback;

    const totalNonPending = merged.totalNonPending || 0;
    const delivered =
      (totals.totalsByStatus?.DELIVERED ?? 0) + (totals.totalsByStatus?.READ ?? 0);
    const read = totals.totalsByStatus?.READ ?? 0;
    const failed = totals.totalsByStatus?.FAILED ?? 0;

    return {
      ...merged,
      deliveryRate: totalNonPending > 0 ? delivered / totalNonPending : 0,
      readRate: delivered > 0 ? read / delivered : 0,
      failureRate: totalNonPending > 0 ? failed / totalNonPending : 0,
    };
  }, [data, totals]);

  const applyPreset = useCallback((preset: 'today' | '7d' | '30d') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = today;
    let start = today;
    if (preset === '7d') start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    if (preset === '30d') start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    setFrom(toDateInputValue(start));
    setTo(toDateInputValue(end));
  }, []);

  return (
    <>
      <Header />

      <main className="p-6 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Activity className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{t('sidebar.analytics')}</h1>
                <p className="text-sm text-slate-400">Métricas reais por período, campanha e número</p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchBreakdown}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors hover:border-white/20"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading ? 'animate-spin' : '')} />
              Atualizar
            </button>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">De</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Até</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Total</label>
              <div className="px-4 py-2 bg-slate-800/30 border border-white/5 rounded-lg text-sm text-white font-bold">
                {totals.total.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => applyPreset('7d')}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset('30d')}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              30 dias
            </button>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Filtrar por projeto</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
              >
                <option value="">Pessoal</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Filtrar por instância</label>
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
              >
                <option value="">Todas</option>
                {Object.keys(data?.byInstance ?? {}).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-300">Filtrar por campanha</label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
              >
                <option value="">Todas</option>
                {(data?.byCampaign ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5">
              <div className="text-sm text-slate-400">Taxa de entrega</div>
              <div className="text-2xl font-bold text-white">
                {isLoading ? '-' : formatPct(derived.deliveryRate)}
              </div>
            </div>
            <div className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5">
              <div className="text-sm text-slate-400">Taxa de leitura</div>
              <div className="text-2xl font-bold text-white">
                {isLoading ? '-' : formatPct(derived.readRate)}
              </div>
            </div>
            <div className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5">
              <div className="text-sm text-slate-400">Taxa de falha</div>
              <div className="text-2xl font-bold text-white">
                {isLoading ? '-' : formatPct(derived.failureRate)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
              <h2 className="text-white font-bold mb-4">Por status</h2>
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <div className="space-y-3">
                  {STATUSES.map((s) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{s}</span>
                      <span className="text-white font-bold">
                        {(totals.totalsByStatus?.[s] ?? 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
              <h2 className="text-white font-bold mb-4">Por número (instância)</h2>
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-white/5">
                        <th className="py-2 pr-4">Instância</th>
                        {STATUSES.map((s) => (
                          <th key={s} className="py-2 pr-4">{s}</th>
                        ))}
                        <th className="py-2 pr-4">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instances.map((row) => (
                        <tr key={row.name} className="border-b border-white/5 text-slate-200">
                          <td className="py-3 pr-4 font-medium">{row.name}</td>
                          {STATUSES.map((s) => (
                            <td key={s} className="py-3 pr-4">
                              {(row.counts?.[s] ?? 0).toLocaleString()}
                            </td>
                          ))}
                          <td className="py-3 pr-4 font-bold text-white">
                            {row.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {instances.length === 0 && (
                        <tr>
                          <td className="py-6 text-slate-400" colSpan={STATUSES.length + 2}>
                            Sem dados no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
            <h2 className="text-white font-bold mb-4">Por campanha</h2>
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/5">
                      <th className="py-2 pr-4">Campanha</th>
                      <th className="py-2 pr-4">Instância</th>
                      {STATUSES.map((s) => (
                        <th key={s} className="py-2 pr-4">{s}</th>
                      ))}
                      <th className="py-2 pr-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byCampaign ?? []).map((c) => {
                      const total = sumCounts(c.counts ?? {});
                      return (
                        <tr key={c.id} className="border-b border-white/5 text-slate-200">
                          <td className="py-3 pr-4 font-medium">{c.name}</td>
                          <td className="py-3 pr-4">{c.instanceName ?? '-'}</td>
                          {STATUSES.map((s) => (
                            <td key={s} className="py-3 pr-4">
                              {(c.counts?.[s] ?? 0).toLocaleString()}
                            </td>
                          ))}
                          <td className="py-3 pr-4 font-bold text-white">
                            {total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {(data?.byCampaign ?? []).length === 0 && (
                      <tr>
                        <td className="py-6 text-slate-400" colSpan={STATUSES.length + 3}>
                          Sem campanhas no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">Por grupo</h2>
              <button
                type="button"
                onClick={fetchGroupBreakdown}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors hover:border-white/20"
              >
                <RefreshCw className={cn('h-4 w-4', groupLoading ? 'animate-spin' : '')} />
                Atualizar
              </button>
            </div>

            {groupLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/5">
                      <th className="py-2 pr-4">Grupo</th>
                      <th className="py-2 pr-4">Envios</th>
                      <th className="py-2 pr-4">Entregues</th>
                      <th className="py-2 pr-4">Respostas</th>
                      <th className="py-2 pr-4">Falhas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupData?.items ?? []).map((g) => {
                      const sends = getCount(g.countsByStatus ?? {}, ['SENT', 'DELIVERED', 'READ']);
                      const delivered = getCount(g.countsByStatus ?? {}, ['DELIVERED', 'READ']);
                      const failed = getCount(g.countsByStatus ?? {}, ['FAILED']);
                      return (
                        <tr key={g.whatsappId} className="border-b border-white/5 text-slate-200">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-white">{g.name}</div>
                            <div className="text-xs text-slate-400 break-all">{g.whatsappId}</div>
                          </td>
                          <td className="py-3 pr-4">{sends.toLocaleString()}</td>
                          <td className="py-3 pr-4">{delivered.toLocaleString()}</td>
                          <td className="py-3 pr-4">{(g.responses ?? 0).toLocaleString()}</td>
                          <td className="py-3 pr-4">{failed.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {(groupData?.items ?? []).length === 0 && (
                      <tr>
                        <td className="py-6 text-slate-400" colSpan={5}>
                          Sem grupos no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">Falhas recentes</h2>
              <button
                type="button"
                onClick={fetchFailures}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors hover:border-white/20"
              >
                <RefreshCw className={cn('h-4 w-4', failuresLoading ? 'animate-spin' : '')} />
                Atualizar
              </button>
            </div>

            {failuresLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/5">
                      <th className="py-2 pr-4">Data</th>
                      <th className="py-2 pr-4">Contato</th>
                      <th className="py-2 pr-4">Telefone</th>
                      <th className="py-2 pr-4">Campanha</th>
                      <th className="py-2 pr-4">Instância</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((f) => (
                      <tr key={f.id} className="border-b border-white/5 text-slate-200">
                        <td className="py-3 pr-4">{new Date(f.createdAt).toLocaleString()}</td>
                        <td className="py-3 pr-4 font-medium text-white">
                          {f.contactName ?? '-'}
                        </td>
                        <td className="py-3 pr-4">{f.contactPhone ?? '-'}</td>
                        <td className="py-3 pr-4">{f.campaignName ?? '-'}</td>
                        <td className="py-3 pr-4">{f.instanceName ?? '-'}</td>
                      </tr>
                    ))}
                    {failures.length === 0 && (
                      <tr>
                        <td className="py-6 text-slate-400" colSpan={5}>
                          Sem falhas no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">Logs de Auditoria</h2>
              <button
                type="button"
                onClick={fetchLogs}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors hover:border-white/20"
              >
                <RefreshCw className={cn('h-4 w-4', logsLoading ? 'animate-spin' : '')} />
                Atualizar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Filtrar por ação</label>
                <input
                  type="text"
                  value={logsAction}
                  onChange={(e) => setLogsAction(e.target.value)}
                  placeholder="ex: project.member.upsert"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                />
              </div>
            </div>

            {logsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/5">
                      <th className="py-2 pr-4">Data</th>
                      <th className="py-2 pr-4">Ação</th>
                      <th className="py-2 pr-4">Entidade</th>
                      <th className="py-2 pr-4">ID</th>
                      <th className="py-2 pr-4">Projeto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b border-white/5 text-slate-200">
                        <td className="py-3 pr-4">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 font-medium text-white">{l.action}</td>
                        <td className="py-3 pr-4">{l.entityType ?? '-'}</td>
                        <td className="py-3 pr-4">{l.entityId ?? '-'}</td>
                        <td className="py-3 pr-4">{l.projectId ?? '-'}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td className="py-6 text-slate-400" colSpan={5}>
                          Sem logs recentes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
