
import { Attendance } from '../types';

// Augment the window object to include the jsPDF types
declare global {
  interface Window {
    jspdf: any;
  }
}

export const generateHistoryPDF = (history: Attendance[], userName: string) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text(`Histórico de Presença - ${userName}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 26);

  const tableColumn = ["Data", "Status", "Última Atualização"];
  const tableRows: (string | number)[][] = [];

  history.forEach(record => {
    const recordData = [
      new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR'),
      record.status,
      new Date(record.updated_at).toLocaleString('pt-BR'),
    ];
    tableRows.push(recordData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 30,
    theme: 'grid',
    headStyles: { fillColor: [22, 163, 74] }, // Green-600
  });

  doc.save(`historico_presenca_${userName.replace(/\s/g, '_')}.pdf`);
};

export const generateAdminHistoryPDF = (history: (Attendance & { profiles: { full_name: string } })[]) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  doc.text('Relatório Geral de Presença', 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 26);

  const tableColumn = ["Data", "Funcionário", "Status", "Última Atualização"];
  const tableRows: (string | number)[][] = [];

  history.forEach(record => {
    const recordData = [
      new Date(record.date + 'T00:00:00').toLocaleDateString('pt-BR'),
      record.profiles?.full_name || 'N/A',
      record.status,
      new Date(record.updated_at).toLocaleString('pt-BR'),
    ];
    tableRows.push(recordData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 30,
    theme: 'grid',
    headStyles: { fillColor: [29, 78, 216] }, // Blue-700
  });

  doc.save(`relatorio_geral_presenca.pdf`);
};
