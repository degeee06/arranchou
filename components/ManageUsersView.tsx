import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { supabase } from '../supabase';
import Modal from './Modal';
import { DotsVerticalIcon } from './icons';

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

const ManageUsersView: React.FC<ManageUsersViewProps> = ({ profiles, setProfiles, currentUserProfile }) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Profile | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

    const userToDelete = removeConfirm; // Capture the user object to use in `finally`

    setLoading(prev => ({ ...prev, [userToDelete.id]: true }));
    setError(null);

    try {
      // Directly invoke the function to delete the auth user.
      // This is expected to trigger a cascade delete on the 'profiles' table and other related data,
      // ensuring a complete and permanent removal of the user from the system.
      const { error: functionError } = await supabase.functions.invoke('delete-user', {
          body: { user_id: userToDelete.id },
      });

      if (functionError) {
          // If the function fails, inform the admin. The user is not deleted.
          throw new Error(`A remoção falhou. A conta de autenticação do usuário não pôde ser removida. Detalhes: ${functionError.message}`);
      }

      // On success, the realtime subscription in App.tsx will eventually remove the user
      // from the UI state. We also update it here for immediate feedback.
      setProfiles(prevProfiles => prevProfiles.filter(p => p.id !== userToDelete.id));
      setRemoveConfirm(null);

    } catch (err: any) {
        console.error('Error during user removal process:', err);
        setError(err.message || 'Ocorreu um erro desconhecido durante a remoção.');
    } finally {
        setLoading(prev => ({ ...prev, [userToDelete.id]: false }));
    }
};

  
  const sortedProfiles = [...profiles].sort((a, b) => {
    const roleOrder = { super_admin: 0, admin: 1, employee: 2 };
    if (roleOrder[a.role] !== roleOrder[b.role]) {
      return roleOrder[a.role] - roleOrder[b.role];
    }
    return a.full_name.localeCompare(b.full_name);
  });

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Gerenciar Usuários</h2>
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
              {sortedProfiles.map(person => {
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
                    <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{person.full_name}</td>
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
                          className="p-2 rounded-full text-gray-400 hover:bg-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-brand-primary"
                          id={`menu-button-${person.id}`}
                          aria-haspopup="true"
                          aria-expanded={openMenuId === person.id}
                        >
                          <span className="sr-only">Opções para {person.full_name}</span>
                          {isLoading ? (
                            <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent block"></span>
                          ) : (
                            <DotsVerticalIcon />
                          )}
                        </button>

                        {openMenuId === person.id && (
                          <div
                            className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10 focus:outline-none"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby={`menu-button-${person.id}`}
                          >
                            <div className="py-1" role="none">
                              <button
                                onClick={() => { handleRoleChange(person); setOpenMenuId(null); }}
                                disabled={!canManageRole}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                role="menuitem"
                                title={!canManageRole ? 'Você não tem permissão para alterar este cargo.' : (person.role === 'admin' ? 'Rebaixar para Funcionário' : 'Promover para Admin')}
                              >
                                {person.role === 'admin' ? 'Rebaixar para Funcionário' : 'Promover para Admin'}
                              </button>
                              <button
                                onClick={() => { setRemoveConfirm(person); setOpenMenuId(null); }}
                                disabled={!canDelete}
                                className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                role="menuitem"
                                title={!canDelete ? 'Você não tem permissão para remover este usuário.' : 'Remover usuário permanentemente'}
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
      </div>

      <Modal 
        isOpen={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        title="Confirmar Remoção"
      >
        <div className="mt-4">
            <p className="text-sm text-gray-400">
                Tem certeza que deseja remover permanentemente <strong>{removeConfirm?.full_name}</strong>?
            </p>
            <p className="text-sm text-red-400 mt-2 font-semibold">
                Esta ação é irreversível. A conta do usuário (login e senha) e todos os seus dados de presença serão apagados permanentemente. Para acessar o sistema novamente, o usuário precisará criar uma nova conta.
            </p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} type="button" className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 border border-gray-500 rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                    Cancelar
                </button>
                <button onClick={handleRemoveUser} type="button" className="px-4 py-2 text-sm font-medium text-white bg-status-absent border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500" disabled={loading[removeConfirm?.id || '']}>
                    {loading[removeConfirm?.id || ''] ? 'Removendo...' : 'Sim, Remover'}
                </button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default ManageUsersView;