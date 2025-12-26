
import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../supabase';
import Modal from './Modal';
import { DotsVerticalIcon, UserPlusIcon, SearchIcon, TrashIcon, UsersIcon } from './icons';
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

  const handleUpdateRole = async (targetUser: Profile, newRole: 'admin' | 'employee') => {
    setLoading(prev => ({ ...prev, [targetUser.id]: true }));
    setOpenMenuId(null);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('update-user-role', {
        body: { user_id: targetUser.id, new_role: newRole },
      });
      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      setProfiles(prev => prev.map(p => p.id === targetUser.id ? { ...p, role: newRole } : p));
      setError(`Cargo de ${targetUser.full_name} atualizado com sucesso.`);
      setTimeout(() => setError(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar cargo.');
    } finally {
      setLoading(prev => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const handleDeleteUser = async () => {
    if (!removeConfirm) return;
    setLoading(prev => ({ ...prev, [removeConfirm.id]: true }));
    try {
      const { data, error: funcError } = await supabase.functions.invoke('delete-user', {
        body: { user_id: removeConfirm.id },
      });
      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      setProfiles(prev => prev.filter(p => p.id !== removeConfirm.id));
      setRemoveConfirm(null);
      setError(`Usuário ${removeConfirm.full_name} removido.`);
      setTimeout(() => setError(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao remover usuário.');
    } finally {
      setLoading(prev => ({ ...prev, [removeConfirm?.id || '']: false }));
    }
  };
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setError(null);
    try {
        const { data, error: funcError } = await supabase.functions.invoke('create-user', {
            body: { full_name: newFullName, employee_id: newEmployeeId, password: newPassword },
        });
        if (funcError) throw funcError;
        if (data?.error) throw new Error(data.error);
        
        setIsCreateModalOpen(false);
        setNewFullName('');
        setNewEmployeeId('');
        setNewPassword('');
        setError("Sucesso! Usuário criado. Saia e entre novamente para sincronizar.");
    } catch (err: any) {
        setError(err.message || 'Falha ao criar usuário.');
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
            <div className={`mb-4 text-center p-4 rounded-xl text-sm font-bold ${error.includes('Sucesso') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {error}
            </div>
        )}

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
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    <div className="flex flex-col">
                        <span>{person.full_name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{person.employee_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-tighter ${person.role === 'employee' ? 'bg-gray-700 text-gray-400' : 'bg-brand-primary text-white'}`}>
                        {ROLES_MAP[person.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    {person.id !== currentUserProfile.id && (
                        <div className="relative inline-block text-left actions-menu-container">
                            <button onClick={() => setOpenMenuId(openMenuId === person.id ? null : person.id)} className="text-gray-400 hover:text-white p-1" disabled={loading[person.id]}>
                                {loading[person.id] ? <div className="animate-spin h-4 w-4 border-2 border-brand-primary border-t-transparent rounded-full" /> : <DotsVerticalIcon />}
                            </button>
                            {openMenuId === person.id && (
                                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-20">
                                    <div className="py-1">
                                        {person.role === 'employee' ? (
                                            <button onClick={() => handleUpdateRole(person, 'admin')} className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-gray-600">
                                                <UsersIcon /> Tornar Admin
                                            </button>
                                        ) : (
                                            <button onClick={() => handleUpdateRole(person, 'employee')} className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-gray-600">
                                                <UsersIcon /> Tornar Funcionário
                                            </button>
                                        )}
                                        <button onClick={() => { setRemoveConfirm(person); setOpenMenuId(null); }} className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-gray-600">
                                            <TrashIcon /> Remover Usuário
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Usuário">
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4 mt-4">
            <input className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none" type="text" placeholder="Nome Completo" value={newFullName} onChange={e => setNewFullName(e.target.value)} required />
            <input className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none" type="text" placeholder="Matrícula" value={newEmployeeId} onChange={e => setNewEmployeeId(e.target.value)} required />
            <input className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white outline-none" type="password" placeholder="Senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
            <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-4 rounded-xl disabled:opacity-50" disabled={isCreatingUser}>
                {isCreatingUser ? 'Criando...' : 'Salvar Funcionário'}
            </button>
        </form>
      </Modal>

      <Modal isOpen={!!removeConfirm} onClose={() => setRemoveConfirm(null)} title="Confirmar Remoção">
        <div className="mt-4">
            <p className="text-sm text-gray-400">Tem certeza que deseja remover <strong>{removeConfirm?.full_name}</strong>? Esta ação é irreversível.</p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md">Cancelar</button>
                <button onClick={handleDeleteUser} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md">Sim, Remover</button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default ManageUsersView;
