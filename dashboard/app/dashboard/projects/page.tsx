'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Calendar,
  X,
  Loader2,
  Trash2,
  FolderKanban,
  Users,
  UserPlus,
} from 'lucide-react';
import { Header } from '../../../components/Header';
import api, { isDemoMode } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';

interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

interface ProjectMember {
  id: string;
  role: string;
  userId: string;
  email: string;
  name?: string | null;
}

export default function Projects() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '' });

  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [membersProject, setMembersProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [membersSubmitting, setMembersSubmitting] = useState(false);

  const demoKey = useMemo(() => {
    return `demo:projects:${user?.id ?? 'anonymous'}`;
  }, [user?.id]);

  const loadDemoProjects = useCallback((): Project[] => {
    if (!isDemoMode()) return [];
    try {
      const raw = window.localStorage.getItem(demoKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p) => p && typeof p === 'object') as Project[];
    } catch {
      return [];
    }
  }, [demoKey]);

  const saveDemoProjects = useCallback(
    (next: Project[]) => {
      if (!isDemoMode()) return;
      try {
        window.localStorage.setItem(demoKey, JSON.stringify(next));
      } catch {
        return;
      }
    },
    [demoKey],
  );

  const fetchProjects = useCallback(async () => {
    try {
      const url = user ? `/projects?userId=${encodeURIComponent(user.id)}` : '/projects';
      const response = await api.get(url);
      setProjects(response.data);
    } catch (error) {
      if (isDemoMode()) {
        setProjects(loadDemoProjects());
      } else {
        console.error('Error fetching projects:', error);
        setProjects((prev) => {
          if (prev.length > 0) return prev;
          const now = new Date().toISOString();
          return [
            {
              id: '1',
              name: 'Lançamento Março',
              ownerId: user?.id ?? 'mock-user-id',
              createdAt: now,
            },
          ];
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadDemoProjects, user]);

  const fetchMembers = useCallback(
    async (project: Project) => {
      if (!user) return;
      setMembersLoading(true);
      try {
        const response = await api.get(
          `/projects/${encodeURIComponent(project.id)}/members?userId=${encodeURIComponent(user.id)}`,
        );
        setMembers(response.data);
      } catch (error) {
        console.error('Error fetching members:', error);
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!openMenuId) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-project-menu]')) return;
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

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(term));
  }, [projects, searchTerm]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      await api.post('/projects', {
        name: formData.name,
        userId: user.id,
      });
      setIsModalOpen(false);
      setFormData({ name: '' });
      fetchProjects();
    } catch (error) {
      if (isDemoMode()) {
        const now = new Date().toISOString();
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : String(Date.now());
        const created: Project = {
          id,
          name: formData.name.trim() || t('projects.new'),
          ownerId: user.id,
          createdAt: now,
        };
        setProjects((prev) => {
          const next = [created, ...prev];
          saveDemoProjects(next);
          return next;
        });
        setIsModalOpen(false);
        setFormData({ name: '' });
      } else {
        console.error('Error creating project:', error);
        alert(t('common.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProject = async (id: string) => {
    const confirmed = window.confirm(t('common.confirmDelete'));
    if (!confirmed) return;
    if (isDemoMode()) {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        saveDemoProjects(next);
        return next;
      });
      return;
    }
    try {
      const url = user
        ? `/projects/${encodeURIComponent(id)}?userId=${encodeURIComponent(user.id)}`
        : `/projects/${encodeURIComponent(id)}`;
      await api.delete(url);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(t('common.error'));
    }
  };

  return (
    <>
      <Header />

      <div className="space-y-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('projects.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('projects.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-green-600/20"
          >
            <Plus className="h-4 w-4" />
            {t('projects.new')}
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('projects.search')}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 text-sm">{t('common.loading')}</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('projects.noProjects')}</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">{t('projects.createFirst')}</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('projects.new')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 bg-green-50 text-green-700 border-green-200">
                    <FolderKanban className="h-3 w-3" />
                    {t('sidebar.projects')}
                  </div>

                  <div className="relative" data-project-menu>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId((prev) => (prev === project.id ? null : project.id))
                      }
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === project.id}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuId === project.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-10">
                        {user?.id === project.ownerId && (
                          <button
                            type="button"
                            onClick={async () => {
                              setOpenMenuId(null);
                              setMembersProject(project);
                              setIsMembersModalOpen(true);
                              await fetchMembers(project);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Users className="h-4 w-4" />
                            {t('projects.team.button')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            setOpenMenuId(null);
                            await deleteProject(project.id);
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
                  {project.name}
                </h3>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(project.createdAt).toLocaleDateString(
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
              <h2 className="text-xl font-bold text-gray-900">{t('projects.new')}</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCreateProject} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('projects.form.name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                    placeholder="Ex: Lançamento Black Friday"
                  />
                </div>

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

      {isMembersModalOpen && membersProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                {t('projects.team.title')}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsMembersModalOpen(false);
                  setMembersProject(null);
                  setMembers([]);
                  setMemberEmail('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4">
                <div className="text-sm font-semibold text-gray-900">
                  {membersProject.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t('projects.team.subtitle')}
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user) return;
                  const email = memberEmail.trim();
                  if (!email) return;
                  setMembersSubmitting(true);
                  try {
                    await api.post(`/projects/${encodeURIComponent(membersProject.id)}/members`, {
                      userId: user.id,
                      email,
                    });
                    setMemberEmail('');
                    await fetchMembers(membersProject);
                  } catch (error) {
                    console.error('Error adding member:', error);
                    alert(t('common.error'));
                  } finally {
                    setMembersSubmitting(false);
                  }
                }}
                className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
              >
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('projects.team.email')}
                  </label>
                  <input
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder={t('projects.team.emailPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors',
                    membersSubmitting && 'opacity-70 cursor-not-allowed',
                  )}
                  disabled={membersSubmitting}
                >
                  {membersSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {t('projects.team.add')}
                </button>
              </form>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-900">
                  {t('projects.team.members')}
                </div>

                {membersLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-500 text-sm gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : members.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    {t('projects.team.noMembers')}
                  </div>
                ) : (
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    {members.map((m) => {
                      const isOwner = m.userId === membersProject.ownerId;
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {m.name ? m.name : m.email}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{m.email}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'px-2.5 py-1 rounded-full text-xs font-semibold border',
                                isOwner
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200',
                              )}
                            >
                              {isOwner ? t('projects.team.owner') : t('projects.team.member')}
                            </div>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!user) return;
                                  const confirmed = window.confirm(t('common.confirmDelete'));
                                  if (!confirmed) return;
                                  try {
                                    await api.delete(
                                      `/projects/${encodeURIComponent(membersProject.id)}/members/${encodeURIComponent(m.id)}?userId=${encodeURIComponent(user.id)}`,
                                    );
                                    await fetchMembers(membersProject);
                                  } catch (error) {
                                    console.error('Error removing member:', error);
                                    alert(t('common.error'));
                                  }
                                }}
                                className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                                aria-label={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
