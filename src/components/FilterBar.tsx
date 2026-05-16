import { useState } from 'react';
import { Filter, RotateCcw, Settings2, LineChart, BarChart3, PieChart } from 'lucide-react';
import type { ChartsResponse, ChartFilter, ColumnProfile } from '../types';

interface Props {
  chartsData: ChartsResponse;
  onChange: (filters: ChartFilter) => void;
  disabled: boolean;
  columnProfiles?: ColumnProfile[];
}

export default function FilterBar({ chartsData, onChange, disabled, columnProfiles }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryField, setCategoryField] = useState('');
  const [categoryValue, setCategoryValue] = useState('');
  const [showFields, setShowFields] = useState(false);

  const [lineX, setLineX] = useState(''); const [lineY, setLineY] = useState('');
  const [barX, setBarX] = useState(''); const [barY, setBarY] = useState('');
  const [pieName, setPieName] = useState(''); const [pieVal, setPieVal] = useState('');

  const { summary } = chartsData;
  const catFields = summary.categorical_fields || [];
  const dateFields = summary.date_fields || [];
  const numFields = summary.numeric_fields || [];
  const profCols = (columnProfiles || []).map(c => c.col_name);
  const allFields = [...new Set([...dateFields, ...catFields, ...numFields, ...profCols])];

  const handleApply = () => {
    onChange({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      filters: categoryField && categoryValue ? { [categoryField]: categoryValue } : {},
      line_x: lineX || undefined,
      line_y: lineY || undefined,
      bar_x: barX || undefined,
      bar_y: barY || undefined,
      pie_name: pieName || undefined,
      pie_value: pieVal || undefined,
    });
  };

  const handleReset = () => {
    setDateFrom(''); setDateTo(''); setCategoryField(''); setCategoryValue('');
    setLineX(''); setLineY(''); setBarX(''); setBarY('');
    setPieName(''); setPieVal('');
    onChange({});
  };

  const Sel = ({ label, value, onChange, options, icon }: {
    label: string; value: string; onChange: (v: string) => void; options: string[]; icon?: string;
  }) => (
    <div className="flex items-center gap-1">
      <span className="text-xs text-stone-400 whitespace-nowrap">{icon || ''} {label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="px-1.5 py-0.5 text-xs border border-stone-300 rounded bg-white w-28" disabled={disabled}>
        <option value="">自动</option>
        {options.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  );

  return (
    <div className="shrink-0 bg-white border-b border-stone-200 px-6 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-stone-400" />
        {dateFields.length > 0 && (<>
          <label className="text-xs font-semibold text-stone-500">日期</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1 text-xs border border-stone-300 rounded-lg" disabled={disabled} />
          <span className="text-stone-300 text-xs">至</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1 text-xs border border-stone-300 rounded-lg" disabled={disabled} />
        </>)}
        {catFields.length > 0 && (<>
          <div className="w-px h-5 bg-stone-200" />
          <label className="text-xs font-semibold text-stone-500">分类</label>
          <select value={categoryField} onChange={e => { setCategoryField(e.target.value); setCategoryValue(''); }}
            className="px-2 py-1 text-xs border border-stone-300 rounded-lg bg-white" disabled={disabled}>
            <option value="">字段...</option>
            {catFields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {categoryField && <input type="text" value={categoryValue} onChange={e => setCategoryValue(e.target.value)}
            placeholder="值..." className="px-2 py-1 text-xs border border-stone-300 rounded-lg w-32" disabled={disabled} />}
        </>)}
        <div className="w-px h-5 bg-stone-200" />
        <button onClick={() => setShowFields(!showFields)}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg ${showFields ? 'bg-orange-100 text-orange-600' : 'text-stone-500 hover:bg-stone-100'}`}>
          <Settings2 size={12} />字段选择
        </button>
        <button onClick={handleApply} disabled={disabled}
          className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50">应用</button>
        <button onClick={handleReset} disabled={disabled}
          className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"><RotateCcw size={12} /></button>
        <div className="ml-auto text-xs text-stone-400">{summary.total_records} 条 · {summary.total_fields} 字段</div>
      </div>

      {showFields && (
        <div className="flex items-center gap-3 py-1 border-t border-stone-100 flex-wrap">
          <span className="text-xs font-semibold text-stone-500">图表字段:</span>
          <div className="w-px h-4 bg-stone-200" />
          <LineChart size={14} className="text-orange-400" />
          <Sel label="X:" value={lineX} onChange={setLineX} options={[...dateFields, ...catFields]} icon="" />
          <Sel label="Y:" value={lineY} onChange={setLineY} options={allFields} />
          <div className="w-px h-4 bg-stone-200" />
          <BarChart3 size={14} className="text-blue-400" />
          <Sel label="X:" value={barX} onChange={setBarX} options={allFields} />
          <Sel label="Y:" value={barY} onChange={setBarY} options={allFields} />
          <div className="w-px h-4 bg-stone-200" />
          <PieChart size={14} className="text-emerald-400" />
          <Sel label="名称:" value={pieName} onChange={setPieName} options={allFields} />
          <Sel label="值:" value={pieVal} onChange={setPieVal} options={allFields} />
        </div>
      )}
    </div>
  );
}
