import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { ChartDataItem } from '../types';

interface Props {
  barChart: ChartDataItem | null;
  pieChart: ChartDataItem | null;
  scatterChart: ChartDataItem | null;
  radarChart: ChartDataItem | null;
  summary: {
    total_records: number;
    numeric_fields: string[];
    categorical_fields: string[];
  };
}

const COLORS = ['#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];

export default function Level2Ranking({ barChart, pieChart, scatterChart, radarChart, summary }: Props) {
  const rankingData = barChart?.data || [];
  const distributionData = pieChart?.data || [];

  const hasCorrelation = scatterChart && scatterChart.data.length > 0;
  const corrX = scatterChart?.config.x_field as string || '';
  const corrY = scatterChart?.config.y_field as string || '';

  return (
    <div className="w-full h-full grid grid-cols-5 gap-4">
      {/* Left: Ranking Table (2 cols) */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-5 flex flex-col"
      >
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-bold text-stone-700 text-sm">
            {barChart?.title || '维度排名'}
          </h3>
        </div>
        {rankingData.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 text-stone-500 font-semibold">#</th>
                  <th className="text-left py-2 text-stone-500 font-semibold">
                    {barChart?.config.x_field as string || '类别'}
                  </th>
                  <th className="text-right py-2 text-stone-500 font-semibold">
                    {barChart?.config.y_field as string || '数值'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankingData.map((item, i) => {
                  const keys = Object.keys(item);
                  const labelKey = keys[0];
                  const valueKey = keys[1];
                  const value = Number(item[valueKey]) || 0;
                  const label = String(item[labelKey] ?? '');
                  return (
                    <tr
                      key={i}
                      className="border-b border-stone-50 hover:bg-orange-50/30 transition-colors"
                    >
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            i < 3
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2 font-medium text-stone-700 truncate max-w-[180px]">
                        {label}
                      </td>
                      <td className="py-2 text-right font-mono text-stone-600">
                        {value.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
            暂无排名数据 — 缺少分类或数值字段
          </div>
        )}
      </motion.div>

      {/* Right Panel: Distribution Chart + Correlation (3 cols) */}
      <div className="col-span-3 flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-5 flex flex-col"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-orange-500" />
            <h3 className="font-bold text-stone-700 text-sm">
              {pieChart?.title || '分布分析'}
            </h3>
          </div>
          <div className="flex-1">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionData as Record<string, unknown>[]}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis
                    type="category"
                    dataKey={pieChart?.config.name_field as string}
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #fed7aa',
                    }}
                  />
                  <Bar
                    dataKey={pieChart?.config.value_field as string}
                    radius={[0, 4, 4, 0]}
                  >
                    {distributionData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
                暂无分布数据
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            {hasCorrelation ? (
              <TrendingUp size={18} className="text-emerald-500" />
            ) : (
              <TrendingDown size={18} className="text-stone-400" />
            )}
            <h3 className="font-bold text-stone-700 text-sm">相关性分析</h3>
          </div>
          {hasCorrelation ? (
            <div>
              <p className="text-sm text-stone-600">
                <span className="font-semibold text-orange-600">{corrX}</span>
                {' '}vs{' '}
                <span className="font-semibold text-rose-600">{corrY}</span>
              </p>
              <p className="text-xs text-stone-400 mt-1">
                共 {scatterChart.data.length} 个数据点 · 访问 L3 查看散点图详情
              </p>
            </div>
          ) : (
            <p className="text-sm text-stone-400">
              需要至少 2 个数值字段来进行相关性分析
            </p>
          )}
          <div className="mt-3 flex gap-3 text-xs text-stone-500">
            <span>数值字段: {summary.numeric_fields.length} 个</span>
            <span>分类字段: {summary.categorical_fields.length} 个</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
