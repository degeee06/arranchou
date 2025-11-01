import React from 'react';
import { HistoryEntry } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { CheckIcon, XIcon } from './icons';
import { getDatesForWeekId } from '../utils';

interface HistoryTableProps {
  weekData: HistoryEntry;
}

const HistoryTable: React.FC<HistoryTableProps> = ({ weekData }) => {
  const { people, attendance, weekId } = weekData;
  const weekDates = getDatesForWeekId(weekId);

  const formatDate = (date: Date) => {
    return `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-700">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Nome
            </th>
            {DAYS_OF_WEEK.map((day, index) => (
              <th key={day} scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                <span>{day.substring(0, 3)}</span>
                <span className="block font-normal normal-case text-gray-400">{formatDate(weekDates[index])}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-800 divide-y divide-gray-700">
          {people.sort((a,b) => a.full_name.localeCompare(b.full_name)).map(person => (
            <tr key={person.id} className="hover:bg-gray-700">
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                {person.full_name}
              </td>
              {DAYS_OF_WEEK.map(day => {
                const status = attendance[person.id]?.[day];
                return (
                  <td key={day} className="px-4 py-3 whitespace-nowrap text-center">
                    {status === true && <span className="text-green-400 inline-flex"><CheckIcon /></span>}
                    {status === false && <span className="text-red-400 inline-flex"><XIcon /></span>}
                    {status === undefined && <span className="text-gray-500">-</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;
