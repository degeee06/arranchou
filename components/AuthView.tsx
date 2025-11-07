import React, { useState } from 'react';
import { supabase } from '../supabase';

const AuthView: React.FC = () => {
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                // Invoca a função de backend segura para o cadastro
                const { data, error: functionError } = await supabase.functions.invoke('custom-sign-up', {
                    body: { employeeId, fullName, password },
                });

                if (functionError) {
                    // Tenta extrair a mensagem de erro específica da função
                    const errorMessage = functionError.context?.error?.message || functionError.message;
                    throw new Error(errorMessage);
                }
                
                setMessage(data.message || 'Cadastro realizado com sucesso! Você já pode entrar.');
                setIsSignUp(false); // Alterna para a tela de login após o sucesso
                
            } else {
                // A lógica de login permanece a mesma, usando o email gerado
                const email = `employee_${employeeId}@arranchou.app`;
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // O login bem-sucedido será tratado pelo listener em App.tsx
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            const errorMessage = err.message || 'Ocorreu um erro desconhecido.';

            if (errorMessage.includes("Invalid login credentials")) {
                setError("Nº do Crachá ou senha inválidos.");
            } else {
                // Exibe a mensagem de erro vinda da função ou do signIn
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="text-center mb-8">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Arranchou</h1>
                <p className="text-lg text-gray-400 mt-2">Acesse para gerenciar o arranchamento.</p>
            </div>
            <div className="w-full max-w-sm mx-auto bg-gray-800 p-8 rounded-lg shadow-lg">
                <div className="mb-4 flex border-b border-gray-700">
                    <button onClick={() => { setIsSignUp(false); setError(null); setMessage(null);}} className={`w-1/2 py-2 font-semibold ${!isSignUp ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>
                        Entrar
                    </button>
                    <button onClick={() => { setIsSignUp(true); setError(null); setMessage(null);}} className={`w-1/2 py-2 font-semibold ${isSignUp ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>
                        Cadastrar
                    </button>
                </div>
                
                <h2 className="text-2xl font-bold text-center text-white mb-6">{isSignUp ? 'Criar Conta' : 'Login'}</h2>
                
                <form onSubmit={handleAuthAction}>
                    {isSignUp && (
                        <div className="mb-4">
                            <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="fullName">
                                Nome Completo
                            </label>
                            <input
                                id="fullName"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
                                type="text"
                                placeholder="Seu nome completo"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="employeeId">
                            Nº do Crachá / Matrícula
                        </label>
                        <input
                            id="employeeId"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
                            type="text"
                            placeholder="Seu número de identificação"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">
                            Senha
                        </label>
                        <input
                            id="password"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-white"
                            type="password"
                            placeholder="************"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-600"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Carregando...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
                        </button>
                    </div>
                    {error && <p className="mt-4 text-center text-red-400 text-sm">{error}</p>}
                    {message && <p className="mt-4 text-center text-green-400 text-sm">{message}</p>}
                </form>
            </div>
        </div>
    );
};

export default AuthView;
