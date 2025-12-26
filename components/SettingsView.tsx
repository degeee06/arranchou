
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Profile } from '../types';

interface SettingsViewProps {
  initialCompanyName: string;
  setCompanyName: React.Dispatch<React.SetStateAction<string>>;
  profile: Profile;
}

const SettingsView: React.FC<SettingsViewProps> = ({ initialCompanyName, setCompanyName, profile }) => {
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
        .upsert({ 
          company_id: profile.company_id, // Garante que salva na empresa certa
          setting_key: 'company_name',
          setting_value: name 
        }, { onConflict: 'company_id,setting_key' });

      if (dbError) throw dbError;
      
      setCompanyName(name);
      setSuccess('Configurações atualizadas!');

    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 max-w-2xl mx-auto border border-gray-700">
      <h2 className="text-xl font-bold text-gray-200 mb-4">Configurações da Empresa ({profile.company_id})</h2>
      
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-2">
            Nome de Exibição da Empresa
          </label>
          <input
            type="text"
            id="companyName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
            placeholder="Ex: Construtora Alfa"
            required
          />
        </div>

        {error && <p className="text-center text-red-400 text-sm bg-red-900/50 p-3 rounded-md">{error}</p>}
        {success && <p className="text-center text-green-400 text-sm bg-green-900/50 p-3 rounded-md">{success}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || name === initialCompanyName}
            className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-600"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
