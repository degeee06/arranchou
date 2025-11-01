import React, { useState } from 'react';
import { DayKey } from '../types';
import { DAYS_OF_WEEK } from '../constants';

interface AddPersonFormProps {
  onAddPerson: (name: string, email: string, password: string, selectedDays: DayKey[]) => Promise<void>;
}

const AddPersonForm: React.FC<AddPersonFormProps> = ({ onAddPerson }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayKey[]>(() => [...DAYS_OF_WEEK]);
  const [loading, setLoading] = useState(false);

  const handleDayToggle = (day: DayKey) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
        alert("Por favor, preencha todos os campos.");
        return;
    }
    setLoading(true);
    await onAddPerson(name, email, password, selectedDays);
    setName('');
    setEmail('');
    setPassword('');
    setSelectedDays([...DAYS_OF_WEEK]);
    setLoading(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4">
        <h3 className="font-bold text-lg mb-3 text-gray-200">Criar Nova Conta</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome completo"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
            />
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email do usuário"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
            />
            <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Senha inicial"
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
            />
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dias padrão de presença:
                </label>
                <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                        <button
                            type="button"
                            key={day}
                            onClick={() => handleDayToggle(day)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 ${
                                selectedDays.includes(day)
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-600 text-gray-300'
                            }`}
                        >
                            {day.substring(0,3)}
                        </button>
                    ))}
                </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                {loading ? 'Criando...' : 'Adicionar Usuário'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
                Nota: Isso criará uma nova conta de usuário no sistema que poderá ser usada para login.
            </p>
        </form>
    </div>
  );
};

export default AddPersonForm;