
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
    const [error, setError] = useState<{message: string, isSchemaError?: boolean} | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formattedCompany = companyCode.trim().toLowerCase().replace(/\s+/g, '');
        const email = `employee_${employeeId.trim()}@${formattedCompany}.app`;

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (authError) throw authError;
        } catch (err: any) {
            console.error("Auth Error:", err);
            
            const isSchemaError = err.message?.includes("Database error querying schema") || err.status === 500;
            
            if (isSchemaError) {
                setError({
                    message: "Erro interno no Supabase (Schema Cache). Isso acontece quando o banco de dados está instável ou em manutenção.",
                    isSchemaError: true
                });
            } else if (err.message?.includes("Invalid login credentials")) {
                setError({ message: "Credenciais inválidas. Verifique código, matrícula e senha." });
            } else {
                setError({ message: err.message || "Erro inesperado. Tente novamente." });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0c10] flex flex-col justify-center items-center p-6 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-[400px] z-10 animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-10">
                    <div className="inline-block p-4 bg-brand-primary/10 rounded-3xl mb-4 border border-brand-primary/20">
                        <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-10.429A9.99 9.99 0 005.57 5.157m4.453 4.453L12 11V3.065M12 11l3.52 3.52M12 11L8.48 7.48M12 11v7.935M12 11l3.52-3.52m0 0A9.99 9.99 0 0118.43 5.157m-4.453 4.453L12 11V3.065" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">Arranchou</h1>
                    <p className="text-slate-400 font-medium tracking-wide">SISTEMA DE GESTÃO DE REFEIÇÕES</p>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] ml-1">Código da Unidade</label>
                            <input
                                className="w-full px-5 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white font-bold placeholder-slate-600 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all outline-none uppercase"
                                type="text"
                                placeholder="EX: DORES"
                                value={companyCode}
                                onChange={(e) => setCompanyCode(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] ml-1">Matrícula</label>
                            <input
                                className="w-full px-5 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white font-medium placeholder-slate-600 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all outline-none"
                                type="text"
                                placeholder="0000"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] ml-1">Senha de Acesso</label>
                            <input
                                className="w-full px-5 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white font-medium placeholder-slate-600 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all outline-none"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-4 rounded-2xl transition-all duration-300 transform active:scale-[0.98] shadow-[0_10px_20px_-10px_rgba(13,71,161,0.5)] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>Verificando...</span>
                                </div>
                            ) : 'Entrar no Sistema'}
                        </button>
                    </form>

                    {error && (
                        <div className={`mt-6 p-4 rounded-2xl border ${error.isSchemaError ? 'bg-amber-950/20 border-amber-500/30' : 'bg-red-950/20 border-red-500/30'} animate-in slide-in-from-top-2 duration-300`}>
                            <p className={`text-sm font-medium ${error.isSchemaError ? 'text-amber-400' : 'text-red-400'} leading-relaxed`}>
                                {error.message}
                            </p>
                            {error.isSchemaError && (
                                <div className="mt-3 text-[11px] text-amber-500/80 leading-snug">
                                    <strong>Dica:</strong> Vá ao Painel Supabase > Settings > General > clique em <strong>"Restart Project"</strong> ou execute o SQL de reparo no editor.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-10 text-center space-y-1">
                    <p className="text-slate-600 text-sm">Problemas com o acesso?</p>
                    <p className="text-slate-400 text-sm font-bold hover:text-white cursor-pointer transition-colors uppercase tracking-widest text-[10px]">Contatar Administrador</p>
                </div>
            </div>
        </div>
    );
};

export default AuthView;
