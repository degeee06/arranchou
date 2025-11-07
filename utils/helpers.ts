// Fix: Use default import for jsPDF as it is a default export, which allows TypeScript to find the module for augmentation.
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserProfile, AttendanceRecord, AttendanceStatus, WeekData } from '../types';

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
};

export const getWeekDates = (startDate: Date): Date[] => {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const formatDisplayDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit' };
    return date.toLocaleDateString('pt-BR', options);
}

export const generatePdfReport = (weekData: WeekData, users: UserProfile[]) => {
    const doc = new jsPDF();
    const weekStartDate = new Date(weekData.week_start_date);
    const weekDates = getWeekDates(weekStartDate);

    doc.setFontSize(18);
    doc.text(`Relatório de Presença - Semana de ${weekStartDate.toLocaleDateString('pt-BR')}`, 14, 22);

    const head = [['Funcionário', ...weekDates.map(d => formatDisplayDate(d))]];
    
    const body = users.map(user => {
        const row = [user.full_name];
        weekDates.forEach(date => {
            const record = weekData.records.find(r => r.user_id === user.id && r.date === formatDate(date));
            let statusChar = '-'; // Not Marked
            if (record?.status === AttendanceStatus.PRESENT) statusChar = 'P'; // Present
            if (record?.status === AttendanceStatus.ABSENT) statusChar = 'F'; // Falta (Absent)
            row.push(statusChar);
        });
        return row;
    });

    doc.autoTable({
        head,
        body,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`relatorio-semana-${formatDate(weekStartDate)}.pdf`);
};