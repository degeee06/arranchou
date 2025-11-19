import React from 'react';
import { Attendance, DayKey, Profile } from '../types';

interface SummaryProps {
  people: Profile[];
  attendance: Attendance;
  currentDay: DayKey;
}

const Summary: React.FC<SummaryProps> = ({ people, attendance, currentDay }) => {
  const presentCount = people.filter(
    person => attendance[person.id]?.[currentDay]?.is_present
  ).length;
  
  const validatedCount = people.filter(
    person => attendance[person.id]?.[currentDay]?.validated
  ).length;

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 text-center flex flex-col gap-4">
        <div>
            <h3 className="font-bold text-lg text-gray-200">Previstos para {currentDay}</h3>
            <p className="text-4xl font-bold text-brand-primary mt-2">{presentCount}</p>
            <p className="text-gray-400">Total Reservado</p>
        </div>
        
        {validatedCount > 0 && (
             <div className="pt-4 border-t border-gray-700">
                <p className="text-2xl font-bold text-blue-400">{validatedCount}</p>
                <p className="text-sm text-gray-400">Validados (Check-in)</p>
            </div>
        )}
    </div>
  );
};

export default Summary;