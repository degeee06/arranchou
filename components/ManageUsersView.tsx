
import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../supabase';
import Modal from './Modal';
import { DotsVerticalIcon, UserPlusIcon, SearchIcon } from './icons';
import PaginationControls from './PaginationControls';

interface ManageUsersViewProps {
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  currentUserProfile: Profile;
}

const ROLES_MAP: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  employee: 'Funcionário',
};

const ITEMS_PER_PAGE = 50;

const ManageUsersView: React.FC<ManageUsersViewProps> = ({ profiles, setProfiles, currentUserProfile }) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Profile | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as HTMLElement).closest('.actions-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile.company_id) {
        setError("Erro: Sua conta não tem uma empresa vinculada.");
        return;
    }
    
    setIsCreatingUser(true);
    setError(null);

    try {
        const { data, error: funcError } = await supabase.functions.invoke('create-user', {
            body: {
                full_name: newFullName,
                employee_id: newEmployeeId,
                password: newPassword,
            },
        });

        if (funcError) throw funcError;
        if (data?.error) throw new Error(data.error);
        
        setIsCreateModalOpen(false);
        setNewFullName('');
        setNewEmployeeId('');
        setNewPassword('');
        
        setError("Sucesso! Usuário criado. Clique em Sair e entre novamente para atualizar a lista.");
        setTimeout(() => setError(null), 8000);
        
    } catch (err: any) {
        console.error('Erro na criação:', err);
        setError(err.message || 'Falha ao conectar com o servidor de criação.');
    } finally {
        setIsCreatingUser(false);
    }
  };

  const sortedProfiles = [...profiles]
    .filter(person => {
        const query = searchQuery.toLowerCase();
        return person.full_name.toLowerCase().includes(query) || (person.employee_id && person.employee_id.toLowerCase().includes(query));
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const paginatedProfiles = sortedProfiles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(sortedProfiles.length / ITEMS_PER_PAGE);

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-700">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-200">Gerenciar Equipe</h2>
            <div className="flex items-center gap-2">
                {isSearchVisible && (
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-40 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm text-white"
                        autoFocus
                    />
                )}
                <button onClick={() => setIsSearchVisible(!isSearchVisible)} className="p-2 text-gray-400 hover:bg-gray-700 rounded-full"><SearchIcon /></button>
                <button
                    onClick={() => { setIsCreateModalOpen(true); setError(null); }}
                    className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 shadow-lg"
                >
                    <UserPlusIcon /> <span className="hidden sm:inline uppercase text-xs tracking-widest">Novo Usuário</span>
                </button>
            </div>
        </div>

        {error && (
            <div className={`mb-4 text-center p-4 rounded-xl text-sm font-bold ${error.includes('Sucesso') ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                {error}
            </div>
        )}

        {paginatedProfiles.length <= 1 ? (
            <div className="text-center py-16 bg-gray-900/40 rounded-xl border border-dashed border-gray-700">
                <p className="text-gray-400">Nenhum funcionário encontrado.</p>
                <p className="text-[10px] text-brand-accent mt-4 px-6 uppercase tracking-widest opacity-70">
                   Se você já criou usuários, eles podem estar ocultos por permissões do banco. <br/>
                   Experimente fazer Logout e Login.
                </p>
            </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/30">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-widest">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-widest">Cargo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-gray-700">
                  {paginatedProfiles.map(person => (
                    <tr key={person.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{person.full_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-tighter ${person.role === 'admin' ? 'bg-brand-primary text-white' : 'bg-gray-700 text-gray-400'}`}>
                            {ROLES_MAP[person.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <button onClick={() => setOpenMenuId(person.id)} className="text-gray-400 hover:text-white"><DotsVerticalIcon /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Usuário">
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4 mt-4">
            <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Nome Completo</label>
                <input className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-brand-primary outline-none transition-all" type="text" placeholder="Ex: João da Silva" value={newFullName} onChange={e => setNewFullName(e.target.value)} required />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Nº Matrícula</label>
                <input className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-brand-primary outline-none transition-all" type="text" placeholder="Ex: 102030" value={newEmployeeId} onChange={e => setNewEmployeeId(e.target.value)} required />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Senha de Acesso</label>
                <input className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-brand-primary outline-none transition-all" type="password" placeholder="Mínimo 6 dígitos" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-4 rounded-xl shadow-xl mt-2 disabled:opacity-50 transition-all active:scale-95" disabled={isCreatingUser}>
                {isCreatingUser ? 'Processando Cadastro...' : 'Salvar Funcionário'}
            </button>
        </form>
      </Modal>
    </>
  );
};

export default ManageUsersView;
