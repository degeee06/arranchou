import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface SettingsViewProps {
  initialCompanyName: string;
  setCompanyName: React.Dispatch<React.SetStateAction<string>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ initialCompanyName, setCompanyName }) => {
  const [name, setName] = useState(initialCompanyName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(initialCompanyName);
  }, [initialCompanyName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: dbError } = await supabase
        .from('company_settings')
        .update({ setting_value: name })
        .eq('setting_key', 'company_name');

      if (dbError) {
        throw dbError;
      }
      
      // Update the name in the parent component state
      setCompanyName(name);
      setSuccess('Nome da empresa atualizado com sucesso!');

    } catch (err: any) {
      console.error('Error saving company name:', err);
      setError(`Falha ao salvar. Detalhes: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 3000); // Clear success message after 3 seconds
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-200 mb-4">Configurações da Empresa</h2>
      
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-2">
            Nome da Aplicação
          </label>
          <input
            type="text"
            id="companyName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
            placeholder="Nome da sua empresa"
            required
          />
          <p className="mt-2 text-xs text-gray-400">
            Este nome será exibido no cabeçalho da aplicação para todos os usuários.
          </p>
        </div>

        {error && <p className="text-center text-red-400 text-sm bg-red-900/50 p-3 rounded-md">{error}</p>}
        {success && <p className="text-center text-green-400 text-sm bg-green-900/50 p-3 rounded-md">{success}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || name === initialCompanyName}
            className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2"></span>
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
