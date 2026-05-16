import { motion } from 'motion/react';
import { useState, useMemo } from 'react';
import { Check, X, Info, ChevronLeft, Layers, Sparkles } from 'lucide-react';
import type { ColumnMappingSuggestion, MappingConfirmation as MappingConfirm, CleanResponse, ColumnProfile } from '../types';
import { confirmMapping as apiConfirmMapping } from '../api/client';

interface Props {
  fileId: string;
  domain: string;
  suggestions: ColumnMappingSuggestion[];
  columnProfiles: ColumnProfile[];
  onConfirm: (cleanResult: CleanResponse) => void;
  onSkip: () => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

export default function MappingConfirmation({
  fileId, domain, suggestions, columnProfiles,
  onConfirm, onSkip, onBack, onError,
}: Props) {
  const [confirmations, setConfirmations] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    for (const s of suggestions) {
      // 自动选择得分 > 0.7 的第一个候选
      const top = s.candidates[0];
      init[s.original_col] = top && top.score > 0.7 ? top.standard_field : null;
    }
    return init;
  });
  const [selectedCol, setSelectedCol] = useState<string | null>(
    suggestions.length > 0 ? suggestions[0].original_col : null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanResult, setCleanResult] = useState<CleanResponse | null>(null);

  const profileMap = useMemo(() => {
    const m: Record<string, ColumnProfile> = {};
    for (const cp of columnProfiles) m[cp.col_name] = cp;
    return m;
  }, [columnProfiles]);

  const mappedCount = Object.values(confirmations).filter(v => v !== null).length;
  const totalCount = suggestions.length;

  const suggestionMap = useMemo(() => {
    const m: Record<string, ColumnMappingSuggestion> = {};
    for (const s of suggestions) m[s.original_col] = s;
    return m;
  }, [suggestions]);

  const handleSelectCandidate = (col: string, standardField: string | null) => {
    setConfirmations(prev => ({ ...prev, [col]: standardField }));
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const confirms: MappingConfirm[] = Object.entries(confirmations).map(([col, mappedTo]) => ({
        original_col: col,
        mapped_to: mappedTo as string | null,
      }));
      const result = await apiConfirmMapping(fileId, domain, confirms);
      setCleanResult(result);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '映射确认失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToDashboard = () => {
    if (cleanResult) onConfirm(cleanResult);
  };

  const selectedSuggestion = selectedCol ? suggestionMap[selectedCol] : null;
  const selectedProfile = selectedCol ? profileMap[selectedCol] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4"
    >
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">字段映射确认</h1>
          <p className="text-sm text-stone-500">确认系统建议的字段映射，或手动调整</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg border border-stone-300 hover:bg-stone-50">
            <ChevronLeft size={16} className="inline mr-1" />返回剖析
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-600"
          >
            跳过映射（全部通用清洗）
          </button>
        </div>
      </div>

      {/* 两栏布局 */}
      {!cleanResult ? (
        <div className="flex gap-4">
          {/* 左栏：原始列列表 */}
          <div className="w-1/3 bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold text-sm text-stone-700">
              原始字段 ({totalCount})
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {suggestions.map((s) => {
                const mapped = confirmations[s.original_col];
                const isSelected = selectedCol === s.original_col;
                const profile = profileMap[s.original_col];
                return (
                  <button
                    key={s.original_col}
                    onClick={() => setSelectedCol(s.original_col)}
                    className={`w-full px-4 py-3 text-left border-b last:border-b-0 transition-colors ${
                      isSelected ? 'bg-amber-50 border-l-2 border-l-amber-400' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-stone-700">{s.original_col}</span>
                      {mapped ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{mapped}</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">未映射</span>
                      )}
                    </div>
                    {profile && (
                      <span className="text-xs text-stone-400">{profile.semantic_type}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t bg-stone-50 text-xs text-stone-500">
              已映射 {mappedCount} / {totalCount} 列
            </div>
          </div>

          {/* 右栏：详情 */}
          <div className="w-2/3 bg-white rounded-xl border p-4">
            {selectedSuggestion && selectedProfile ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-stone-700">{selectedSuggestion.original_col}</h3>
                  <p className="text-sm text-stone-500">
                    语义类型: {selectedProfile.semantic_type} ·
                    基数: {selectedProfile.cardinality_ratio.toFixed(2)} ·
                    空值率: {(selectedProfile.null_rate * 100).toFixed(1)}%
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-stone-600 mb-2">映射建议</h4>
                  <div className="space-y-2">
                    {selectedSuggestion.candidates.map((c, i) => (
                      <label
                        key={c.standard_field}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          confirmations[selectedSuggestion.original_col] === c.standard_field
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`map-${selectedSuggestion.original_col}`}
                          checked={confirmations[selectedSuggestion.original_col] === c.standard_field}
                          onChange={() => handleSelectCandidate(selectedSuggestion.original_col, c.standard_field)}
                          className="accent-amber-500"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-sm text-stone-700">{c.standard_field}</span>
                          <span className="ml-2 text-xs text-stone-400">得分: {Math.round(c.score * 100)}%</span>
                          <p className="text-xs text-stone-500">{c.reason}</p>
                        </div>
                        {c.score >= 0.8 && <Sparkles size={14} className="text-amber-400" />}
                      </label>
                    ))}
                  </div>

                  <label className={`flex items-center gap-3 px-3 py-2 mt-2 rounded-lg border cursor-pointer transition-colors ${
                    confirmations[selectedSuggestion.original_col] === null
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name={`map-${selectedSuggestion.original_col}`}
                      checked={confirmations[selectedSuggestion.original_col] === null}
                      onChange={() => handleSelectCandidate(selectedSuggestion.original_col, null)}
                      className="accent-gray-400"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-sm text-stone-500">标记为未映射</span>
                      <p className="text-xs text-stone-400">进入通用字段池，仍参与全部清洗和可视化</p>
                    </div>
                  </label>
                </div>

                {selectedSuggestion.candidates.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <Info size={14} />
                    此列无匹配的标准字段，将进入通用字段池（仍参与清洗和可视化）
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-stone-400">
                <Info size={40} className="mx-auto mb-2" />
                <p>请从左侧选择一个列查看映射详情</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 清洗结果展示 */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <Check size={20} className="text-green-600" />
            <div>
              <div className="font-semibold text-green-800">清洗完成</div>
              <div className="text-sm text-green-600">
                从 {cleanResult.summary.rows_before as number} 行清洗至 {cleanResult.summary.rows_after as number} 行
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {cleanResult.layer_reports.map((lr, i) => (
              <div key={i} className="bg-white rounded-xl border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers size={14} className="text-stone-500" />
                  <span className="text-xs font-semibold text-stone-600">{lr.layer}</span>
                </div>
                <div className="text-lg font-bold text-stone-700">
                  {lr.rows_before} → {lr.rows_after}
                </div>
                <div className="text-xs text-stone-500">
                  {lr.columns_affected} 列受影响
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold text-sm text-stone-700">清洗后预览</div>
            <div className="max-h-80 overflow-auto px-4 pb-3">
              <table className="w-full text-sm border">
                <thead className="bg-stone-50">
                  <tr>
                    {cleanResult.columns.map((c, i) => (
                      <th key={i} className="text-left px-3 py-2 text-stone-600 font-medium border-r whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cleanResult.preview_rows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {cleanResult.columns.map((c, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-stone-600 border-r whitespace-nowrap max-w-[150px] truncate">
                          {String(row[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* 底部操作栏 */}
      {!cleanResult ? (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-8 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-semibold text-sm disabled:opacity-50"
          >
            {isProcessing ? '处理中...' : `确认并处理 (${mappedCount}/${totalCount} 已映射)`}
          </button>
        </div>
      ) : (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleProceedToDashboard}
            className="px-8 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-semibold text-sm"
          >
            进入可视化仪表盘 →
          </button>
        </div>
      )}
    </motion.div>
  );
}
