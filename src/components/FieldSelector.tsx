import { SlidersHorizontal, RotateCcw, Hash, Calendar, Type } from 'lucide-react';
import type { ColumnProfile } from '../types';

interface FieldConfig {
  x: string;
  y: string;
}

interface Props {
  chartType: string;
  chartTitle: string;
  currentFields: FieldConfig;
  allColumns: string[];
  columnProfiles: ColumnProfile[];
  onFieldsChange: (x: string, y: string) => void;
  onReset: () => void;
}

function getFieldIcon(colName: string, profiles: ColumnProfile[]) {
  const cp = profiles.find(p => p.col_name === colName);
  if (!cp) return <Type size={12} className="text-stone-400" />;
  const st = cp.semantic_type;
  if (st.includes('date') || st === 'datetime') return <Calendar size={12} className="text-cyan-500" />;
  if (['integer', 'float', 'numeric', 'currency_rmb', 'currency_usd', 'currency_eur', 'currency_general', 'percentage', 'number_with_separator'].includes(st))
    return <Hash size={12} className="text-amber-500" />;
  return <Type size={12} className="text-stone-400" />;
}

function getFieldTypeLabel(colName: string, profiles: ColumnProfile[]): string {
  const cp = profiles.find(p => p.col_name === colName);
  if (!cp) return '';
  return cp.semantic_type;
}

export default function FieldSelector({
  chartType, chartTitle, currentFields, allColumns, columnProfiles, onFieldsChange, onReset,
}: Props) {
  const xOptions = allColumns.filter(c => {
    if (chartType === 'scatter') return true; // scatter 的 X 也是数值
    const cp = columnProfiles.find(p => p.col_name === c);
    if (!cp) return true;
    const st = cp.semantic_type;
    return st.includes('date') || st.includes('text') || st.includes('province') ||
           st.includes('boolean') || st.includes('gender') || st === 'string';
  });

  const yOptions = allColumns.filter(c => {
    const cp = columnProfiles.find(p => p.col_name === c);
    if (!cp) return true;
    const st = cp.semantic_type;
    return ['integer', 'float', 'numeric', 'currency_rmb', 'currency_usd', 'currency_eur',
            'currency_general', 'percentage', 'number_with_separator'].includes(st);
  });

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-stone-500" />
          <span className="text-sm font-semibold text-stone-700">{chartTitle}</span>
          <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded">{chartType}</span>
        </div>
        <button onClick={onReset} className="flex items-center gap-1 text-xs text-stone-500 hover:text-amber-600">
          <RotateCcw size={12} /> 恢复推荐
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-stone-500 mb-1 block">X 轴字段</label>
          <select
            value={currentFields.x}
            onChange={(e) => onFieldsChange(e.target.value, currentFields.y)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-amber-400"
          >
            {xOptions.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 mt-1 text-xs text-stone-400">
            {getFieldIcon(currentFields.x, columnProfiles)}
            <span>{getFieldTypeLabel(currentFields.x, columnProfiles)}</span>
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-stone-500 mb-1 block">Y 轴字段</label>
          <select
            value={currentFields.y}
            onChange={(e) => onFieldsChange(currentFields.x, e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-amber-400"
          >
            {yOptions.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 mt-1 text-xs text-stone-400">
            {getFieldIcon(currentFields.y, columnProfiles)}
            <span>{getFieldTypeLabel(currentFields.y, columnProfiles)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
