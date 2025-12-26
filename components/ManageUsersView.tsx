
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleRoleChange = async (person: Profile) => {
    const originalRole = person.role;
    const newRole = originalRole === 'admin' ? 'employee' : 'admin';
    
    setLoading(prev => ({ ...prev, [person.id]: true }));
    setError(null);

    setProfiles(prevProfiles =>
      prevProfiles.map(p => (p.id === person.id ? { ...p, role: newRole } : p))
    );

    const { error } = await supabase.functions.invoke('update-user-role', {
      body: { user_id: person.id, new_role: newRole },
    });

    if (error) {
      console.error('Error changing role:', error);
      setError(`Falha ao alterar o cargo: ${error.message}`);
      setProfiles(prevProfiles =>
        prevProfiles.map(p => (p.id === person.id ? { ...p, role: originalRole } : p))
      );
    }

    setLoading(prev => ({ ...prev, [person.id]: false }));
  };
  
const handleRemoveUser = async () => {
    if (!removeConfirm) return;
    const userToDelete = removeConfirm;
    setLoading(prev => ({ ...prev, [userToDelete.id]: true }));
    setError(null);

    try {
      const { error: functionError } = await supabase.functions.invoke('delete-user', {
          body: { user_id: userToDelete.id },
      });
      if (functionError) throw functionError;
      setProfiles(prevProfiles => prevProfiles.filter(p => p.id !== userToDelete.id));
      setRemoveConfirm(null);
    } catch (err: any) {
        console.error('Error during user removal process:', err);
        setError(err.message || 'Ocorreu um erro desconhecido durante a remoção.');
    } finally {
        setLoading(prev => ({ ...prev, [userToDelete.id]: false }));
    }
};

const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile.company_id) {
        setError("Erro crítico: Seu perfil de administrador não está vinculado a uma empresa. Não é possível criar novos usuários.");
        return;
    }
    
    setIsCreatingUser(true);
    setError(null);

    try {
        const { error } = await supabase.functions.invoke('create-user', {
            body: {
                full_name: newFullName,
                employee_id: newEmployeeId,
                password: newPassword,
            },
        });

        if (error) throw error;
        
        setIsCreateModalOpen(false);
        setNewFullName('');
        setNewEmployeeId('');
        setNewPassword('');
    } catch (err: any) {
        console.error('Error creating user:', err);
        setError(err.message || 'Falha ao criar usuário. O Nº do Crachá pode já existir.');
    } finally {
        setIsCreatingUser(false);
    }
};

  const sortedProfiles = [...profiles]
    .filter(person => {
        const query = searchQuery.toLowerCase();
        return person.full_name.toLowerCase().includes(query) || (person.employee_id && person.employee_id.toLowerCase().includes(query));
    })
    .sort((a, b) => {
        const roleOrder = { super_admin: 0, admin: 1, employee: 2 };
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return roleOrder[a.role] - roleOrder[b.role];
        }
        return a.full_name.localeCompare(b.full_name);
  });

  const totalPages = Math.ceil(sortedProfiles.length / ITEMS_PER_PAGE);
  const paginatedProfiles = sortedProfiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-200">Gerenciar Usuários</h2>
            <div className="flex items-center gap-2">
                {isSearchVisible && (
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-40 sm:w-48 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm transition-all duration-300"
                        autoFocus
                        onBlur={() => { if(!searchQuery) setIsSearchVisible(false); }}
                    />
                )}
                <button
                    onClick={() => setIsSearchVisible(prev => !prev)}
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-primary"
                    aria-label="Pesquisar usuário"
                >
                    <SearchIcon />
                </button>
                <button
                    onClick={() => { setIsCreateModalOpen(true); setError(null); }}
                    className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    <UserPlusIcon />
                    <span className="hidden sm:inline">Novo Usuário</span>
                </button>
            </div>
        </div>

        {error && <p className="mb-4 text-center text-red-400 text-sm bg-red-900/50 p-3 rounded-md">{error}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nº do Crachá</th>
                <th scope="col" className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cargo</th>
                <th scope="col" className="px-2 sm:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {paginatedProfiles.map(person => {
                const isLoading = loading[person.id];
                const isCurrentUser = person.id === currentUserProfile.id;

                let canManageRole = false;
                let canDelete = false;
                if (currentUserProfile.role === 'super_admin' && !isCurrentUser) {
                    canManageRole = person.role !== 'super_admin';
                    canDelete = true;
                } else if (currentUserProfile.role === 'admin' && person.role === 'employee') {
                    canManageRole = true;
                    canDelete = true;
                }
                
                return (
                  <tr key={person.id} className="hover:bg-gray-700">
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        <span className={!person.company_id ? "text-yellow-400" : ""}>{person.full_name}</span>
                        {!person.company_id && <span className="ml-2 text-[10px] bg-yellow-900/50 text-yellow-500 px-1 rounded">ÓRFÃO</span>}
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-300">{person.employee_id}</td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        person.role === 'super_admin' ? 'bg-red-200 text-red-800' :
                        person.role === 'admin' ? 'bg-indigo-200 text-indigo-800' : 
                        'bg-gray-600 text-gray-200'
                      }`}>
                        {ROLES_MAP[person.role]}
                      </span>
                    </td>
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block text-left actions-menu-container">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === person.id ? null : person.id)}
                          disabled={isLoading}
                          className="p-2 rounded-full text-gray-400 hover:bg-gray-600 disabled:opacity-50 focus:outline-none"
                        >
                          {isLoading ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent block"></span> : <DotsVerticalIcon />}
                        </button>
                        {openMenuId === person.id && (
                          <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1">
                              <button
                                onClick={() => { handleRoleChange(person); setOpenMenuId(null); }}
                                disabled={!canManageRole}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50"
                              >
                                {person.role === 'admin' ? 'Rebaixar para Funcionário' : 'Promover para Admin'}
                              </button>
                              <button
                                onClick={() => { setRemoveConfirm(person); setOpenMenuId(null); }}
                                disabled={!canDelete}
                                className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-gray-600 disabled:opacity-50"
                              >
                                Remover Usuário
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Criar Novo Usuário">
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4 mt-4">
             <div className="mb-2">
                <label className="block text-gray-300 text-sm font-bold mb-2">Nome Completo</label>
                <input
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    required
                />
            </div>
            <div className="mb-2">
                <label className="block text-gray-300 text-sm font-bold mb-2">Nº do Crachá / Matrícula</label>
                <input
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    type="text"
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    required
                />
            </div>
            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2">Senha Provisória</label>
                <input
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                />
            </div>
            {error && <p className="text-center text-red-400 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-600" disabled={isCreatingUser}>
                {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
            </button>
        </form>
      </Modal>

      <Modal isOpen={!!removeConfirm} onClose={() => setRemoveConfirm(null)} title="Confirmar Remoção">
        <div className="mt-4">
            <p className="text-sm text-gray-400">Tem certeza que deseja remover permanentemente <strong>{removeConfirm?.full_name}</strong>?</p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} className="px-4 py-2 text-sm text-gray-200 bg-gray-600 rounded-md">Cancelar</button>
                <button onClick={handleRemoveUser} className="px-4 py-2 text-sm text-white bg-status-absent rounded-md shadow-sm hover:bg-red-700">Sim, Remover</button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default ManageUsersView;
