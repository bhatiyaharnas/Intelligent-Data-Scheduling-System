import { type ComponentType } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ChartDataItem, ProcessResponse } from '../types';

interface Props {
  lineChart: ChartDataItem | null;
  barChart: ChartDataItem | null;
  treemapChart: ChartDataItem | null;
  summary: {
    total_records: number;
    total_fields: number;
    numeric_fields: string[];
    categorical_fields: string[];
    date_fields: string[];
  };
  processResult: ProcessResponse | null;
  domain: string;
}

const domainNames: Record<string, string> = {
  finance: '金融财务',
  ecommerce: '电商零售',
  logistics: '物流运输',
  healthcare: '医疗健康',
};

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-stone-200/60 shadow-sm"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-500">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
    </motion.div>
  );
}

export default function Level1Overview({
  lineChart,
  barChart,
  treemapChart,
  summary,
  processResult,
  domain,
}: Props) {
  const totalFilled = processResult
    ? Object.values(processResult.fill_report).reduce((sum, r) => sum + (r.filled || 0), 0)
    : 0;

  const mappedCount = processResult?.summary.mapped_fields || 0;
  const dataQuality = summary.total_fields > 0
    ? Math.round((mappedCount / summary.total_fields) * 100)
    : 0;

  return (
    <div className="w-full h-full grid grid-cols-4 grid-rows-5 gap-4">
      {/* Metric Cards Row */}
      <MetricCard
        label="总记录数"
        value={summary.total_records.toLocaleString()}
        sub={`${summary.total_fields} 个字段`}
        icon={Database}
        color="text-blue-500"
      />
      <MetricCard
        label="数值字段"
        value={summary.numeric_fields.length}
        sub={summary.numeric_fields.slice(0, 3).join(', ') || '无'}
        icon={TrendingUp}
        color="text-emerald-500"
      />
      <MetricCard
        label="数据质量"
        value={`${dataQuality}%`}
        sub={`${mappedCount} 个字段已映射`}
        icon={CheckCircle2}
        color="text-orange-500"
      />
      <MetricCard
        label="缺失值填充"
        value={totalFilled}
        sub="自动插补处理"
        icon={AlertTriangle}
        color="text-amber-500"
      />

      {/* Main Chart Area - Line Chart (spans 3 cols) */}
      <div className="col-span-3 row-span-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-stone-700 text-sm">
            {lineChart?.title || '数据趋势'}
          </h3>
          <span className="text-xs text-stone-400">
            {domainNames[domain] || domain} · 聚合概览
          </span>
        </div>
        <div className="flex-1">
          {lineChart && lineChart.data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineChart.data as Record<string, unknown>[]}>
                <defs>
                  <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey={lineChart.config.x_field as string}
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #fed7aa',
                    boxShadow: '0 4px 12px rgba(251,146,60,0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={lineChart.config.y_field as string}
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#colorLine)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : barChart && barChart.data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChart.data as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey={barChart.config.x_field as string}
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #fed7aa',
                  }}
                />
                <Bar
                  dataKey={barChart.config.y_field as string}
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
              暂无适用的趋势图表 — 数据中缺少日期或数值字段
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Domain Info & Data Quality */}
      <div className="row-span-4 flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-4 flex-1"
        >
          <h3 className="font-bold text-stone-700 text-sm mb-3">领域信息</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-stone-400">当前领域</p>
              <p className="text-sm font-semibold text-stone-700">{domainNames[domain] || domain}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">分类字段</p>
              <p className="text-xs text-stone-600">
                {summary.categorical_fields.length > 0
                  ? summary.categorical_fields.join(', ')
                  : '无分类字段'}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400">日期字段</p>
              <p className="text-xs text-stone-600">
                {summary.date_fields.length > 0
                  ? summary.date_fields.join(', ')
                  : '未检测到日期字段'}
              </p>
            </div>
            {processResult && (
              <div>
                <p className="text-xs text-stone-400">字段映射</p>
                <div className="mt-1 space-y-1">
                  {Object.entries(processResult.mapping_report).slice(0, 5).map(([k, v]) => (
                    <div key={k} className="text-xs flex gap-1">
                      <span className="text-stone-400">{v}</span>
                      <span className="text-emerald-500">&rarr;</span>
                      <span className="text-emerald-600 font-medium">{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-4 flex-1"
        >
          <h3 className="font-bold text-stone-700 text-sm mb-3">数据质量</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-500">映射覆盖率</span>
                <span className="font-semibold text-stone-700">{dataQuality}%</span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${dataQuality}%` }}
                />
              </div>
            </div>
            {processResult && Object.entries(processResult.fill_report)
              .filter(([, r]) => r.filled > 0)
              .slice(0, 3)
              .map(([field, report]) => (
                <div key={field} className="text-xs">
                  <span className="text-stone-500">{field}: </span>
                  <span className="text-amber-600 font-medium">
                    补全 {report.filled} 个值 ({report.method})
                  </span>
                </div>
              ))}
            {totalFilled === 0 && (
              <p className="text-xs text-emerald-600">数据完整，无需填充</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
