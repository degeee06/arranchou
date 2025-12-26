
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
      if (!profile.company_id) throw new Error("ID da empresa não localizado no seu perfil.");

      const { error: dbError } = await supabase
        .from('company_settings')
        .upsert({ 
          company_id: profile.company_id,
          setting_key: 'company_name',
          setting_value: name.trim() 
        }, { onConflict: 'company_id,setting_key' });

      if (dbError) throw dbError;
      
      setCompanyName(name.trim());
      setSuccess('Configurações atualizadas com sucesso!');
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 sm:p-6 max-w-2xl mx-auto border border-gray-700">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-200">Ajustes da Unidade</h2>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-mono">Código: {profile.company_id}</p>
      </div>
      
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="companyName" className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
            Nome de Exibição (Cabeçalho)
          </label>
          <input
            type="text"
            id="companyName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-brand-primary outline-none transition-all"
            placeholder="Ex: Unidade Centro"
            required
          />
        </div>

        {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm font-medium">
                {error}
            </div>
        )}
        
        {success && (
            <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-400 text-sm font-medium animate-pulse">
                {success}
            </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || name.trim() === initialCompanyName.trim()}
            className="w-full sm:w-auto bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-8 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? 'Processando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsView;
