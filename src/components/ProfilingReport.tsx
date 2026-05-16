import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info, Table, BarChart3, X } from 'lucide-react';
import { useState } from 'react';
import type { ProfileResponse } from '../types';

interface Props {
  profileData: ProfileResponse;
  fileName: string;
  domain: string;
  onProceedToMapping: () => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

const SEMANTIC_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700',
  phone_cn_mobile: 'bg-green-100 text-green-700',
  phone_cn_landline: 'bg-green-100 text-green-700',
  phone_general: 'bg-green-100 text-green-700',
  url: 'bg-purple-100 text-purple-700',
  currency_rmb: 'bg-amber-100 text-amber-700',
  currency_usd: 'bg-amber-100 text-amber-700',
  currency_eur: 'bg-amber-100 text-amber-700',
  currency_general: 'bg-amber-100 text-amber-700',
  percentage: 'bg-orange-100 text-orange-700',
  date_iso: 'bg-cyan-100 text-cyan-700',
  date_slash: 'bg-cyan-100 text-cyan-700',
  date_dot: 'bg-cyan-100 text-cyan-700',
  date_cn: 'bg-cyan-100 text-cyan-700',
  datetime_iso: 'bg-cyan-100 text-cyan-700',
  datetime: 'bg-cyan-100 text-cyan-700',
  boolean_cn: 'bg-teal-100 text-teal-700',
  boolean_en: 'bg-teal-100 text-teal-700',
  id_number_cn: 'bg-rose-100 text-rose-700',
  uuid: 'bg-rose-100 text-rose-700',
  ip_address_v4: 'bg-indigo-100 text-indigo-700',
  province_cn: 'bg-lime-100 text-lime-700',
  gender_label: 'bg-pink-100 text-pink-700',
  longitude: 'bg-sky-100 text-sky-700',
  latitude: 'bg-sky-100 text-sky-700',
  integer: 'bg-gray-100 text-gray-700',
  float: 'bg-gray-100 text-gray-700',
  numeric: 'bg-gray-100 text-gray-700',
};

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function getHealthBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

export default function ProfilingReport({ profileData, fileName, domain, onProceedToMapping, onBack, onError }: Props) {
  const [showSuspicious, setShowSuspicious] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { columns, health, preview_rows } = profileData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto px-4 py-6 space-y-5"
    >
      {/* 顶部栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">智能数据剖析</h1>
          <p className="text-sm text-stone-500">{fileName} · {domain}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg border border-stone-300 hover:bg-stone-50">返回</button>
          <button onClick={onProceedToMapping} className="px-5 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-medium">进入字段映射 →</button>
        </div>
      </div>

      {/* 健康评分卡 */}
      <div className={`rounded-2xl border p-6 ${getHealthBg(health.health_score)}`}>
        <div className="flex items-center gap-4">
          <div className={`text-5xl font-bold ${getHealthColor(health.health_score)}`}>
            {health.health_score}
          </div>
          <div>
            <div className="text-lg font-semibold text-stone-700">数据健康评分</div>
            <div className="text-sm text-stone-500">
              {health.health_score >= 80 ? '数据质量良好，可直接进入下一步' :
               health.health_score >= 50 ? '数据存在一些问题，建议关注可疑列' :
               '数据质量问题较多，建议仔细检查后再处理'}
            </div>
          </div>
          {health.health_score >= 80 ? <CheckCircle className="text-green-500 ml-auto" size={28} /> :
           health.health_score >= 50 ? <AlertTriangle className="text-amber-500 ml-auto" size={28} /> :
           <X className="text-red-500 ml-auto" size={28} />}
        </div>
      </div>

      {/* 质量指标卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-stone-700">{health.total_rows.toLocaleString()}</div>
          <div className="text-xs text-stone-500 mt-1">总行数</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-stone-700">{health.total_columns}</div>
          <div className="text-xs text-stone-500 mt-1">总列数</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-stone-700">{(health.total_missing_rate * 100).toFixed(1)}%</div>
          <div className="text-xs text-stone-500 mt-1">缺失率</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-stone-700">{(health.duplicate_row_rate * 100).toFixed(1)}%</div>
          <div className="text-xs text-stone-500 mt-1">重复行率</div>
        </div>
      </div>

      {/* 列剖析表格 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <BarChart3 size={16} className="text-stone-500" />
          <span className="font-semibold text-sm text-stone-700">列剖析详情 ({columns.length} 列)</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-stone-600 font-medium">列名</th>
                <th className="text-left px-4 py-2 text-stone-600 font-medium">语义类型</th>
                <th className="text-right px-4 py-2 text-stone-600 font-medium">置信度</th>
                <th className="text-right px-4 py-2 text-stone-600 font-medium">空值</th>
                <th className="text-right px-4 py-2 text-stone-600 font-medium">唯一值</th>
                <th className="text-right px-4 py-2 text-stone-600 font-medium">基数率</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => (
                <tr key={i} className="border-t hover:bg-stone-50">
                  <td className="px-4 py-2 font-medium text-stone-700">
                    {col.col_name}
                    {col.is_constant && <AlertTriangle size={14} className="inline ml-1 text-amber-500" title="常量列" />}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEMANTIC_COLORS[col.semantic_type] || 'bg-gray-100 text-gray-600'}`}>
                      {col.semantic_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600">{Math.round(col.semantic_confidence * 100)}%</td>
                  <td className="px-4 py-2 text-right text-stone-600">{col.null_count}</td>
                  <td className="px-4 py-2 text-right text-stone-600">{col.unique_count}</td>
                  <td className="px-4 py-2 text-right text-stone-600">{col.cardinality_ratio.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 可疑列面板 */}
      {health.suspicious_columns.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <button
            onClick={() => setShowSuspicious(!showSuspicious)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <span className="font-semibold text-sm text-stone-700">
                可疑列警告 ({health.suspicious_columns.length})
              </span>
            </div>
            {showSuspicious ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <AnimatePresence>
            {showSuspicious && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-4 pb-3 space-y-2">
                  {health.suspicious_columns.map((s, i) => (
                    <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${s.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.severity === 'error' ? <X size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                      <span><strong>{s.col_name}</strong>: {s.issue}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 数据预览 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50"
        >
          <div className="flex items-center gap-2">
            <Table size={16} className="text-stone-500" />
            <span className="font-semibold text-sm text-stone-700">数据预览 (前 20 行)</span>
          </div>
          {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <AnimatePresence>
          {showPreview && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="max-h-96 overflow-auto px-4 pb-3">
                <table className="w-full text-sm border">
                  <thead className="bg-stone-50">
                    <tr>
                      {columns.map((c, i) => (
                        <th key={i} className="text-left px-3 py-2 text-stone-600 font-medium border-r whitespace-nowrap">{c.col_name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview_rows.slice(0, 20).map((row, ri) => (
                      <tr key={ri} className="border-t">
                        {columns.map((c, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-stone-600 border-r whitespace-nowrap max-w-[200px] truncate">
                            {String(row[c.col_name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
