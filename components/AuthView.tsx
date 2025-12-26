
import React, { useState } from 'react';
import { supabase } from '../supabase';

interface AuthViewProps {
  companyName: string;
}

const AuthView: React.FC<AuthViewProps> = ({ companyName }) => {
    const [companyCode, setCompanyCode] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Higieniza o código da empresa (remove espaços e coloca em minúsculo)
        const formattedCompany = companyCode.trim().toLowerCase().replace(/\s+/g, '');
        // O e-mail agora é dinâmico: employee_ID@EMPRESA.app
        const email = `employee_${employeeId.trim()}@${formattedCompany}.app`;

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (err: any) {
            console.error("Auth Error:", err.message);
            if (err.message.includes("Invalid login credentials") || err.message.includes("not found")) {
                setError("Dados inválidos. Verifique o código da empresa, matrícula e senha.");
            } else {
                setError("Erro de conexão. Verifique sua internet.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Arranchou</h1>
                <p className="text-lg text-gray-400 mt-2 italic">Gestão Multi-Empresa</p>
            </div>
            <div className="w-full max-w-sm mx-auto bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                <h2 className="text-2xl font-bold text-center text-white mb-6">Acesse sua conta</h2>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider" htmlFor="companyCode">
                            Código da Empresa
                        </label>
                        <input
                            id="companyCode"
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-white uppercase font-bold placeholder-gray-500"
                            type="text"
                            placeholder="EX: ALFA"
                            value={companyCode}
                            onChange={(e) => setCompanyCode(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider" htmlFor="employeeId">
                            Nº da Matrícula
                        </label>
                        <input
                            id="employeeId"
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-white placeholder-gray-500"
                            type="text"
                            placeholder="Sua matrícula"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider" htmlFor="password">
                            Senha
                        </label>
                        <input
                            id="password"
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-white placeholder-gray-500"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    <button
                        className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform active:scale-95 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed mt-2"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Autenticando...' : 'Entrar no Sistema'}
                    </button>
                    
                    {error && (
                        <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg">
                            <p className="text-center text-red-400 text-sm font-medium">{error}</p>
                        </div>
                    )}
                </form>
            </div>
            <div className="mt-8 text-center">
                <p className="text-gray-500 text-sm">Precisa de ajuda com seu código?</p>
                <p className="text-gray-400 text-sm font-medium">Contate o RH da sua unidade.</p>
            </div>
        </div>
    );
};

export default AuthView;
