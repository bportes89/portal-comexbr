'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  UsersRound,
  Calendar,
  X,
  Loader2,
  Trash2,
  Send,
  ListOrdered,
  Download,
  Link2,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { Header } from '../../../components/Header';
import api from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';

interface Group {
  id: string;
  name: string;
  whatsappId: string;
  userId: string;
  createdAt: string;
}

type EvolutionGroupMetadata = {
  id?: string;
  subject?: string;
  desc?: string | null;
  size?: number;
  creation?: number;
};

type MessageTemplate = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

interface WhatsappSession {
  id: string;
  name: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
}

export default function Groups() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');

  const [sessions, setSessions] = useState<WhatsappSession[]>([]);
  const [instanceName, setInstanceName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [sendTemplateId, setSendTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', whatsappId: '' });
  const [createMode, setCreateMode] = useState<'manual' | 'whatsapp'>('manual');
  const [participantsText, setParticipantsText] = useState('');

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendGroup, setSendGroup] = useState<Group | null>(null);
  const [sendText, setSendText] = useState('');
  const [sendDelayMs, setSendDelayMs] = useState(0);
  const [sendMediaFile, setSendMediaFile] = useState<File | null>(null);
  const [sendMediaCaption, setSendMediaCaption] = useState('');
  const [sendMediaType, setSendMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [sendMediaMime, setSendMediaMime] = useState('');
  const [sendMediaBase64, setSendMediaBase64] = useState('');
  const [sendMediaFileName, setSendMediaFileName] = useState('');

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteGroup, setInviteGroup] = useState<Group | null>(null);
  const [inviteNumbersText, setInviteNumbersText] = useState('');
  const [inviteDescription, setInviteDescription] = useState('');

  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [participantsGroup, setParticipantsGroup] = useState<Group | null>(null);
  const [participantsAction, setParticipantsAction] = useState<'add' | 'remove'>('add');
  const [participantsNumbersText, setParticipantsNumbersText] = useState('');

  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataGroup, setMetadataGroup] = useState<Group | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataSubject, setMetadataSubject] = useState('');
  const [metadataDescription, setMetadataDescription] = useState('');
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);
  const [sequenceGroup, setSequenceGroup] = useState<Group | null>(null);
  const [sequenceSteps, setSequenceSteps] = useState<
    Array<{ text: string; delayMs: number }>
  >([{ text: '', delayMs: 0 }]);

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

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      const response = await api.get(`/whatsapp/sessions?${params.toString()}`);
      setSessions(response.data);
      if (response.data.length > 0 && !instanceName) {
        setInstanceName(response.data[0].name);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      if (!instanceName) setInstanceName('Evolution1');
    }
  }, [instanceName, projectId, user]);

  const fetchGroups = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (user) params.set('userId', user.id);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      const url = params.toString().length > 0 ? `/groups?${params.toString()}` : '/groups';
      const response = await api.get(url);
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups((prev) => {
        if (prev.length > 0) return prev;
        const now = new Date().toISOString();
        return [
          {
            id: '1',
            name: 'Grupo de Lançamento',
            whatsappId: '1203630XXXXXXXX@g.us',
            userId: user?.id ?? 'mock-user-id',
            createdAt: now,
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, user]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      const response = await api.get(`/templates?${params.toString()}`);
      setTemplates(response.data ?? []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    }
  }, [projectId, user]);

  useEffect(() => {
    if (!openMenuId) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-group-menu]')) return;
      setOpenMenuId(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((g) => {
      return (
        g.name.toLowerCase().includes(term) ||
        g.whatsappId.toLowerCase().includes(term)
      );
    });
  }, [groups, searchTerm]);

  const parseParticipants = useCallback((value: string) => {
    return value
      .split(/[\n,; ]+/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, []);

  const parsePhonesFromCsv = useCallback((csvText: string) => {
    const lines = csvText.split(/\r?\n/g);
    const phones: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cells = trimmed.split(/[;,|\t,]/g);
      for (const cell of cells) {
        const raw = cell.replace(/["']/g, '').trim();
        if (!raw) continue;
        const digits = raw.replace(/\D+/g, '');
        if (!digits) continue;
        phones.push(digits);
      }
    }
    return Array.from(new Set(phones));
  }, []);

  const appendNumbersText = useCallback((prev: string, next: string[]) => {
    const existing = parseParticipants(prev);
    const merged = Array.from(new Set([...existing, ...next]));
    return merged.join('\n');
  }, [parseParticipants]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (createMode === 'whatsapp') {
        if (!instanceName) {
          alert(t('common.error'));
          return;
        }
        const participants = parseParticipants(participantsText);
        if (participants.length === 0) {
          alert(t('common.error'));
          return;
        }
        await api.post('/groups/create-wa', {
          name: formData.name,
          participants,
          instanceName,
          userId: user.id,
          projectId: projectId.trim() ? projectId.trim() : undefined,
        });
      } else {
        await api.post('/groups', {
          name: formData.name,
          whatsappId: formData.whatsappId,
          userId: user.id,
          projectId: projectId.trim() ? projectId.trim() : undefined,
        });
      }
      setIsModalOpen(false);
      setFormData({ name: '', whatsappId: '' });
      setParticipantsText('');
      setCreateMode('manual');
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      alert(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInviteCode = async (group: Group) => {
    if (!user) {
      alert(t('common.error'));
      return;
    }
    if (!instanceName) {
      alert(t('common.error'));
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('userId', user.id);
      params.set('instanceName', instanceName);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      const response = await api.get(`/groups/${group.id}/invite-code?${params.toString()}`);
      const inviteUrl = response?.data?.inviteUrl;
      const inviteCode = response?.data?.inviteCode;
      const url =
        typeof inviteUrl === 'string' && inviteUrl.length > 0
          ? inviteUrl
          : typeof inviteCode === 'string' && inviteCode.length > 0
            ? `https://chat.whatsapp.com/${inviteCode}`
            : '';
      if (!url) {
        alert(t('common.error'));
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copiado');
      } catch {
        alert(url);
      }
    } catch (error) {
      console.error('Error fetching invite code:', error);
      alert(t('common.error'));
    }
  };

  const deleteGroup = async (id: string) => {
    const confirmed = window.confirm(t('common.confirmDelete'));
    if (!confirmed) return;
    try {
      const params = new URLSearchParams();
      if (user) params.set('userId', user.id);
      if (projectId.trim()) params.set('projectId', projectId.trim());
      const url =
        params.toString().length > 0 ? `/groups/${id}?${params.toString()}` : `/groups/${id}`;
      await api.delete(url);
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error('Error deleting group:', error);
      alert(t('common.error'));
    }
  };

  const openSend = (group: Group) => {
    setSendGroup(group);
    setSendText('');
    setSendDelayMs(0);
    setSendTemplateId('');
    setNewTemplateName('');
    setSendMediaFile(null);
    setSendMediaCaption('');
    setSendMediaType('image');
    setSendMediaMime('');
    setSendMediaBase64('');
    setSendMediaFileName('');
    setIsSendModalOpen(true);
  };

  const openSequence = (group: Group) => {
    setSequenceGroup(group);
    setSequenceSteps([{ text: '', delayMs: 0 }]);
    setIsSequenceModalOpen(true);
  };

  const handleSendToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendGroup) return;
    if (!instanceName) {
      alert(t('common.error'));
      return;
    }
    const hasMedia =
      sendMediaFile !== null &&
      sendMediaFileName.trim().length > 0 &&
      sendMediaBase64.trim().length > 0;
    setIsSubmitting(true);
    try {
      if (hasMedia) {
        await api.post(`/groups/${sendGroup.id}/send-media`, {
          instanceName,
          mediaType: sendMediaType,
          mimeType: sendMediaMime,
          media: sendMediaBase64,
          fileName: sendMediaFileName,
          caption: sendMediaCaption?.trim() || undefined,
          delay: sendDelayMs,
          userId: user?.id,
          projectId: projectId.trim() ? projectId.trim() : undefined,
        });
      } else {
        await api.post(`/groups/${sendGroup.id}/send`, {
          instanceName,
          text: sendText,
          delay: sendDelayMs,
          userId: user?.id,
          projectId: projectId.trim() ? projectId.trim() : undefined,
        });
      }
      setIsSendModalOpen(false);
      setSendGroup(null);
    } catch (error) {
      console.error('Error sending message to group:', error);
      alert(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSequenceToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sequenceGroup) return;
    if (!instanceName) {
      alert(t('common.error'));
      return;
    }
    const steps = sequenceSteps
      .map((s) => ({ text: s.text.trim(), delayMs: Number(s.delayMs) || 0 }))
      .filter((s) => s.text.length > 0);

    if (steps.length === 0) {
      alert(t('common.error'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/groups/${sequenceGroup.id}/sequence`, {
        instanceName,
        steps,
        userId: user?.id,
        projectId: projectId.trim() ? projectId.trim() : undefined,
      });
      setIsSequenceModalOpen(false);
      setSequenceGroup(null);
    } catch (error) {
      console.error('Error scheduling sequence:', error);
      alert(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportGroups = async () => {
    if (!user) return;
    if (!instanceName) {
      alert(t('common.error'));
      return;
    }

    setIsImporting(true);
    try {
      const response = await api.post('/groups/import', {
        userId: user.id,
        instanceName,
        projectId: projectId.trim() ? projectId.trim() : undefined,
      });
      await fetchGroups();
      const imported = response?.data?.imported;
      const total = response?.data?.total;
      if (typeof imported === 'number' && typeof total === 'number') {
        alert(`Importado: ${imported} / ${total}`);
      }
    } catch (error) {
      console.error('Error importing groups:', error);
      alert(t('common.error'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Header />

      <div className="space-y-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('groups.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('groups.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-colors border border-white/10"
            >
              <option value="">Pessoal</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleImportGroups}
              disabled={isImporting || !instanceName}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-colors border border-white/10',
                (isImporting || !instanceName) && 'opacity-70 cursor-not-allowed',
              )}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('groups.import')}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-green-600/20"
            >
              <Plus className="h-4 w-4" />
              {t('groups.new')}
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('groups.search')}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 text-sm">{t('common.loading')}</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersRound className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('groups.noGroups')}</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">{t('groups.createFirst')}</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('groups.new')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 bg-green-50 text-green-700 border-green-200">
                    <UsersRound className="h-3 w-3" />
                    {t('common.groups')}
                  </div>

                  <div className="relative" data-group-menu>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId((prev) => (prev === group.id ? null : group.id))
                      }
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === group.id}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuId === group.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-10">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            openSend(group);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Send className="h-4 w-4 text-gray-500" />
                          {t('groups.actions.send')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            openSequence(group);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ListOrdered className="h-4 w-4 text-gray-500" />
                          {t('groups.actions.sequence')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setParticipantsGroup(group);
                            setParticipantsAction('add');
                            setParticipantsNumbersText('');
                            setIsParticipantsModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <UserPlus className="h-4 w-4 text-gray-500" />
                          Participantes
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setOpenMenuId(null);
                            if (!user || !instanceName) {
                              alert(t('common.error'));
                              return;
                            }
                            setMetadataGroup(group);
                            setIsMetadataModalOpen(true);
                            setMetadataLoading(true);
                            try {
                              const params = new URLSearchParams();
                              params.set('userId', user.id);
                              params.set('instanceName', instanceName);
                              if (projectId.trim()) params.set('projectId', projectId.trim());
                              const resp = await api.get(
                                `/groups/${group.id}/metadata?${params.toString()}`,
                              );
                              const md = resp?.data as EvolutionGroupMetadata | null;
                              setMetadataSubject(md?.subject ?? group.name);
                              setMetadataDescription(md?.desc ?? '');
                            } catch (error) {
                              console.error('Error fetching group metadata:', error);
                              setMetadataSubject(group.name);
                              setMetadataDescription('');
                            } finally {
                              setMetadataLoading(false);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Pencil className="h-4 w-4 text-gray-500" />
                          Editar grupo
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setOpenMenuId(null);
                            await getInviteCode(group);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Link2 className="h-4 w-4 text-gray-500" />
                          Link de convite
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setInviteGroup(group);
                            setInviteNumbersText('');
                            setInviteDescription('');
                            setIsInviteModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Link2 className="h-4 w-4 text-gray-500" />
                          Enviar convite
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setOpenMenuId(null);
                            await deleteGroup(group.id);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                  {group.name}
                </h3>
                <p className="text-gray-500 text-sm mb-4 break-all">{group.whatsappId}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(group.createdAt).toLocaleDateString(
                      language === 'pt' ? 'pt-BR' : 'en-US',
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">{t('groups.new')}</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCreateGroup} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={createMode}
                    onChange={(e) =>
                      setCreateMode(e.target.value === 'whatsapp' ? 'whatsapp' : 'manual')
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                  >
                    <option value="manual">Já tenho o ID do grupo</option>
                    <option value="whatsapp">Criar no WhatsApp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('groups.form.name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="Ex: Grupo Black Friday"
                  />
                </div>

                {createMode === 'manual' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('groups.form.whatsappId')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.whatsappId}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, whatsappId: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      placeholder="1203630XXXXXXXX@g.us"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Instância
                      </label>
                      {sessions.length > 0 ? (
                        <select
                          value={instanceName}
                          onChange={(e) => setInstanceName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                        >
                          {sessions.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Nenhuma instância conectada
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Participantes
                      </label>
                      <textarea
                        required
                        value={participantsText}
                        onChange={(e) => setParticipantsText(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-24"
                        placeholder="5531900000000, 5531911111111"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2',
                      isSubmitting && 'opacity-70 cursor-not-allowed',
                    )}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isSendModalOpen && sendGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t('groups.actions.send')}
                </h2>
                <p className="text-sm text-gray-500">{sendGroup.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSendModalOpen(false);
                  setSendGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSendToGroup} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instância
                  </label>
                  {sessions.length > 0 ? (
                    <select
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      placeholder="Evolution1"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delay (ms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={sendDelayMs}
                    onChange={(e) => setSendDelayMs(Number(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensagem
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    <select
                      value={sendTemplateId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSendTemplateId(id);
                        const tpl = templates.find((t) => t.id === id);
                        if (tpl) setSendText(tpl.content);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                    >
                      <option value="">Sem template</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                        placeholder="Nome do template"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!user) return;
                          const name = newTemplateName.trim();
                          const content = sendText.trim();
                          if (!name || !content) {
                            alert(t('common.error'));
                            return;
                          }
                          try {
                            const payload: { userId: string; projectId?: string; name: string; content: string } = {
                              userId: user.id,
                              name,
                              content,
                            };
                            if (projectId.trim()) payload.projectId = projectId.trim();
                            await api.post('/templates', payload);
                            setNewTemplateName('');
                            await fetchTemplates();
                          } catch (error) {
                            console.error('Error creating template:', error);
                            alert(t('common.error'));
                          }
                        }}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                  <textarea
                    required
                    value={sendText}
                    onChange={(e) => setSendText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all h-28 resize-none"
                    placeholder="Digite a mensagem..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enviar mídia (opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*,application/pdf,application/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        setSendMediaFile(file);
                        setSendMediaCaption('');
                        setSendMediaBase64('');
                        setSendMediaFileName('');
                        setSendMediaMime('');
                        if (!file) return;
                        const mime = file.type || '';
                        setSendMediaMime(mime);
                        const main = mime.split('/')[0];
                        const mediaType =
                          main === 'image' || main === 'video' || main === 'audio'
                            ? (main as 'image' | 'video' | 'audio')
                            : 'document';
                        setSendMediaType(mediaType);
                        setSendMediaFileName(file.name || 'file');
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = typeof reader.result === 'string' ? reader.result : '';
                          const base64 = result.includes(',') ? result.split(',')[1] : result;
                          setSendMediaBase64(base64);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Legenda da mídia
                    </label>
                    <input
                      type="text"
                      value={sendMediaCaption}
                      onChange={(e) => setSendMediaCaption(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSendModalOpen(false);
                      setSendGroup(null);
                    }}
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2',
                      isSubmitting && 'opacity-70 cursor-not-allowed',
                    )}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isSequenceModalOpen && sequenceGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t('groups.actions.sequence')}
                </h2>
                <p className="text-sm text-gray-500">{sequenceGroup.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSequenceModalOpen(false);
                  setSequenceGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSequenceToGroup} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instância
                  </label>
                  {sessions.length > 0 ? (
                    <select
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                      placeholder="Evolution1"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {sequenceSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-4"
                    >
                      <div className="md:col-span-1">
                        <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">
                          Delay (ms)
                        </label>
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
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-xs text-gray-500 font-semibold uppercase mb-1">
                          Mensagem
                        </label>
                        <textarea
                          value={step.text}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSequenceSteps((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, text: value } : s)),
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all h-20 resize-none bg-white"
                          placeholder="Digite a mensagem..."
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          {sequenceSteps.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSequenceSteps((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-sm font-medium text-red-600 hover:text-red-700"
                              disabled={isSubmitting}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setSequenceSteps((prev) => [...prev, { text: '', delayMs: 0 }])
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar etapa
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSequenceModalOpen(false);
                      setSequenceGroup(null);
                    }}
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2',
                      isSubmitting && 'opacity-70 cursor-not-allowed',
                    )}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ListOrdered className="h-4 w-4" />
                    )}
                    Agendar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isInviteModalOpen && inviteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Enviar convite</h2>
                <p className="text-sm text-gray-500">{inviteGroup.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user || !inviteGroup) return;
                  if (!instanceName) {
                    alert(t('common.error'));
                    return;
                  }
                  const numbers = parseParticipants(inviteNumbersText);
                  if (numbers.length === 0) {
                    alert(t('common.error'));
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    await api.post(`/groups/${inviteGroup.id}/invite`, {
                      userId: user.id,
                      projectId: projectId.trim() ? projectId.trim() : undefined,
                      instanceName,
                      numbers,
                      description: inviteDescription.trim() || undefined,
                    });
                    setIsInviteModalOpen(false);
                    setInviteGroup(null);
                    setInviteNumbersText('');
                    setInviteDescription('');
                  } catch (error) {
                    console.error('Error sending invite:', error);
                    alert(t('common.error'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instância
                  </label>
                  {sessions.length > 0 ? (
                    <select
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Nenhuma instância conectada
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Números
                  </label>
                  <textarea
                    required
                    value={inviteNumbersText}
                    onChange={(e) => setInviteNumbersText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-24"
                    placeholder="5531900000000, 5531911111111"
                  />
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const nums = parsePhonesFromCsv(text);
                          setInviteNumbersText((prev) => appendNumbersText(prev, nums));
                        } catch (error) {
                          console.error('Error importing CSV:', error);
                          alert(t('common.error'));
                        }
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={inviteDescription}
                    onChange={(e) => setInviteDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="Convite para o grupo de ofertas"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setInviteGroup(null);
                    }}
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2',
                      isSubmitting && 'opacity-70 cursor-not-allowed',
                    )}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Enviar convite
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isParticipantsModalOpen && participantsGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Participantes</h2>
                <p className="text-sm text-gray-500">{participantsGroup.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsParticipantsModalOpen(false);
                  setParticipantsGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user || !participantsGroup) return;
                  if (!instanceName) {
                    alert(t('common.error'));
                    return;
                  }
                  const participants = parseParticipants(participantsNumbersText);
                  if (participants.length === 0) {
                    alert(t('common.error'));
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    await api.post(`/groups/${participantsGroup.id}/participants`, {
                      userId: user.id,
                      projectId: projectId.trim() ? projectId.trim() : undefined,
                      instanceName,
                      action: participantsAction,
                      participants,
                    });
                    setIsParticipantsModalOpen(false);
                    setParticipantsGroup(null);
                    setParticipantsNumbersText('');
                  } catch (error) {
                    console.error('Error updating participants:', error);
                    alert(t('common.error'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instância
                  </label>
                  {sessions.length > 0 ? (
                    <select
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Nenhuma instância conectada
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ação
                  </label>
                  <select
                    value={participantsAction}
                    onChange={(e) =>
                      setParticipantsAction(e.target.value === 'remove' ? 'remove' : 'add')
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                  >
                    <option value="add">Adicionar</option>
                    <option value="remove">Remover</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Números
                  </label>
                  <textarea
                    required
                    value={participantsNumbersText}
                    onChange={(e) => setParticipantsNumbersText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-24"
                    placeholder="5531900000000, 5531911111111"
                  />
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const nums = parsePhonesFromCsv(text);
                          setParticipantsNumbersText((prev) => appendNumbersText(prev, nums));
                        } catch (error) {
                          console.error('Error importing CSV:', error);
                          alert(t('common.error'));
                        }
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsParticipantsModalOpen(false);
                      setParticipantsGroup(null);
                    }}
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2',
                      isSubmitting && 'opacity-70 cursor-not-allowed',
                    )}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isMetadataModalOpen && metadataGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Editar grupo</h2>
                <p className="text-sm text-gray-500">{metadataGroup.whatsappId}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMetadataModalOpen(false);
                  setMetadataGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user || !metadataGroup) return;
                  if (!instanceName) {
                    alert(t('common.error'));
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    const resp = await api.put(`/groups/${metadataGroup.id}/metadata`, {
                      userId: user.id,
                      projectId: projectId.trim() ? projectId.trim() : undefined,
                      instanceName,
                      subject: metadataSubject.trim() || undefined,
                      description: metadataDescription.trim() || undefined,
                    });
                    if (!resp?.data?.updated) {
                      alert(t('common.error'));
                      return;
                    }
                    await fetchGroups();
                    setIsMetadataModalOpen(false);
                    setMetadataGroup(null);
                  } catch (error) {
                    console.error('Error updating group metadata:', error);
                    alert(t('common.error'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instância
                  </label>
                  {sessions.length > 0 ? (
                    <select
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Nenhuma instância conectada
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome (subject)
                  </label>
                  <input
                    type="text"
                    required
                    value={metadataSubject}
                    onChange={(e) => setMetadataSubject(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    disabled={metadataLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={metadataDescription}
                    onChange={(e) => setMetadataDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-24"
                    disabled={metadataLoading}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMetadataModalOpen(false);
                      setMetadataGroup(null);
                    }}
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      'px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2',
                      (isSubmitting || metadataLoading) && 'opacity-70 cursor-not-allowed',
                    )}
                    disabled={isSubmitting || metadataLoading}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
