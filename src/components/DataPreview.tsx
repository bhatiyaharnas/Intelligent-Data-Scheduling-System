import { useState } from 'react';
import { ArrowLeft, Play, BarChart3, Check, AlertCircle, Brain, Sparkles, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { aiClean } from '../api/client';
import type { UploadResponse, ProcessResponse, AIConfig, AICleanResponse } from '../types';

interface Props {
  previewData: UploadResponse;
  fileName: string;
  domain: string;
  processResult: ProcessResponse | null;
  processedFileId: string | null;
  fileId: string | null;
  aiConfig: AIConfig | null;
  onProcess: (domainId: string, useCleanedFileId?: string) => void;
  onGenerateDashboard: () => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

export default function DataPreview({
  previewData, fileName, domain, processResult, processedFileId,
  fileId, aiConfig,
  onProcess, onGenerateDashboard, onBack, onError,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiCleaning, setAICleaning] = useState(false);
  const [aiCleanResult, setAICleanResult] = useState<AICleanResponse | null>(null);
  const [useCleaned, setUseCleaned] = useState(false);
  const [cleanedFileId, setCleanedFileId] = useState<string | null>(null);

  const cols = previewData.columns;
  const rows = previewData.preview_rows;
  const mappedCount = processResult?.summary.mapped_fields || 0;
  const totalCols = cols.length;
  const mappingRate = totalCols > 0 ? (mappedCount / totalCols) * 100 : 0;
  const lowMapping = processResult && mappingRate < 50;

  const domainNames: Record<string, string> = {
    general: '通用数据', finance: '金融财务', ecommerce: '电商零售',
    logistics: '物流运输', healthcare: '医疗健康',
  };

  const handleProcess = async () => {
    if (!domain) { onError('请先选择数据领域'); return; }
    setProcessing(true);
    try {
      onProcess(domain, useCleaned ? (cleanedFileId || undefined) : undefined);
    } finally { setProcessing(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try { onGenerateDashboard(); } finally { setGenerating(false); }
  };

  const handleAIClean = async () => {
    if (!fileId || !aiConfig) return;
    setAICleaning(true);
    setAICleanResult(null);
    try {
      const res = await aiClean(fileId, aiConfig);
      setAICleanResult(res);
      if (res.success && res.cleaned_file_id) {
        setCleanedFileId(res.cleaned_file_id);
      }
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'AI清洗失败');
    } finally { setAICleaning(false); }
  };

  const displayCols = useCleaned && aiCleanResult ? aiCleanResult.columns : cols;
  const displayRows = useCleaned && aiCleanResult ? aiCleanResult.preview_rows : rows;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-4 bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(251,146,60,0.15)] border border-orange-100 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full text-stone-500"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="font-bold text-lg text-stone-800">数据预览</h2>
            <p className="text-xs text-stone-500">{fileName} · {domainNames[domain] || domain}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {aiConfig && !processResult && (
            <button onClick={handleAIClean} disabled={aiCleaning}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-violet-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50">
              {aiCleaning ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Brain size={16} />}
              AI 智能清洗
            </button>
          )}
          {!processResult && (
            <button onClick={handleProcess} disabled={processing}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-50">
              {processing ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Play size={16} fill="currentColor" />}
              开始处理
            </button>
          )}
          {processResult && (
            <button onClick={handleGenerate} disabled={generating}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50">
              {generating ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <BarChart3 size={16} />}
              生成仪表盘
            </button>
          )}
        </div>
      </div>

      {/* AI Clean Result */}
      {aiCleanResult && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-3">
          {aiCleanResult.success ? (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-500" />
                  <span className="font-semibold text-purple-700 text-sm">AI 清洗完成</span>
                  <span className="text-xs text-purple-500">（{aiCleanResult.summary.attempts} 次尝试）</span>
                </div>
                <div className="flex gap-2">
                  {!useCleaned ? (
                    <button onClick={() => setUseCleaned(true)}
                      className="px-4 py-1.5 bg-purple-500 text-white text-xs font-semibold rounded-lg hover:bg-purple-600">
                      使用清洗结果
                    </button>
                  ) : (
                    <button onClick={() => setUseCleaned(false)}
                      className="px-4 py-1.5 bg-stone-200 text-stone-600 text-xs font-semibold rounded-lg hover:bg-stone-300 flex items-center gap-1">
                      <X size={12} /> 恢复原始数据
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                <div className="bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-stone-500">原始行数</p>
                  <p className="font-bold text-stone-700">{aiCleanResult.summary.original_rows}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-stone-500">清洗后行数</p>
                  <p className="font-bold text-emerald-600">{aiCleanResult.summary.cleaned_rows}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-stone-500">移除行数</p>
                  <p className="font-bold text-rose-600">{aiCleanResult.summary.rows_removed}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 text-center">
                  <p className="text-stone-500">列数</p>
                  <p className="font-bold text-stone-700">{aiCleanResult.summary.original_cols} → {aiCleanResult.summary.cleaned_cols}</p>
                </div>
              </div>
              {useCleaned && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                  <ShieldCheck size={14} /> 已选择AI清洗结果，点击"开始处理"将使用清洗后的数据
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                <span className="font-semibold text-red-700 text-sm">AI 清洗失败</span>
              </div>
              <p className="text-xs text-red-600 mt-1">{aiCleanResult.error}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="px-6 py-4 grid grid-cols-4 gap-3">
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{previewData.row_count}</p>
          <p className="text-xs text-stone-500">总行数</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{displayCols.length}</p>
          <p className="text-xs text-stone-500">总列数</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-rose-600">{processResult ? mappedCount : '-'}</p>
          <p className="text-xs text-stone-500">已映射字段</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{processResult ? processResult.summary.numeric_fields.length : '-'}</p>
          <p className="text-xs text-stone-500">数值字段</p>
        </div>
      </div>

      {/* Preview Table */}
      <div className="px-6 pb-4 max-h-64 overflow-auto">
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-100">
                <th className="px-3 py-2 text-left text-xs font-semibold text-stone-600 border-r border-stone-200">#</th>
                {displayCols.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-stone-600 border-r border-stone-200 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-t border-stone-100 hover:bg-orange-50/30">
                  <td className="px-3 py-1.5 text-xs text-stone-400 border-r border-stone-100">{i + 1}</td>
                  {displayCols.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-xs text-stone-700 border-r border-stone-100 max-w-[200px] truncate">{String(row[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Result */}
      {processResult && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-6 pb-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2"><Check size={16} className="text-emerald-500" />字段映射报告</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(processResult.mapping_report).map(([std, orig]) => (
                <div key={std} className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-stone-400">{orig}</span><span className="text-emerald-500">&rarr;</span><span className="font-semibold text-emerald-700">{std}</span>
                </div>
              ))}
            </div>
            {Object.keys(processResult.mapping_report).length === 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={14} />未能映射任何字段</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-2">缺失值填充报告</h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(processResult.fill_report).map(([field, report]) => (
                <div key={field} className="bg-amber-50 rounded-lg px-3 py-2 text-xs">
                  <p className="font-semibold text-stone-700">{field}</p>
                  <p className="text-stone-500">填充 {report.filled} 个 · {report.method}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
