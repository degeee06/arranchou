
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
        setError("Erro crítico: Seu perfil de administrador não está vinculado a uma empresa.");
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
        
        setError("Usuário criado com sucesso!");
        setTimeout(() => setError(null), 5000);
        
    } catch (err: any) {
        console.error('Error creating user:', err);
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
            <h2 className="text-xl font-bold text-gray-200">Gerenciar Equipe</h2>
            <div className="flex items-center gap-2">
                {isSearchVisible && (
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar..."
                        className="w-40 sm:w-48 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm transition-all duration-300"
                        autoFocus
                    />
                )}
                <button onClick={() => setIsSearchVisible(!isSearchVisible)} className="p-2 text-gray-400 hover:bg-gray-700 rounded-full"><SearchIcon /></button>
                <button
                    onClick={() => { setIsCreateModalOpen(true); setError(null); }}
                    className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300"
                >
                    <UserPlusIcon />
                    <span className="hidden sm:inline">Novo Usuário</span>
                </button>
            </div>
        </div>

        {error && (
            <div className={`mb-4 text-center p-3 rounded-md text-sm ${error.includes('sucesso') ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                {error}
            </div>
        )}

        {paginatedProfiles.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                <p className="text-gray-400">Nenhum usuário visível para a empresa <strong>{currentUserProfile.company_id}</strong>.</p>
                <p className="text-xs text-yellow-500 mt-2">Dica: Se você acabou de aplicar as regras de segurança, precisa <strong>sair da conta e entrar novamente</strong> para sincronizar sua visão.</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Matrícula</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Cargo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {paginatedProfiles.map(person => (
                    <tr key={person.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{person.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{person.employee_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${person.role === 'admin' ? 'bg-indigo-900 text-indigo-200' : 'bg-gray-700 text-gray-300'}`}>
                          {ROLES_MAP[person.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button onClick={() => setOpenMenuId(person.id)} className="text-gray-400 hover:text-white"><DotsVerticalIcon /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </>
  );
};

export default ManageUsersView;
