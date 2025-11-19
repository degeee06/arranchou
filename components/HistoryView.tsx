import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HistoryEntry, Profile, AttendanceRecord } from '../types';
import HistoryTable from './HistoryTable';
import { PDFIcon, DotsVerticalIcon, TrashIcon } from './icons';
import { DAYS_OF_WEEK } from '../constants';
import { getDatesForWeekId, getReadableWeekRange, getWeekId, getPaginatedPastWeeksIds } from '../utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import PaginationControls from './PaginationControls';
import { supabase } from '../supabase';
import Modal from './Modal';

interface HistoryViewProps {
  allProfiles: Profile[];
  currentUserProfile: Profile;
}

const WEEKS_PER_PAGE = 5;
const TOTAL_HISTORY_WEEKS = 52; // Look back up to one year

const HistoryView: React.FC<HistoryViewProps> = ({ allProfiles, currentUserProfile }) => {
  const [historyAttendances, setHistoryAttendances] = useState<AttendanceRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<HistoryEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const isSuperAdmin = currentUserProfile.role === 'super_admin';

  // Fetch paginated history data from Supabase whenever the page changes
  useEffect(() => {
    const fetchPagedHistory = async () => {
        setIsHistoryLoading(true);
        const weeksToFetch = getPaginatedPastWeeksIds(currentPage, WEEKS_PER_PAGE);

        if (weeksToFetch.length === 0) {
            setHistoryAttendances([]);
            setIsHistoryLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('attendances')
            .select('*')
            .in('week_id', weeksToFetch);
        
        if (error) {
            console.error('Failed to fetch paged history:', error);
            alert('Falha ao carregar o histórico.');
            setHistoryAttendances([]);
        } else {
            setHistoryAttendances(data || []);
        }
        setIsHistoryLoading(false);
    };

    fetchPagedHistory();
  }, [currentPage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as HTMLElement).closest('.actions-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);


  const historyData: HistoryEntry[] = useMemo(() => {
    // This logic now processes only the chunk of data fetched for the current page
    const groupedByWeek: { [weekId: string]: AttendanceRecord[] } = historyAttendances.reduce((acc, record) => {
        (acc[record.week_id] = acc[record.week_id] || []).push(record);
        return acc;
    }, {});
    
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    
    return Object.entries(groupedByWeek).map(([weekId, records]) => {
      const userIdsInWeek = new Set(records.map(r => r.user_id));
      const peopleForWeek = Array.from(userIdsInWeek).map(id => profileMap.get(id)).filter(Boolean) as Profile[];

      const attendanceForWeek = records.reduce((acc, record) => {
          if (!acc[record.user_id]) acc[record.user_id] = {};
          acc[record.user_id][record.day] = {
              is_present: record.is_present,
              validated: record.validated
          };
          return acc;
      }, {});

      return {
        weekId,
        people: peopleForWeek,
        attendance: attendanceForWeek
      };
    }).sort((a, b) => b.weekId.localeCompare(a.weekId)); // Sort descending
  }, [allProfiles, historyAttendances]);

  // Pagination is now based on a fixed total number of weeks, not the fetched data length
  const totalPages = Math.ceil(TOTAL_HISTORY_WEEKS / WEEKS_PER_PAGE);

  const handleDeleteWeek = async () => {
    if (!deleteConfirm) return;
    const weekIdToDelete = deleteConfirm.weekId;
    setIsDeleting(weekIdToDelete);

    const { error } = await supabase
      .from('attendances')
      .delete()
      .eq('week_id', weekIdToDelete);

    if (error) {
      console.error('Failed to delete week records:', error);
      alert(`Falha ao remover registros: ${error.message}`);
    } else {
      setHistoryAttendances(prev => prev.filter(rec => rec.week_id !== weekIdToDelete));
    }
    
    setIsDeleting(null);
    setDeleteConfirm(null);
  };


const generatePdf = async (weekData: HistoryEntry) => {
  setLoadingWeek(weekData.weekId);
  try {
    const doc = new jsPDF();
    const { weekId, people, attendance } = weekData;
    const weekTitle = `Relatório de Presença - Semana de ${getReadableWeekRange(weekId)}`;
    doc.text(weekTitle, 14, 15);
    
    const weekDates = getDatesForWeekId(weekId);
    const formatDate = (date: Date) => `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;

    const tableColumn = ['Nome', ...DAYS_OF_WEEK.map((day, index) => `${day.substring(0,3)} (${formatDate(weekDates[index])})`)];
    const tableRows: (string | null)[][] = [];

    const sortedPeople = [...people].sort((a, b) => a.full_name.localeCompare(b.full_name));

    sortedPeople.forEach((person) => {
      const rowData = [
        person.full_name,
        ...DAYS_OF_WEEK.map((day) => {
          const status = attendance[person.id]?.[day];
          if (status?.is_present === true) {
              // Se validado, podemos marcar diferente no PDF ou manter como P
              return 'P'; 
          }
          if (status?.is_present === false) return 'X';
          return '-';
        }),
      ];
      tableRows.push(rowData);
    });

    const totalsRow = ['TOTAL'];
    DAYS_OF_WEEK.forEach((day) => {
      const presentCount = sortedPeople.filter((p) => attendance[p.id]?.[day]?.is_present === true).length;
      totalsRow.push(presentCount.toString());
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [totalsRow],
      startY: 25,
      theme: 'grid',
      headStyles: {
          fillColor: [13, 71, 161],
          textColor: 255,
      },
      footStyles: {
        fontStyle: 'bold',
        fillColor: [245, 245, 245],
        textColor: 20,
      },
      willDrawCell: (data: any) => {
        if ((data.section === 'body' || data.section === 'foot') && data.column.index > 0) {
          data.cell.styles.halign = 'center';
        }
        if (data.section === 'body' && data.column.index > 0 && (data.cell.raw === 'P' || data.cell.raw === 'X')) {
          data.cell.text = '';
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0) {
          const cell = data.cell;
          const x = cell.x + cell.width / 2;
          const y = cell.y + cell.height / 2;
          const size = Math.min(cell.width, cell.height) * 0.25;
          const lineWidth = 0.8;

          if (cell.raw === 'P') {
            doc.setLineWidth(lineWidth);
            doc.setDrawColor(46, 125, 50);
            doc.line(x - size * 0.8, y, x - size * 0.2, y + size * 0.6);
            doc.line(x - size * 0.2, y + size * 0.6, x + size, y - size * 0.8);
          } else if (cell.raw === 'X') {
            doc.setLineWidth(lineWidth);
            doc.setDrawColor(198, 40, 40);
            doc.line(x - size, y - size, x + size, y + size);
            doc.line(x + size, y - size, x - size, y + size);
          }
        }
      },
    });

    const fileName = `relatorio-presenca-${weekId}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBlob = doc.output('blob');
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];

          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
          });

          await Share.share({
            title: `Relatório de Presença - ${weekId}`,
            text: `Relatório de presença em PDF para a semana de ${getReadableWeekRange(weekId)}.`,
            url: result.uri,
            dialogTitle: 'Compartilhar Relatório',
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          if (errorMessage.toLowerCase().includes('share cancelled')) {
            console.log('Share was cancelled by user.');
            return;
          }
          console.error('Erro ao compartilhar PDF:', error);
          alert('Erro ao compartilhar PDF. Verifique as permissões.');
        } finally {
          setLoadingWeek(null);
        }
      };
      reader.onerror = (error) => {
          console.error('File Reader error:', error);
          alert('Erro ao ler o arquivo PDF para compartilhamento.');
          setLoadingWeek(null);
      };
    } else {
      doc.save(fileName);
      setLoadingWeek(null);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Falha ao gerar o PDF:', error);
    alert(`Ocorreu um erro ao gerar o PDF: ${errorMessage}`);
    setLoadingWeek(null);
  }
};

  if (isHistoryLoading) {
    return (
        <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-primary"></div>
        </div>
    );
  }

  if (historyData.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-gray-800 rounded-lg shadow">
        <p className="text-gray-400">Nenhum histórico para exibir nesta página.</p>
        <p className="text-gray-400 mt-2">
          Tente a página anterior ou verifique novamente mais tarde.
        </p>
      </div>
    );
  }
  
  const currentWeekId = getWeekId(new Date());

  return (
    <div className="flex flex-col gap-4">
      {historyData.map((entry) => {
        const isLoadingPdf = loadingWeek === entry.weekId;
        return (
          <details
            key={entry.weekId}
            className="bg-gray-800 rounded-lg shadow overflow-hidden"
            open={entry.weekId === currentWeekId && currentPage === 1}
          >
            <summary className="cursor-pointer p-4 font-semibold text-lg text-gray-200 flex justify-between items-center hover:bg-gray-700">
              <span className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span>Semana de {getReadableWeekRange(entry.weekId)}</span>
                <span className="text-xs text-gray-400 font-normal">({entry.weekId})</span>
                {entry.weekId === currentWeekId && (
                  <span className="text-sm font-normal text-brand-primary">(Atual)</span>
                )}
              </span>
               <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isLoadingPdf) generatePdf(entry);
                  }}
                  disabled={isLoadingPdf}
                  className={`flex items-center gap-2 font-bold py-1 px-3 rounded-md text-sm transition duration-300 ${
                    isLoadingPdf
                      ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                      : 'bg-brand-primary hover:bg-brand-secondary text-white'
                  }`}
                >
                  {isLoadingPdf ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <>
                      <PDFIcon /> Baixar PDF
                    </>
                  )}
                </button>

                 {isSuperAdmin && (
                  <div className="relative inline-block text-left actions-menu-container">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === entry.weekId ? null : entry.weekId);
                      }}
                      className="p-2 rounded-full text-gray-400 hover:bg-gray-600 focus:outline-none"
                      aria-label="Opções da semana"
                      >
                      <DotsVerticalIcon />
                    </button>
                    {openMenuId === entry.weekId && (
                      <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                        <div className="py-1" role="menu">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteConfirm(entry);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-600"
                            role="menuitem"
                          >
                            <TrashIcon />
                            Remover Registros
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </summary>
            <div className="border-t border-gray-700 p-4">
              <HistoryTable weekData={entry} />
            </div>
          </details>
        );
      })}
      <PaginationControls 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

       <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Confirmar Remoção"
        >
          <div className="mt-4">
            <p className="text-sm text-gray-400">
              Tem certeza que deseja remover permanentemente todos os registros de presença da semana de <strong>{deleteConfirm ? getReadableWeekRange(deleteConfirm.weekId) : ''}</strong>?
            </p>
            <p className="text-sm text-red-400 mt-2 font-semibold">
              Esta ação é irreversível e apagará os dados de todos os funcionários para este período.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} type="button" className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 border border-gray-500 rounded-md shadow-sm hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleDeleteWeek} type="button" className="px-4 py-2 text-sm font-medium text-white bg-status-absent border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-500" disabled={isDeleting === deleteConfirm?.weekId}>
                {isDeleting === deleteConfirm?.weekId ? 'Removendo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
};

export default HistoryView;