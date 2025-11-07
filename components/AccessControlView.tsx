import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { TrashIcon } from './icons';
import Modal from './Modal';

interface AllowedEmployee {
  employee_id: string;
  full_name: string;
  created_at: string;
}

const AccessControlView: React.FC = () => {
  const [allowedEmployees, setAllowedEmployees] = useState<AllowedEmployee[]>([]);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [removeConfirm, setRemoveConfirm] = useState<AllowedEmployee | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchAllowedEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('allowed_employees')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setAllowedEmployees(data || []);
    } catch (err: any) {
      setError('Falha ao carregar a lista de funcionários autorizados.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllowedEmployees();
  }, [fetchAllowedEmployees]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    if (allowedEmployees.some(emp => emp.employee_id === newEmployeeId)) {
        setError('Este Nº do Crachá já está na lista de permissões.');
        setIsSubmitting(false);
        return;
    }

    try {
      const { data, error } = await supabase
        .from('allowed_employees')
        .insert([{ employee_id: newEmployeeId, full_name: newFullName }])
        .select();

      if (error) throw error;

      if (data) {
        setAllowedEmployees(prev => [...prev, data[0]].sort((a,b) => a.full_name.localeCompare(b.full_name)));
        setMessage(`${newFullName} foi adicionado à lista de permissões.`);
        setNewEmployeeId('');
        setNewFullName('');
      }
    } catch (err: any) {
      setError('Falha ao adicionar funcionário. Verifique se o Nº do Crachá já existe.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveEmployee = async () => {
    if (!removeConfirm) return;
    setIsRemoving(true);
    setError(null);
    setMessage(null);

    try {
        const { error } = await supabase
            .from('allowed_employees')
            .delete()
            .eq('employee_id', removeConfirm.employee_id);

        if (error) throw error;
        
        setAllowedEmployees(prev => prev.filter(emp => emp.employee_id !== removeConfirm.employee_id));
        setMessage(`${removeConfirm.full_name} foi removido da lista de permissões.`);
        setRemoveConfirm(null);

    } catch (err: any) {
        setError(`Falha ao remover ${removeConfirm.full_name}.`);
        console.error(err);
    } finally {
        setIsRemoving(false);
    }
  };
  
  if (loading) {
     return (
        <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary mx-auto"></div>
        </div>
    );
  }

  return (
    <>
    <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
             <form onSubmit={handleAddEmployee} className="bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4 text-gray-200">Adicionar Funcionário</h3>
                <p className="text-sm text-gray-400 mb-4">Adicione funcionários à lista de permissões. Somente eles poderão criar uma conta no sistema.</p>
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={newFullName}
                        onChange={e => setNewFullName(e.target.value)}
                        placeholder="Nome completo"
                        required
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    />
                    <input
                        type="text"
                        value={newEmployeeId}
                        onChange={e => setNewEmployeeId(e.target.value)}
                        placeholder="Nº do Crachá / Matrícula"
                        required
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    />
                    <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-600" disabled={isSubmitting}>
                        {isSubmitting ? 'Adicionando...' : 'Adicionar à Lista'}
                    </button>
                    {error && <p className="text-center text-red-400 text-sm">{error}</p>}
                    {message && <p className="text-center text-green-400 text-sm">{message}</p>}
                </div>
            </form>
        </div>
        <div className="md:col-span-2">
            <div className="bg-gray-800 rounded-lg shadow p-6">
                 <h3 className="text-xl font-bold mb-4 text-gray-200">Funcionários Autorizados</h3>
                 <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nº do Crachá</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ação</th>
                            </tr>
                        </thead>
                         <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {allowedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-8 text-gray-400">Nenhum funcionário na lista de permissões.</td>
                                </tr>
                            ) : (
                                allowedEmployees.map(person => (
                                    <tr key={person.employee_id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{person.full_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{person.employee_id}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <button 
                                                onClick={() => setRemoveConfirm(person)}
                                                className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-gray-600"
                                                aria-label={`Remover ${person.full_name}`}
                                            >
                                                <TrashIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    </div>
    <Modal 
        isOpen={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        title="Confirmar Remoção da Permissão"
      >
        <div className="mt-4">
            <p className="text-sm text-gray-400">
                Tem certeza que deseja remover <strong>{removeConfirm?.full_name}</strong> da lista de permissões?
            </p>
            <p className="text-sm text-yellow-400 mt-2 font-semibold">
                Isso impedirá que essa pessoa se cadastre no futuro. Esta ação não afeta contas já existentes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setRemoveConfirm(null)} type="button" className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 border border-gray-500 rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                    Cancelar
                </button>
                <button onClick={handleRemoveEmployee} type="button" className="px-4 py-2 text-sm font-medium text-white bg-status-absent border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500" disabled={isRemoving}>
                    {isRemoving ? 'Removendo...' : 'Sim, Remover'}
                </button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default AccessControlView;
