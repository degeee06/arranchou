import React from 'react';
import { Attendance, DayKey, Profile } from '../types';
import { getDatesForWeekId } from '../utils';
import { DAYS_OF_WEEK } from '../constants';

interface SummaryProps {
  people: Profile[];
  attendance: Attendance;
  currentDay: DayKey;
  currentWeekId: string;
}

const Summary: React.FC<SummaryProps> = ({ people, attendance, currentDay, currentWeekId }) => {
  const dateForCurrentDay = getDatesForWeekId(currentWeekId)[DAYS_OF_WEEK.indexOf(currentDay)].toISOString().split('T')[0];
  
  const presentCount = people.filter(
    person => attendance[person.id]?.[dateForCurrentDay] === 'Presente'
  ).length;

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 text-center">
      <h3 className="font-bold text-lg text-gray-200">Resumo de {currentDay}</h3>
      <p className="text-4xl font-bold text-brand-primary mt-2">{presentCount}</p>
      <p className="text-gray-400">Pessoas presentes</p>
    </div>
  );
};

export default Summary;
