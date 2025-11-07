import React, { useState } from 'react';
import { supabase } from '../supabase';
import { PredictionResult, DayKey } from '../types';
import { getReadableWeekRange } from '../utils';
import { ChartBarIcon } from './icons';
// FIX: Import GoogleGenAI and Type for Gemini API integration.
import { GoogleGenAI, Type } from '@google/genai';

const PredictiveAnalysisView: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);

    const getNextWeekId = (lastWeekId: string): string => {
        const [yearStr, weekStr] = lastWeekId.split('-W');
        let year = parseInt(yearStr, 10);
        let week = parseInt(weekStr, 10);
        if (week >= 52) { // Logic to handle year rollover
            const d = new Date(year, 11, 28); // Check last week of the year
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
            // 1. Fetch all historical attendance data
            const { data: allAttendances, error: fetchError } = await supabase
                .from('attendances')
                .select('week_id, day, is_present');

            if (fetchError) throw new Error(`Falha ao buscar dados históricos: ${fetchError.message}`);
            if (!allAttendances || allAttendances.length < 10) {
                 throw new Error("Não há dados históricos suficientes para gerar uma previsão confiável. Use o sistema por pelo menos algumas semanas.");
            }

            // 2. Pre-process data into a more concise format for the AI
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
            
            const lastWeekId = Object.keys(dailyCounts).reduce((latest, key) => key > latest ? key : latest, '').split(',')[0];
            const nextWeekId = getNextWeekId(lastWeekId);
                
            // FIX: Call Gemini AI instead of DeepSeek.
            if (!process.env.API_KEY) {
                throw new Error("A chave de API GEMINI_API_KEY não foi configurada. Verifique o arquivo .env e a configuração do Vite.");
            }
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const systemInstruction = `Você é um analista de dados especialista em otimização de recursos para refeitórios. Sua tarefa é analisar dados históricos de presença e prever a demanda futura. Você deve retornar sua análise estritamente no formato JSON, sem nenhum texto, formatação ou markdown adicional.`;

            const userPrompt = `
Contexto:
- Os dados a seguir mostram o total de pessoas presentes por dia em cada semana.
- O ID da semana está no formato 'ANO-WNUMERO'.
- A próxima semana para a qual você deve prever é a ${nextWeekId}.

Dados Históricos (formato CSV):
${csvData}

Com base nos dados, realize as seguintes tarefas:
1. Calcule a previsão de presenças para cada um dos 7 dias da semana ${nextWeekId}. O campo "day" no JSON deve ser o nome do dia em português ('Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo').
2. Forneça um insight acionável para o gerente, com no máximo 2 frases, para ajudar a otimizar o planejamento.
3. A resposta DEVE ser um objeto JSON com a seguinte estrutura: { "predictions": [{ "day": "NomeDoDia", "predicted_attendees": numero }, ...], "insight": "Seu insight aqui" }.
`;
            
            const responseSchema = {
              type: Type.OBJECT,
              properties: {
                predictions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      day: { type: Type.STRING },
                      predicted_attendees: { type: Type.INTEGER },
                    },
                    required: ['day', 'predicted_attendees'],
                  },
                },
                insight: {
                  type: Type.STRING,
                },
              },
              required: ['predictions', 'insight'],
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: userPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                    responseSchema,
                },
            });

            const responseText = response.text.trim();
            const parsedJson = JSON.parse(responseText);
            
            // Basic validation
            if (!parsedJson.predictions || !parsedJson.insight || parsedJson.predictions.length !== 7) {
                throw new Error("A resposta da IA está malformada ou incompleta.");
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
                        {prediction.predictions.map((p) => (
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
