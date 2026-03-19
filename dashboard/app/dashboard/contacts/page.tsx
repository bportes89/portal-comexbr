'use client';

import { useEffect, useState } from 'react';
import { 
  Plus, 
  Upload, 
  Search, 
  Filter, 
  MoreVertical, 
  FileDown, 
  Trash2, 
  Edit,
  Phone,
  Calendar,
  Tag,
  X,
  Loader2
} from 'lucide-react';
import { Header } from '../../../components/Header';
import api from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { motion } from 'framer-motion';

interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  createdAt: string;
  email?: string;
  status?: 'active' | 'inactive';
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

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form Data
  const [newContact, setNewContact] = useState({ name: '', phone: '', tags: '' });
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await api.get('/contacts');
      setContacts(response.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      // Fallback data for demo if API fails
      if (contacts.length === 0) {
        setContacts([
          { id: '1', name: 'João Silva', phone: '+55 11 99999-9999', tags: ['vip', 'cliente'], createdAt: new Date().toISOString(), status: 'active' },
          { id: '2', name: 'Maria Souza', phone: '+55 11 88888-8888', tags: ['lead'], createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'inactive' },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await api.post('/contacts', {
        name: newContact.name,
        phone: newContact.phone,
        tags: newContact.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        userId: user.id,
      });
      setIsAddModalOpen(false);
      setNewContact({ name: '', phone: '', tags: '' });
      fetchContacts();
    } catch (error) {
      console.error('Error creating contact:', error);
      alert('Failed to create contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !csvFile) return;

    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        // Simple CSV parser assuming headers: name,phone,tags
        // Skip header row if present (simple check)
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
        
        const contactsToImport = lines.slice(startIndex)
          .filter(line => line.trim())
          .map(line => {
            const [name, phone, tags] = line.split(',').map(s => s.trim());
            return {
              name,
              phone,
              tags: tags ? tags.split(';').map(t => t.trim()) : [],
              userId: user.id
            };
          })
          .filter(c => c.name && c.phone);

        if (contactsToImport.length > 0) {
          await api.post('/contacts/bulk', contactsToImport);
          setIsImportModalOpen(false);
          setCsvFile(null);
          fetchContacts();
        } else {
          alert('No valid contacts found in CSV');
        }
      } catch (error) {
        console.error('Error importing contacts:', error);
        alert('Failed to import contacts');
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsText(csvFile);
  };

  const handleBulkDelete = async () => {
    if (!confirm(t('common.confirmDelete') || 'Are you sure you want to delete selected contacts?')) return;
    
    setIsLoading(true);
    try {
      await api.delete('/contacts/bulk', { data: { ids: selectedContacts } });
      setContacts(prev => prev.filter(c => !selectedContacts.includes(c.id)));
      setSelectedContacts([]);
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = (visibleContacts: Contact[]) => {
    const visibleIds = visibleContacts.map((c) => c.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedContacts.includes(id));

    if (allSelected) {
      setSelectedContacts((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedContacts((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const toggleSelect = (id: string) => {
    if (selectedContacts.includes(id)) {
      setSelectedContacts(selectedContacts.filter((c) => c !== id));
    } else {
      setSelectedContacts([...selectedContacts, id]);
    }
  };

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm) ||
    contact.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <Header />
      
      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('contacts.add')}</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.table.name')}</label>
                <input
                  type="text"
                  required
                  value={newContact.name}
                  onChange={e => setNewContact({...newContact, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
                <input
                  type="text"
                  required
                  placeholder="+55..."
                  value={newContact.phone}
                  onChange={e => setNewContact({...newContact, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.table.tags')} (comma separated)</label>
                <input
                  type="text"
                  value={newContact.tags}
                  onChange={e => setNewContact({...newContact, tags: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? t('common.processing') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('contacts.import')}</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleImportCSV} className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => setCsvFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">
                  {csvFile ? csvFile.name : 'Click to upload CSV'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Format: Name, Phone, Tags</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!csvFile || isSubmitting}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? t('common.processing') : t('contacts.import')}
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
            <h1 className="text-2xl font-bold text-white">{t('contacts.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('contacts.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors shadow-sm backdrop-blur-sm"
            >
              <Upload className="h-4 w-4" />
              {t('contacts.import')}
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/40 hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              {t('contacts.add')}
            </button>
          </div>
        </motion.div>

        {/* Filters & Actions Bar */}
        <motion.div variants={item} className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/5 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('contacts.search')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
              <Filter className="h-4 w-4" />
              {t('common.filter')}
            </button>
            <button className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
              <FileDown className="h-4 w-4" />
              {t('common.export')}
            </button>
            
            {selectedContacts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-right-4 duration-200 border border-green-500/20">
                <span className="bg-green-500/20 px-1.5 rounded text-xs">{selectedContacts.length}</span>
                {t('common.selected')}
                <div className="h-4 w-px bg-green-500/20 mx-1" />
                <button onClick={handleBulkDelete} className="p-1 hover:bg-green-500/20 rounded text-green-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Contacts Table */}
        <motion.div variants={item} className="bg-slate-900/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-slate-400 text-sm">{t('common.loading')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.02] border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 w-12">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500/50 focus:ring-offset-0"
                        checked={filteredContacts.length > 0 && filteredContacts.every((c) => selectedContacts.includes(c.id))}
                        onChange={() => toggleSelectAll(filteredContacts)}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('contacts.table.name')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('common.phone')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('contacts.table.status')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('contacts.table.tags')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('contacts.table.date')}</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('contacts.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredContacts.length === 0 ? (
                     <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/10">
                            <Search className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="font-medium text-slate-300">{t('contacts.table.noContacts')}</p>
                          <p className="text-sm mt-1">{t('contacts.subtitle')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => (
                      <tr key={contact.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500/50 focus:ring-offset-0"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-green-400 font-bold text-sm border border-green-500/20 shadow-lg shadow-green-900/20">
                              {contact.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{contact.name}</p>
                              <p className="text-xs text-slate-500">{contact.email || t('contacts.table.noEmail')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            {contact.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm",
                            contact.status === 'active' 
                              ? "bg-green-500/10 text-green-400 border-green-500/20" 
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          )}>
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full shadow-[0_0_5px_currentColor]",
                              contact.status === 'active' ? "bg-green-500" : "bg-slate-400"
                            )} />
                            {contact.status === 'active' ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {contact.tags.map(tag => (
                              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs font-medium border border-blue-500/20">
                                <Tag className="h-3 w-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            {new Date(contact.createdAt).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
            <p className="text-sm text-slate-500">
              {t('common.showing')} <span className="font-medium text-slate-300">1</span> {t('common.to')} <span className="font-medium text-slate-300">{filteredContacts.length}</span> {t('common.of')} <span className="font-medium text-slate-300">{filteredContacts.length}</span> {t('common.results')}
            </p>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-white/10 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-all" disabled>{t('common.previous')}</button>
              <button className="px-3 py-1 border border-white/10 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-all" disabled>{t('common.next')}</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
