import { motion } from 'motion/react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { type ComponentType, type ReactNode } from 'react';
import { Activity, ShieldCheck, Cpu } from 'lucide-react';
import type { ChartDataItem, ProcessResponse, SkippedChart } from '../types';

interface Props {
  scatterChart: ChartDataItem | null;
  heatmapChart: ChartDataItem | null;
  summary: {
    total_records: number; total_fields: number;
    numeric_fields: string[]; categorical_fields: string[]; date_fields: string[];
  };
  processResult: ProcessResponse | null;
  skippedCharts: SkippedChart[];
}

const COLORS = ['#f97316','#f59e0b','#84cc16','#10b981','#06b6d4','#6366f1','#a855f7','#ec4899'];

function InfoCard({ icon: Icon, title, children, color }: {
  icon: ComponentType<{ size?: number; className?: string }>; title: string; children: ReactNode; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3"><Icon size={16} className={color} /><h3 className="font-bold text-stone-700 text-sm">{title}</h3></div>
      {children}
    </motion.div>
  );
}

export default function Level3Micro({ scatterChart, heatmapChart, summary, processResult, skippedCharts }: Props) {
  // Use heatmap data for cross-analysis grouped bar chart
  const crossData = heatmapChart?.data || [];
  const hasCross = crossData.length > 0;
  const skippedReasons = skippedCharts || [];
  const totalFilled = processResult
    ? Object.values(processResult.fill_report).reduce((sum, r) => sum + (r.filled || 0), 0) : 0;
  const fillMethods = processResult
    ? [...new Set(Object.values(processResult.fill_report).map((r) => r.method))] : [];

  // Group heatmap data by x for stacked bar
  const groupedByX: Record<string, Record<string, number>> = {};
  for (const d of crossData as Record<string, unknown>[]) {
    const x = String(d.x || '');
    const y = String(d.y || '');
    const v = Number(d.value) || 0;
    if (!groupedByX[x]) groupedByX[x] = {};
    groupedByX[x][y] = v;
  }
  const allYKeys = [...new Set(crossData.map((d: Record<string, unknown>) => String(d.y || '')))];

  return (
    <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-4">
      {/* Cross-Analysis Bar Chart */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="col-span-2 row-span-2 bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Activity size={18} className="text-indigo-500" /><h3 className="font-bold text-stone-700 text-sm">交叉分组分析</h3></div>
        </div>
        <div className="flex-1">
          {hasCross ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(groupedByX).map(([x, yvals]) => ({ name: x, ...yvals }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716c' }} />
                <YAxis tick={{ fontSize: 10, fill: '#78716c' }} />
                <Tooltip />
                {allYKeys.slice(0, 6).map((yk, i) => (
                  <Bar key={yk} dataKey={yk} fill={COLORS[i % COLORS.length]} stackId="a" barSize={30} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">需要 2 个分类字段生成交叉分组图</div>
          )}
        </div>
      </motion.div>

      <InfoCard icon={ShieldCheck} title="数据契约" color="text-blue-500">
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-stone-500">总记录</span><span className="font-mono text-stone-700">{summary.total_records.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">数值字段</span><span className="font-mono text-stone-700">{summary.numeric_fields.join(', ') || '无'}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">日期字段</span><span className="font-mono text-stone-700">{summary.date_fields.join(', ') || '无'}</span></div>
          {skippedReasons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-stone-100">
              <p className="text-amber-600 font-medium">跳过的图表:</p>
              {skippedReasons.map((s, i) => <p key={i} className="text-stone-400 mt-1">{s.type}: {s.reason}</p>)}
            </div>
          )}
        </div>
      </InfoCard>

      <InfoCard icon={Cpu} title="预处理引擎" color="text-amber-500">
        <div className="space-y-2 text-xs">
          <div>
            <div className="flex justify-between mb-1"><span className="text-stone-500">缺失值填充</span><span className="font-semibold text-amber-600">{totalFilled} 个</span></div>
            {totalFilled > 0 && (
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (totalFilled / (summary.total_records * Math.max(1, summary.numeric_fields.length + summary.categorical_fields.length))) * 1000)}%` }} />
              </div>
            )}
          </div>
          <div className="flex justify-between"><span className="text-stone-500">填充方法</span><span className="text-stone-700">{fillMethods.join(', ') || '无'}</span></div>
          {processResult && (
            <div className="flex justify-between"><span className="text-stone-500">映射字段</span><span className="text-emerald-600 font-medium">{Object.keys(processResult.mapping_report).length} 个</span></div>
          )}
        </div>
      </InfoCard>

      <InfoCard icon={Activity} title="交叉统计" color="text-emerald-500">
        {hasCross ? (
          <div className="space-y-2">
            <p className="text-xs text-stone-600">{heatmapChart!.config.x_field as string} x {heatmapChart!.config.y_field as string}</p>
            <p className="text-xs text-stone-500">{crossData.length} 个交叉点</p>
            <p className="text-xs text-stone-400">指标: {heatmapChart!.config.value_field as string} (均值)</p>
          </div>
        ) : (
          <p className="text-xs text-stone-400">需要 2 个分类字段生成交叉分析</p>
        )}
        <div className="mt-3 pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-400">分类: {summary.categorical_fields.length} · 数值: {summary.numeric_fields.length}</p>
        </div>
      </InfoCard>
    </div>
  );
}
