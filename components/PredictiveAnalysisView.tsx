import React, { useState } from 'react';
import { supabase } from '../supabase';
import { PredictionResult } from '../types';
import { getReadableWeekRange } from '../utils';
import { ChartBarIcon } from './icons';

const PredictiveAnalysisView: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);

    const getNextWeekId = (lastWeekId: string): string => {
        if (!lastWeekId) {
            const today = new Date();
            const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            d.setUTCDate(d.getUTCDate() + 7); // Move to next week
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
            return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
        }

        const [yearStr, weekStr] = lastWeekId.split('-W');
        let year = parseInt(yearStr, 10);
        let week = parseInt(weekStr, 10);
        
        if (week >= 52) { 
            const d = new Date(year, 11, 28); 
            const yearEndWeek = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            yearEndWeek.setUTCDate(yearEndWeek.getUTCDate() + 4 - (yearEndWeek.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(yearEndWeek.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((yearEndWeek.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
            
            if(week >= weekNo) {
              week = 1;
              year += 1;
            } else {
              week += 1;
            }
        } else {
            week += 1;
        }
        return `${year}-W${String(week).padStart(2, '0')}`;
    };

    const handleGeneratePrediction = async () => {
        setLoading(true);
        setError(null);
        setPrediction(null);

        try {
            const { data: allAttendances, error: fetchError } = await supabase
                .from('attendances')
                .select('week_id, day, is_present');

            if (fetchError) throw new Error(`Falha ao buscar dados históricos: ${fetchError.message}`);
            if (!allAttendances || allAttendances.length < 10) {
                 throw new Error("Não há dados históricos suficientes para gerar uma previsão confiável. Use o sistema por pelo menos algumas semanas.");
            }

            const dailyCounts: Record<string, number> = allAttendances.reduce((acc, record) => {
                if (record.is_present) {
                    const key = `${record.week_id},${record.day}`;
                    acc[key] = (acc[key] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const csvData = "semana,dia,presentes\n" + Object.entries(dailyCounts)
                .map(([key, count]) => `${key},${count}`)
                .join('\n');
            
            const lastWeekId = Object.keys(dailyCounts).reduce((latest, key) => (key > latest ? key : latest), '').split(',')[0];
            const nextWeekId = getNextWeekId(lastWeekId);
                
            // Chamar a Edge Function segura em vez da API Gemini diretamente
            const { data, error: functionError } = await supabase.functions.invoke('generate-prediction', {
                body: { csvData, nextWeekId },
            });

            if (functionError) {
                // Tenta extrair a mensagem de erro específica da função
                const errorMessage = functionError.context?.error?.message || functionError.message;
                throw new Error(`Erro na função de IA: ${errorMessage}`);
            }

            // A função agora retorna o JSON diretamente
            const parsedJson = data;
            
            if (!parsedJson.predictions || !parsedJson.insight || parsedJson.predictions.length !== 7) {
                console.error("Malformed AI response:", parsedJson);
                throw new Error("A resposta da IA está malformada ou incompleta. Tente novamente.");
            }

            setPrediction({ ...parsedJson, nextWeekId });

        } catch (err: any) {
            console.error("Prediction Error:", err);
            setError(err.message || "Ocorreu um erro desconhecido ao gerar a previsão.");
        } finally {
            setLoading(false);
        }
    };
    
    const renderContent = () => {
        if (loading) {
            return (
                 <div className="text-center py-10 px-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-primary mx-auto"></div>
                    <p className="text-gray-300 mt-4 text-lg">Analisando dados históricos com IA...</p>
                    <p className="text-gray-500 mt-2">Isso pode levar alguns segundos.</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center py-10 px-4 bg-red-900/50 text-red-300 rounded-lg shadow">
                    <h3 className="font-bold text-lg mb-2">Erro na Análise</h3>
                    <p>{error}</p>
                </div>
            );
        }

        if (prediction) {
            return (
                <div className="bg-gray-800 rounded-lg shadow p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-white mb-1">
                        Previsão para a Semana de {getReadableWeekRange(prediction.nextWeekId)}
                    </h2>
                    <p className="text-gray-400 mb-6">({prediction.nextWeekId})</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                        {prediction.predictions.sort((a, b) => {
                            const order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
                            return order.indexOf(a.day) - order.indexOf(b.day);
                        }).map((p) => (
                            <div key={p.day} className="bg-gray-700 rounded-lg p-4 text-center">
                                <p className="font-semibold text-gray-300">{p.day}</p>
                                <p className="text-4xl font-bold text-brand-primary mt-2">{p.predicted_attendees}</p>
                                <p className="text-xs text-gray-500">presentes</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-700/50 border-l-4 border-brand-accent p-4 rounded-r-lg">
                        <h3 className="font-bold text-lg text-gray-200">Insight da IA</h3>
                        <p className="text-gray-300 mt-2">{prediction.insight}</p>
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center mt-6">
                        Esta é uma previsão gerada por IA com base em dados históricos e pode não ser 100% precisa.
                    </p>
                </div>
            );
        }

        return (
            <div className="text-center bg-gray-800 rounded-lg shadow p-8">
                <ChartBarIcon />
                <h2 className="text-2xl font-bold text-white mt-4">Análise Preditiva de Presença</h2>
                <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
                    Utilize a inteligência artificial para analisar o histórico de presenças e gerar uma previsão para a próxima semana. Ajude a otimizar o planejamento de refeições e reduzir o desperdício.
                </p>
                <button
                    onClick={handleGeneratePrediction}
                    disabled={loading}
                    className="mt-6 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition duration-300 disabled:bg-gray-600 inline-flex items-center gap-2"
                >
                    Gerar Previsão
                </button>
            </div>
        );
    };

    return (
        <div>
            {renderContent()}
        </div>
    );
};

export default PredictiveAnalysisView;