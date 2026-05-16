import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, ArrowUpDown, Table2 } from 'lucide-react';
import type { ChartDataItem } from '../types';

interface Props {
  tableChart: ChartDataItem | null;
  summary: { total_records: number; total_fields: number };
}

export default function Level4Table({ tableChart, summary }: Props) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const rawData = (tableChart?.data || []) as Record<string, unknown>[];
  const columns = (tableChart?.config?.columns as string[]) || [];

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let data = [...rawData];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
      );
    }
    if (sortCol) {
      data.sort((a, b) => {
        const va = a[sortCol];
        const vb = b[sortCol];
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          return sortDir === 'asc' ? na - nb : nb - na;
        }
        const cmp = String(va ?? '').localeCompare(String(vb ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [rawData, search, sortCol, sortDir]);

  if (!tableChart || rawData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-3">
        <Table2 size={48} />
        <p className="text-sm font-medium">数据明细暂不可用</p>
        <p className="text-xs text-stone-300">请确认后端服务已更新并重启（需要新版 chart_engine）</p>
        <p className="text-xs text-stone-300">新版后端会自动生成 table 类型图表数据</p>
      </div>
    );
  }

  const displayCols = columns.length > 10 ? columns.slice(0, 10) : columns;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Table2 size={18} className="text-blue-500" />
          <h3 className="font-bold text-stone-700 text-sm">数据明细</h3>
          <span className="text-xs text-stone-400">
            总 {summary.total_records} 条 · 显示 {rawData.length} 行 · {columns.length} 列
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 w-48"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-stone-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-stone-100">
              <th className="px-3 py-2 text-left text-stone-500 font-semibold border-r border-stone-200 w-10">#</th>
              {displayCols.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-2 text-left text-stone-500 font-semibold border-r border-stone-200 cursor-pointer hover:bg-stone-200/50 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    {col}
                    <ArrowUpDown size={10} className={sortCol === col ? 'text-orange-500' : 'text-stone-300'} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map((row, i) => (
              <tr key={i} className="border-t border-stone-100 hover:bg-orange-50/30">
                <td className="px-3 py-1.5 text-stone-400 border-r border-stone-100">{i + 1}</td>
                {displayCols.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-stone-700 border-r border-stone-100 max-w-[200px] truncate">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
