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

        // Generate a consistent, fake email from the employee ID for Supabase Auth
        const email = `employee_${employeeId}@arranchou.app`;

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            employee_id: employeeId,
                            role: 'employee',
                        }
                    }
                });
                if (error) throw error;
                setMessage('Cadastro realizado com sucesso! Você já pode entrar.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Login will be handled by the listener in App.tsx
            }
        } catch (err: any) {
            console.error("Auth Error:", err.message);

            if (err.message.includes("Invalid login credentials")) {
                setError("Nº do Crachá ou senha inválidos.");
            } else if (err.message.includes('profiles_employee_id_key')) {
                // This is the new, more robust check for the UNIQUE constraint on the database.
                setError("Este Nº do Crachá já está cadastrado. Tente um número diferente ou faça login.");
            } else if (err.message.includes("User already registered")) {
                console.warn("User already exists in auth, but maybe not in profiles. Attempting login to recover.");
                // This is our recovery logic for orphan auth users.
                // If sign-up fails because the user exists, we try to sign in.
                // If sign-in succeeds, it means their profile was missing. We recreate it.
                try {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });
                    if (signInError) {
                        // If sign-in fails here, it's a genuine wrong password for an existing user.
                        setError("Este Nº do Crachá já está cadastrado. Se você já tem uma conta, a senha informada está incorreta.");
                        return; // Stop execution
                    }
                    
                    if (signInData.user) {
                         // Sign-in successful, now check if profile exists before creating
                        const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', signInData.user.id).single();
                        
                        if (!existingProfile) {
                            const { error: profileError } = await supabase.from('profiles').insert({
                                id: signInData.user.id,
                                full_name: fullName,
                                employee_id: employeeId,
                                role: 'employee'
                            });

                            if (profileError) {
                                console.error("Failed to recreate profile for orphan user:", profileError);
                                setError("Falha ao recuperar conta. Tente novamente mais tarde.");
                            } else {
                                console.log("Successfully recovered and recreated profile for user:", signInData.user.id);
                                // The onAuthStateChange listener will handle the successful login
                            }
                        } else {
                           // This case is rare, but means the profile exists and the user should just log in.
                           // The login already succeeded, so the listener will handle it.
                           console.log("User has an auth entry and a profile. Login will proceed.");
                        }
                    }
                } catch (recoveryErr: any) {
                    setError("Ocorreu um erro inesperado durante a recuperação da conta. Tente fazer login.");
                }
            }
            else {
                setError(err.error_description || err.message);
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