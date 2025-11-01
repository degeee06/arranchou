import React, { useState } from 'react';
import { Profile } from '../types';
import { supabase } from '../supabase';
import Modal from './Modal';
import { TrashIcon } from './icons';

interface ManageUsersViewProps {
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  currentUserId: string;
}

const ManageUsersView: React.FC<ManageUsersViewProps> = ({ profiles, setProfiles, currentUserId }) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Profile | null>(null);

  const handleRoleChange = async (person: Profile) => {
    const newRole = person.role === 'admin' ? 'employee' : 'admin';
    setLoading(prev => ({ ...prev, [person.id]: true }));
    setError(null);
    
    // Call the Supabase Edge Function to securely update the user's role
    const { error } = await supabase.functions.invoke('update-user-role', {
        body: { user_id: person.id, new_role: newRole },
    });

    if (error) {
      console.error('Error changing role:', error);
      setError('Falha ao alterar o cargo. Verifique se a Função Edge "update-user-role" está configurada.');
    } else {
      // The realtime listener in App.tsx will handle the state update
    }
    setLoading(prev => ({ ...prev, [person.id]: false }));
  };
  
  const handleRemoveUser = async () => {
    if (!removeConfirm) return;
    
    setLoading(prev => ({ ...prev, [removeConfirm.id]: true }));
    setError(null);

    // Call the Supabase Edge Function to securely delete the user
    const { error: functionError } = await supabase.functions.invoke('delete-user', {
        body: { user_id: removeConfirm.id },
    });

    if (functionError) {
        console.error('Error deleting user:', functionError);
        setError('Falha ao remover o usuário. Verifique se a Função Edge "delete-user" está configurada corretamente no Supabase.');
    } else {
        // Update state to remove user from the list
        setProfiles(prevProfiles => prevProfiles.filter(p => p.id !== removeConfirm.id));
        setRemoveConfirm(null); // Close modal on success
    }
    setLoading(prev => ({ ...prev, [removeConfirm.id]: false }));
  };
  
  const sortedProfiles = [...profiles].sort((a,b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Gerenciar Usuários</h2>
        {error && <p className="mb-4 text-center text-red-400 text-sm bg-red-900/50 p-3 rounded-md">{error}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nº do Crachá</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cargo</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedProfiles.map(person => {
                const isLoading = loading[person.id];
                const isCurrentUser = person.id === currentUserId;
                
                return (
                  <tr key={person.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{person.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{person.employee_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${person.role === 'admin' ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-600 text-gray-200'}`}>
                        {person.role === 'admin' ? 'Admin' : 'Funcionário'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end items-center gap-2">
                      <button 
                        onClick={() => handleRoleChange(person)}
                        disabled={isLoading || isCurrentUser}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${isCurrentUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'} ${person.role === 'admin' ? 'text-yellow-400' : 'text-indigo-400'}`}
                        aria-label={person.role === 'admin' ? `Rebaixar ${person.full_name}` : `Promover ${person.full_name}`}
                      >
                        {isLoading ? '...' : (person.role === 'admin' ? 'Rebaixar' : 'Promover')}
                      </button>
                      <button
                        onClick={() => setRemoveConfirm(person)}
                        disabled={isLoading || isCurrentUser}
                        className={`p-2 rounded-full transition-colors ${isCurrentUser ? 'opacity-50 cursor-not-allowed' : 'text-red-400 hover:text-red-300 hover:bg-gray-600'}`}
                        aria-label={`Remover ${person.full_name}`}
                      >
                        <TrashIcon />
                      </button>
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
                Esta ação é irreversível. O usuário e todos os seus dados de presença serão apagados do sistema.
            </p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} type="button" className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 border border-gray-500 rounded-md shadow-sm hover:bg-gray-700">
                    Cancelar
                </button>
                <button onClick={handleRemoveUser} type="button" className="px-4 py-2 text-sm font-medium text-white bg-status-absent border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-500" disabled={loading[removeConfirm?.id || '']}>
                    {loading[removeConfirm?.id || ''] ? 'Removendo...' : 'Remover'}
                </button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default ManageUsersView;