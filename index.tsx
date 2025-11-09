import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';


declare let jspdf: any;

const SUPABASE_URL = 'https://ehosmvbealefukkbqggp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3NtdmJlYWxlZnVra2JxZ2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjIzMDgsImV4cCI6MjA3NzU5ODMwOH0.IKqwxawiPnZT__Djj6ISgnQOawKnbboJ1TfqhSTf89M';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const APP_URL = 'https://oubook.vercel.app'; // URL pública da sua aplicação

// Tipos
type Appointment = {
  id: string;
  created_at: string;
  name: string;
  email?: string;
  phone?: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Confirmado' | 'Cancelado';
  user_id: string;
};

type Profile = {
    id: string;
    plan: 'trial' | 'premium';
    daily_usage: number;
    last_usage_date: string;
    terms_accepted_at?: string;
    premium_expires_at?: string;
};

type BusinessProfile = {
    user_id: string;
    blocked_dates: string[];
    blocked_times: { [key: string]: string[] };
    working_days: { [key: string]: boolean };
    start_time?: string;
    end_time?: string;
}

type User = {
    id: string;
    email?: string;
};

type AssistantMessage = {
    sender: 'user' | 'ai' | 'system';
    text: string;
};


// --- Helpers ---
const parseDateAsUTC = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    // Month is 0-indexed for Date.UTC
    return new Date(Date.UTC(year, month - 1, day));
};

const maskPhone = (value: string) => {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.substring(0, 11);
    if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d*)/, '($1');
    }
    return value;
};


// --- Ícones ---
const Icon = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);
const CalendarIcon = (props: any) => <Icon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></Icon>;
const ClockIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></Icon>;
const CheckCircleIcon = (props: any) => <Icon {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></Icon>;
const XCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></Icon>;
const SearchIcon = (props: any) => <Icon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></Icon>;
const PlusIcon = (props: any) => <Icon {...props}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></Icon>;
const UserIcon = (props: any) => <Icon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></Icon>;
const MailIcon = (props: any) => <Icon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></Icon>;
const PhoneIcon = (props: any) => <Icon {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></Icon>;
const LinkIcon = (props: any) => <Icon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></Icon>;
const LogOutIcon = (props: any) => <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></Icon>;
const CopyIcon = (props: any) => <Icon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></Icon>;
const AlertCircleIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></Icon>;
const LoaderIcon = (props: any) => <Icon {...props} className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></Icon>;
const XIcon = (props: any) => <Icon {...props}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></Icon>;
const SettingsIcon = (props: any) => <Icon {...props}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></Icon>;
const StarIcon = (props: any) => <Icon {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></Icon>;
const ChevronLeftIcon = (props: any) => <Icon {...props}><polyline points="15 18 9 12 15 6"></polyline></Icon>;
const ChevronRightIcon = (props: any) => <Icon {...props}><polyline points="9 18 15 12 9 6"></polyline></Icon>;
const DownloadIcon = (props: any) => <Icon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></Icon>;
const BotIcon = (props: any) => <Icon {...props}><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M12 12v-2" /></Icon>;
const SendIcon = (props: any) => <Icon {...props}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></Icon>;
const ChatBubbleIcon = (props: any) => <Icon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></Icon>;
const MenuIcon = (props: any) => <Icon {...props}><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></Icon>;


// --- Componentes de UI ---
const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
  const baseClasses = "px-3 py-1 text-xs font-medium rounded-full text-white";
  const statusClasses = {
    Pendente: "bg-yellow-500/20 text-yellow-300",
    Confirmado: "bg-green-500/20 text-green-300",
    Cancelado: "bg-red-500/20 text-red-300",
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

const AppointmentCard = ({ appointment, onUpdateStatus, onDelete }: { appointment: Appointment; onUpdateStatus: (id: string, status: Appointment['status']) => void; onDelete: (id: string) => void; }) => {
    return (
      <div className="glassmorphism rounded-2xl p-6 flex flex-col space-y-4 transition-all duration-300 hover:border-gray-400 relative">
        <button 
            onClick={() => onDelete(appointment.id)}
            className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors z-10 p-1"
            aria-label="Excluir agendamento permanentemente"
        >
            <XIcon className="w-5 h-5" />
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-white">{appointment.name}</h3>
            {appointment.phone && <p className="text-sm text-gray-400">{maskPhone(appointment.phone)}</p>}
            {appointment.email && <p className="text-xs text-gray-500">{appointment.email}</p>}
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="border-t border-gray-700/50 my-4"></div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0 text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <span>{parseDateAsUTC(appointment.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-4 h-4 text-gray-500" />
            <span>{appointment.time}</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end space-x-2">
            <select
                value={appointment.status}
                onChange={(e) => onUpdateStatus(appointment.id, e.target.value as Appointment['status'])}
                className="bg-gray-800/50 border border-gray-700 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-auto p-2"
                aria-label="Mudar status do agendamento"
            >
                <option value="Pendente">Pendente</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Cancelado">Cancelado</option>
            </select>
        </div>
      </div>
    );
};

const Toast = ({ message, type, onDismiss }: { message: string, type: 'success' | 'error', onDismiss: () => void }) => {
    const bgColor = type === 'success' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30';

    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className={`fixed bottom-5 right-5 glassmorphism ${bgColor} p-4 rounded-lg shadow-lg flex items-center space-x-3 animate-fade-in-up z-50`}>
            {type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <AlertCircleIcon className="w-5 h-5" />}
            <span>{message}</span>
            <button onClick={onDismiss} className="text-gray-400 hover:text-white">
                <XIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const Modal = ({ isOpen, onClose, children, title }: { isOpen: boolean; onClose: () => void; children: React.ReactNode, title: string }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50" onClick={onClose}>
            <div className="glassmorphism rounded-2xl w-full max-w-md m-4 p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

// --- Componentes de Página ---

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!isLogin && !termsAccepted) {
        setError('Você deve aceitar os Termos de Serviço e a Política de Privacidade para se cadastrar.');
        setLoading(false);
        return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.hash = '/dashboard';
      } else {
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    terms_accepted_at: new Date().toISOString()
                }
            }
        });
        if (error) throw error;
        setMessage('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
      }
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}#/dashboard`
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dots p-4">
      <div className="w-full max-w-md">
        <div className="glassmorphism rounded-2xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-center text-white mb-2">
            {isLogin ? 'Bem-vindo(a) de volta!' : 'Crie sua conta'}
          </h2>
          <p className="text-center text-gray-400 mb-8">{isLogin ? 'Faça login para gerenciar seus agendamentos.' : 'Comece a organizar seus horários.'}</p>
          
          {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-center">{error}</p>}
          {message && <p className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4 text-center">{message}</p>}

          <form onSubmit={handleAuth} className="space-y-6">
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {!isLogin && (
                <div className="flex items-start">
                    <input 
                        id="terms" 
                        type="checkbox" 
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="h-4 w-4 mt-1 rounded border-gray-600 bg-gray-700 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="terms" className="ml-2 text-sm text-gray-400">
                        Eu li e aceito os <a href="/termos.html" target="_blank" className="underline text-amber-500 hover:text-amber-400">Termos de Serviço</a> e a <a href="/privacidade.html" target="_blank" className="underline text-amber-500 hover:text-amber-400">Política de Privacidade</a>.
                    </label>
                </div>
            )}
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-4 rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center">
              {loading ? <LoaderIcon className="w-6 h-6" /> : (isLogin ? 'Entrar' : 'Cadastrar')}
            </button>
          </form>

          <div className="my-6 flex items-center text-xs">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink mx-4 text-gray-500">OU</span>
            <div className="flex-grow border-t border-gray-700"></div>
          </div>
          
          <button onClick={handleGoogleLogin} className="w-full bg-gray-800/50 border border-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700/50 transition-all duration-300 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.03,4.73 15.69,5.36 16.95,6.58L19.35,4.19C17.22,2.34 14.8,1.5 12.19,1.5C7.03,1.5 3,5.5 3,12C3,18.67 6.9,22.5 12.19,22.5C17.6,22.5 21.6,18.33 21.6,12.27C21.6,11.76 21.49,11.4 21.35,11.1Z"></path></svg>
            Continuar com o Google
          </button>

          <p className="mt-8 text-center text-sm text-gray-400">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-amber-500 hover:text-amber-400 ml-1">
              {isLogin ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ user }: { user: User }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [isPremiumModalOpen, setPremiumModalOpen] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const fetchProfile = useCallback(async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (error) {
            console.error('Error fetching profile', error);
        } else {
            setProfile(data);
        }
    }, [user.id]);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: true })
            .order('time', { ascending: true });
        if (error) {
            console.error('Error fetching appointments', error);
            showToast('Erro ao carregar agendamentos.', 'error');
        } else {
            setAppointments(data);
        }
        setLoading(false);
    }, [user.id]);

    useEffect(() => {
        fetchProfile();
        fetchAppointments();
    }, [fetchProfile, fetchAppointments]);

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
        if (error) {
            showToast('Erro ao atualizar status.', 'error');
        } else {
            showToast('Status atualizado com sucesso!', 'success');
            fetchAppointments();
        }
    };
    
    const handleDeleteAppointment = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este agendamento permanentemente?')) {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (error) {
                showToast('Erro ao excluir agendamento.', 'error');
            } else {
                showToast('Agendamento excluído com sucesso.', 'success');
                fetchAppointments();
            }
        }
    };


    const generatePublicLink = () => {
        if (user) {
            const url = `${APP_URL}/#/${user.id}?reset=${new Date().getTime()}`;
            navigator.clipboard.writeText(url);
            showToast('Link público copiado para a área de transferência!', 'success');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.hash = '/login';
    };
    
    const downloadReport = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        
        doc.text("Relatório de Agendamentos", 14, 16);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);

        const tableColumn = ["Nome", "Telefone", "Data", "Hora", "Status"];
        const tableRows: any[][] = [];

        filteredAppointments.forEach(app => {
            const appointmentData = [
                app.name,
                app.phone ? maskPhone(app.phone) : 'N/A',
                parseDateAsUTC(app.date).toLocaleDateString('pt-BR'),
                app.time,
                app.status
            ];
            tableRows.push(appointmentData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] },
        });
        
        doc.save(`relatorio_agendamentos_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Download do relatório iniciado!', 'success');
    }

    const filteredAppointments = appointments.filter(app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.phone?.includes(searchTerm) ||
        app.date.includes(searchTerm)
    );

    const isPremium = profile?.plan === 'premium';
    
    const PremiumModal = () => (
        <Modal isOpen={isPremiumModalOpen} onClose={() => setPremiumModalOpen(false)} title="✨ Seja Premium">
            <div className="space-y-4 text-gray-300">
                <p>Desbloqueie todo o potencial do Oubook com o plano Premium!</p>
                <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>Agendamentos ilimitados</li>
                    <li>Configurações avançadas de horários</li>
                    <li>Bloqueio de datas e horários específicos</li>
                    <li>Relatórios em PDF</li>
                    <li>Suporte prioritário</li>
                </ul>
                <p className="font-bold text-white text-lg text-center pt-2">Acesso vitalício por um preço especial!</p>
                
                {/* Botão Hotmart */}
                <div className="pt-4">
                    <a 
                        href="https://pay.hotmart.com/E93988965N?checkoutMode=10"
                        className="hotmart-fb hotmart__button-checkout"
                        target="_blank" 
                        rel="noopener noreferrer"
                    >
                        <StarIcon className="w-5 h-5" />
                        <span>QUERO SER PREMIUM</span>
                    </a>
                </div>
                <p className="text-xs text-center text-gray-500 pt-2">Você será redirecionado para a página de pagamento segura da Hotmart.</p>
            </div>
        </Modal>
    );

    return (
        <div className="min-h-screen bg-black">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} user={user} showToast={showToast} isPremium={isPremium} onUpgrade={() => { setSettingsModalOpen(false); setPremiumModalOpen(true);}} />
            <PremiumModal />

            {/* Header */}
            <header className="glassmorphism sticky top-0 z-40">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex-shrink-0">
                            <h1 className="text-2xl font-bold text-white tracking-tighter">Oubook</h1>
                        </div>

                        {/* Desktop Menu */}
                        <nav className="hidden md:flex md:items-center md:space-x-4">
                            {!isPremium && (
                                <button onClick={() => setPremiumModalOpen(true)} className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all duration-300 text-sm">
                                    <StarIcon className="w-4 h-4" />
                                    <span>Seja Premium</span>
                                </button>
                            )}
                            <button onClick={generatePublicLink} className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"><LinkIcon className="w-5 h-5" /><span>Link Público</span></button>
                            <button onClick={() => setSettingsModalOpen(true)} className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"><SettingsIcon className="w-5 h-5" /><span>Ajustes</span></button>
                            <button onClick={handleLogout} className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"><LogOutIcon className="w-5 h-5" /><span>Sair</span></button>
                        </nav>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-300 hover:text-white">
                                <MenuIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                 <div className="md:hidden glassmorphism p-4 space-y-4">
                     {!isPremium && (
                         <button onClick={() => { setPremiumModalOpen(true); setMobileMenuOpen(false); }} className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all duration-300 text-sm">
                             <StarIcon className="w-4 h-4" />
                             <span>Seja Premium</span>
                         </button>
                     )}
                     <button onClick={() => { generatePublicLink(); setMobileMenuOpen(false); }} className="w-full flex items-center justify-center space-x-2 text-gray-300 hover:text-white transition-colors py-2"><LinkIcon className="w-5 h-5" /><span>Link Público</span></button>
                     <button onClick={() => { setSettingsModalOpen(true); setMobileMenuOpen(false); }} className="w-full flex items-center justify-center space-x-2 text-gray-300 hover:text-white transition-colors py-2"><SettingsIcon className="w-5 h-5" /><span>Ajustes</span></button>
                     <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 text-gray-300 hover:text-white transition-colors py-2"><LogOutIcon className="w-5 h-5" /><span>Sair</span></button>
                 </div>
            )}


            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {/* Dashboard Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Seus Agendamentos</h2>
                        <p className="text-gray-400">Visualize e gerencie todos os seus horários.</p>
                    </div>
                    <div className="relative w-full md:w-auto">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-gray-900/50 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                    <button onClick={downloadReport} disabled={!isPremium} className="flex items-center justify-center space-x-2 bg-gray-800/50 border border-gray-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        <DownloadIcon className="w-5 h-5" />
                        <span>Baixar Relatório</span>
                        {!isPremium && <StarIcon className="w-4 h-4 text-amber-400 ml-1" />}
                    </button>
                </div>

                {/* Appointments Grid */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <LoaderIcon className="w-12 h-12 text-amber-500" />
                    </div>
                ) : filteredAppointments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredAppointments.map(app => (
                            <AppointmentCard key={app.id} appointment={app} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteAppointment} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 glassmorphism rounded-2xl">
                        <CalendarIcon className="w-16 h-16 mx-auto text-gray-600" />
                        <h3 className="mt-4 text-xl font-semibold text-white">Nenhum agendamento encontrado</h3>
                        <p className="mt-2 text-gray-400">Quando alguém marcar um horário com você, ele aparecerá aqui.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

const PublicBookingPage = ({ userId }: { userId: string }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [availableTimes, setAvailableTimes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingTimes, setLoadingTimes] = useState(false);
    const [hasScheduled, setHasScheduled] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        const [path, queryString] = hash.split('?');
        const params = new URLSearchParams(queryString);

        if (params.has('reset')) {
            localStorage.removeItem('oubook_phone');
            // Clean URL to avoid re-triggering on refresh, without reloading
            window.history.replaceState(null, '', `/#${path}`);
        }

        const checkExistingAppointment = async () => {
            const storedPhone = localStorage.getItem('oubook_phone');
            if (storedPhone && userId) {
                setLoading(true);
                const { data, error } = await supabase
                    .from('appointments')
                    .select('id, status')
                    .eq('user_id', userId)
                    .eq('phone', storedPhone)
                    .in('status', ['Pendente', 'Confirmado'])
                    .maybeSingle();

                if (error) {
                    console.error('Error checking existing appointment:', error);
                } else if (data) {
                    setHasScheduled(true);
                } else {
                    // No active appointment found, clear local storage
                    localStorage.removeItem('oubook_phone');
                    setHasScheduled(false);
                }
                setLoading(false);
            }
        };

        if(userId) {
            checkExistingAppointment();
        }
    }, [userId]);

    useEffect(() => {
        const fetchBusinessProfile = async () => {
            if (!userId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('business_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) {
                console.error("Error fetching business profile:", error);
                showToast("Profissional não encontrado.", "error");
            } else {
                setBusinessProfile(data);
            }
            setLoading(false);
        };
        fetchBusinessProfile();
    }, [userId]);

    const handleDateChange = useCallback(async (date: string) => {
        setSelectedDate(date);
        setSelectedTime('');
        if (!date || !businessProfile) return;

        setLoadingTimes(true);
        setAvailableTimes([]);

        const selectedDay = parseDateAsUTC(date).getUTCDay(); // 0 for Sunday, 1 for Monday, etc.
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDay];
        
        if (!businessProfile.working_days || !businessProfile.working_days[dayName]) {
            setLoadingTimes(false);
            return;
        }

        const { data: bookedAppointments, error } = await supabase
            .from('appointments')
            .select('time')
            .eq('user_id', userId)
            .eq('date', date)
            .in('status', ['Pendente', 'Confirmado']);

        if (error) {
            console.error('Error fetching booked appointments:', error);
            setLoadingTimes(false);
            return;
        }

        const bookedTimes = bookedAppointments.map(a => a.time);
        const blockedTimesForDate = businessProfile.blocked_times?.[date] || [];

        // Generate time slots (ex: 09:00, 09:30, 10:00)
        const startTime = businessProfile.start_time || "09:00";
        const endTime = businessProfile.end_time || "18:00";
        const interval = 30; // minutes

        const times: string[] = [];
        let currentTime = new Date(`1970-01-01T${startTime}:00Z`);
        const endDateTime = new Date(`1970-01-01T${endTime}:00Z`);

        while (currentTime < endDateTime) {
            const timeString = currentTime.toISOString().substr(11, 5);
            if (!bookedTimes.includes(timeString) && !blockedTimesForDate.includes(timeString)) {
                times.push(timeString);
            }
            currentTime.setMinutes(currentTime.getMinutes() + interval);
        }

        setAvailableTimes(times);
        setLoadingTimes(false);
    }, [userId, businessProfile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone || !selectedDate || !selectedTime) {
            showToast('Por favor, preencha todos os campos.', 'error');
            return;
        }
        setLoading(true);
        
        const unmaskedPhone = phone.replace(/\D/g, '');

        const { error } = await supabase.from('appointments').insert({
            name,
            phone: unmaskedPhone,
            date: selectedDate,
            time: selectedTime,
            status: 'Pendente',
            user_id: userId,
        });

        if (error) {
            showToast('Erro ao agendar. Tente novamente.', 'error');
        } else {
            localStorage.setItem('oubook_phone', unmaskedPhone);
            setHasScheduled(true);
        }
        setLoading(false);
    };

    const isDateBlocked = (date: Date) => {
        const dateString = date.toISOString().split('T')[0];
        if (businessProfile?.blocked_dates?.includes(dateString)) return true;

        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getUTCDay()];
        return !businessProfile?.working_days?.[dayName];
    };

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);


    if (loading && !businessProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dots">
                <LoaderIcon className="w-12 h-12 text-amber-500" />
            </div>
        );
    }

    if (!businessProfile) {
        return (
             <div className="min-h-screen flex items-center justify-center bg-dots p-4">
                <div className="text-center glassmorphism p-8 rounded-2xl">
                    <XCircleIcon className="w-16 h-16 mx-auto text-red-500" />
                    <h2 className="mt-4 text-2xl font-bold text-white">Página de Agendamento Indisponível</h2>
                    <p className="mt-2 text-gray-400">O link que você acessou pode estar incorreto ou o profissional não está mais ativo.</p>
                </div>
            </div>
        );
    }
    
    if (hasScheduled) {
        return (
             <div className="min-h-screen flex items-center justify-center bg-dots p-4">
                <div className="text-center glassmorphism p-8 rounded-2xl">
                    <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500" />
                    <h2 className="mt-4 text-2xl font-bold text-white">Agendamento Realizado</h2>
                    <p className="mt-2 text-gray-400">Você já realizou um agendamento. Para marcar um novo horário, por favor, entre em contato diretamente com o profissional.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-dots p-4">
          {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
          <div className="w-full max-w-md">
            <div className="glassmorphism rounded-2xl p-8 shadow-2xl">
              <h2 className="text-3xl font-bold text-center text-white mb-2">Marque seu Horário</h2>
              <p className="text-center text-gray-400 mb-8">Rápido, fácil e seguro.</p>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Nome Completo</label>
                  <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-gray-800/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">WhatsApp</label>
                  <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} required className="w-full bg-gray-800/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                 <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-2">Data</label>
                    <input
                        id="date"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        min={today.toISOString().split("T")[0]}
                        required
                        className="w-full bg-gray-800/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                    />
                </div>

                {selectedDate && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Horário</label>
                        {loadingTimes ? (
                            <div className="flex justify-center items-center h-24">
                                <LoaderIcon className="w-8 h-8 text-amber-500" />
                            </div>
                        ) : availableTimes.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {availableTimes.map(time => (
                                    <button
                                        key={time}
                                        type="button"
                                        onClick={() => setSelectedTime(time)}
                                        className={`p-2 rounded-lg text-sm transition-colors ${selectedTime === time ? 'bg-amber-600 text-white font-bold' : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-700/50'}`}
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-400 bg-gray-800/50 p-4 rounded-lg">Nenhum horário disponível para esta data.</p>
                        )}
                    </div>
                )}

                <button type="submit" disabled={loading || !selectedTime} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-4 rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                  {loading ? <LoaderIcon className="w-6 h-6" /> : 'Agendar Horário'}
                </button>
              </form>
            </div>
          </div>
        </div>
    );
};

const SettingsModal = ({ isOpen, onClose, user, showToast, isPremium, onUpgrade }: { isOpen: boolean; onClose: () => void; user: User; showToast: (msg: string, type: 'success' | 'error') => void; isPremium: boolean; onUpgrade: () => void; }) => {
    const [profile, setProfile] = useState<BusinessProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const workingDaysInitial = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
    const daysOfWeek = Object.keys(workingDaysInitial);
    const dayLabels: { [key: string]: string } = { monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom' };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            const fetchProfile = async () => {
                const { data, error } = await supabase
                    .from('business_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                
                if (data) {
                    setProfile({
                        ...data,
                        working_days: data.working_days || workingDaysInitial,
                        start_time: data.start_time || '09:00',
                        end_time: data.end_time || '18:00',
                    });
                } else if (error && error.code === 'PGRST116') { // No rows found
                     setProfile({
                        user_id: user.id,
                        blocked_dates: [],
                        blocked_times: {},
                        working_days: workingDaysInitial,
                        start_time: '09:00',
                        end_time: '18:00',
                    });
                }
                setLoading(false);
            };
            fetchProfile();
        }
    }, [isOpen, user.id]);

    const handleSave = async () => {
        if (!profile) return;
        setLoading(true);
        const { error } = await supabase
            .from('business_profiles')
            .upsert(profile, { onConflict: 'user_id' });

        if (error) {
            showToast('Erro ao salvar as configurações.', 'error');
            console.error(error);
        } else {
            showToast('Configurações salvas com sucesso!', 'success');
            onClose();
        }
        setLoading(false);
    };
    
    const handleWorkingDayChange = (day: string) => {
        if (!profile) return;
        const newWorkingDays = { ...profile.working_days, [day]: !profile.working_days[day] };
        setProfile({ ...profile, working_days: newWorkingDays });
    };

    const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
        if (!profile) return;
        setProfile({ ...profile, [field]: value });
    };


    if (loading) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Ajustes de Agendamento">
                <div className="flex justify-center items-center h-64"><LoaderIcon className="w-10 h-10 text-amber-500" /></div>
            </Modal>
        )
    }

    if (!profile) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajustes de Agendamento">
            <div className={`space-y-6 ${!isPremium ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <h3 className="text-md font-semibold text-gray-200 mb-2">Dias de Atendimento</h3>
                    <div className="flex justify-between space-x-1">
                        {daysOfWeek.map(day => (
                            <button
                                key={day}
                                onClick={() => handleWorkingDayChange(day)}
                                className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${profile.working_days[day] ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                            >
                                {dayLabels[day]}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-md font-semibold text-gray-200 mb-2">Horário de Atendimento</h3>
                     <div className="flex items-center space-x-4">
                        <div className="w-1/2">
                            <label className="text-xs text-gray-400">Início</label>
                            <input
                                type="time"
                                value={profile.start_time}
                                onChange={e => handleTimeChange('start_time', e.target.value)}
                                className="w-full bg-gray-800/50 border border-gray-700 text-white px-3 py-2 rounded-lg"
                            />
                        </div>
                        <div className="w-1/2">
                            <label className="text-xs text-gray-400">Fim</label>
                            <input
                                type="time"
                                value={profile.end_time}
                                onChange={e => handleTimeChange('end_time', e.target.value)}
                                className="w-full bg-gray-800/50 border border-gray-700 text-white px-3 py-2 rounded-lg"
                            />
                        </div>
                    </div>
                </div>
                {/* Mais configurações podem ser adicionadas aqui, como bloqueio de datas */}

            </div>

             {!isPremium && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col justify-center items-center text-center p-4 rounded-2xl z-10">
                    <StarIcon className="w-10 h-10 text-amber-400 mb-4" />
                    <h3 className="text-lg font-bold text-white">Essa é uma função Premium</h3>
                    <p className="text-gray-300 mb-4">Faça upgrade para personalizar seus dias e horários de atendimento.</p>
                    <button onClick={onUpgrade} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold py-2 px-6 rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all">
                        Seja Premium
                    </button>
                </div>
            )}
            
            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading || !isPremium}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-2 px-6 rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <LoaderIcon className="w-5 h-5"/> : "Salvar"}
                </button>
            </div>
        </Modal>
    );
};


const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState(window.location.hash.slice(1));
  const isCapacitor = Capacitor.isNativePlatform();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      // Handle OAuth redirect
      if (!session) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          if (session) {
             window.location.hash = '/dashboard';
          }
          subscription.unsubscribe();
        });
      }
      setLoading(false);
    };
    getSession();

    const handleHashChange = () => setPath(window.location.hash.slice(1));
    window.addEventListener('hashchange', handleHashChange);

    if (isCapacitor) {
        CapacitorApp.addListener('appUrlOpen', (event) => {
            const slug = event.url.split('.app').pop();
            if (slug) {
                // Navigate using hash
                window.location.hash = slug;
            }
        });
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isCapacitor]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoaderIcon className="w-12 h-12 text-amber-500" />
      </div>
    );
  }

  let content;
  if (path === '/login' || path === '') {
    content = <AuthPage />;
  } else if (path === '/dashboard') {
    content = session ? <AdminDashboard user={session.user} /> : <AuthPage />;
  } else {
    const userIdWithQuery = path.startsWith('/') ? path.substring(1) : path;
    const userId = userIdWithQuery.split('?')[0];
    content = <PublicBookingPage userId={userId} />;
  }

  return (
    <div>
        <script async src="https://assets.hotmart.com/checkout/hotmart.js"></script>
        {content}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
