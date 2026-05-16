import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, BarChart3, Activity, Table2, TrendingUp, Brain, Home, SlidersHorizontal, X, BarChart4 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart as RPieChart, Pie, AreaChart, Area, ScatterChart, Scatter,
  LineChart, Line, Legend,
} from 'recharts';
import Level1Overview from './Level1Overview';
import Level2Ranking from './Level2Ranking';
import Level3Micro from './Level3Micro';
import Level4Table from './Level4Table';
import Level5Stats from './Level5Stats';
import Level6AI from './Level6AI';
import FilterBar from './FilterBar';
import FieldSelector from './FieldSelector';
import type { ChartsResponse, ProcessResponse, ChartFilter, AIConfig, ChartDataItem, ChartRecommendation, ColumnProfile } from '../types';
import { getCharts, generateChartsFromRecs } from '../api/client';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6', '#e11d48'];

function renderMiniChart(chart: ChartDataItem) {
  const { type, data, config } = chart;
  if (!data || data.length === 0) return <div className="text-xs text-stone-400 text-center py-8">暂无数据</div>;

  switch (type) {
    case 'bar': {
      const xKey = (config.x_field as string) || Object.keys(data[0])[0];
      const yKey = (config.y_field as string) || Object.keys(data[0])[1];
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey={yKey} fill="#f59e0b" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    case 'line': {
      const xKey = (config.x_field as string) || Object.keys(data[0])[0];
      const yKey = (config.y_field as string) || Object.keys(data[0])[1];
      return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area dataKey={yKey} fill="#f59e0b20" stroke="#f59e0b" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    case 'pie': {
      const nameKey = (config.name_field as string) || Object.keys(data[0])[0];
      const valKey = (config.value_field as string) || Object.keys(data[0])[1];
      return (
        <ResponsiveContainer width="100%" height={220}>
          <RPieChart>
            <Pie data={data} dataKey={valKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </RPieChart>
        </ResponsiveContainer>
      );
    }
    case 'scatter': {
      const xKey = (config.x_field as string) || Object.keys(data[0])[0];
      const yKey = (config.y_field as string) || Object.keys(data[0])[1];
      return (
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} type="number" />
            <YAxis dataKey={yKey} tick={{ fontSize: 10 }} type="number" />
            <Tooltip />
            <Scatter data={data} fill="#f59e0b" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
    default: {
      // heatmap/radar/treemap fallback to grouped bar
      const keys = Object.keys(data[0] || {}).filter(k => k !== 'x' && k !== 'y' && k !== 'name' && typeof data[0]?.[k] === 'number');
      if (keys.length === 0) return <div className="text-xs text-stone-400 text-center py-8">无法渲染此图表类型</div>;
      const groupKey = Object.keys(data[0] || {})[0];
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={groupKey} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            {keys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      );
    }
  }
}

const tabs = [
  { id: 'l0', label: '概览推荐', icon: Home },
  { id: 'l1', label: 'L1: 数据明细', icon: Table2 },
  { id: 'l2', label: 'L2: 统计摘要', icon: TrendingUp },
  { id: 'l3', label: 'L3: 全局概览', icon: LayoutDashboard },
  { id: 'l4', label: 'L4: 因子分析', icon: BarChart3 },
  { id: 'l5', label: 'L5: 交叉分析', icon: Activity },
  { id: 'l6', label: 'L6: AI 分析', icon: Brain },
];

interface Props {
  chartsData: ChartsResponse;
  processedFileId: string;
  processResult: ProcessResponse | null;
  domain: string;
  fileName: string;
  aiConfig: AIConfig | null;
  aiCharts: ChartDataItem[];
  onAIChartsChange: (charts: ChartDataItem[]) => void;
  onReset: () => void;
  onError: (msg: string) => void;
  columnProfiles?: ColumnProfile[];
  recommendations?: ChartRecommendation[];
}

const domainNames: Record<string, string> = {
  finance: '金融财务',
  ecommerce: '电商零售',
  logistics: '物流运输',
  healthcare: '医疗健康',
};

export default function Dashboard({
  chartsData: initialCharts,
  processedFileId,
  processResult,
  domain,
  fileName,
  aiConfig,
  aiCharts,
  onAIChartsChange,
  onReset,
  onError,
  columnProfiles = [],
  recommendations = [],
}: Props) {
  const [activeTab, setActiveTab] = useState('l0');
  const [chartsData, setChartsData] = useState<ChartsResponse>(initialCharts);
  const [filtering, setFiltering] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [localRecs, setLocalRecs] = useState<ChartRecommendation[]>(recommendations);

  // 当外部 recommendations 变化时同步
  useEffect(() => {
    if (recommendations.length > 0) setLocalRecs(recommendations);
  }, [recommendations]);

  const handleFilterChange = async (filters: ChartFilter) => {
    setFiltering(true);
    try {
      const data = await getCharts(processedFileId, filters);
      setChartsData(data);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '筛选失败');
    } finally {
      setFiltering(false);
    }
  };

  const handleFieldOverride = useCallback(async (recIndex: number, xField: string, yField: string) => {
    setFiltering(true);
    try {
      // 1) 只更新被修改的那一个推荐卡（用 index 精确定位）
      const updated = localRecs.map((r, i) => {
        if (i === recIndex) {
          return { ...r, x_field: xField, y_field: yField, title: `${yField} 按 ${xField}` };
        }
        return r;
      });
      setLocalRecs(updated);

      // 2) 发送全部推荐
      const data = await generateChartsFromRecs(processedFileId, updated);
      setChartsData(data);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '图表更新失败');
    } finally {
      setFiltering(false);
    }
  }, [processedFileId, localRecs, onError]);

  const allColumns = chartsData.summary.numeric_fields
    ? [...(chartsData.summary.numeric_fields || []),
       ...(chartsData.summary.categorical_fields || []),
       ...(chartsData.summary.date_fields || [])]
    : [];

  const lineChart = chartsData.charts.find((c) => c.type === 'line');
  const barChart = chartsData.charts.find((c) => c.type === 'bar');
  const pieChart = chartsData.charts.find((c) => c.type === 'pie');
  const scatterChart = chartsData.charts.find((c) => c.type === 'scatter');
  const heatmapChart = chartsData.charts.find((c) => c.type === 'heatmap');
  const radarChart = chartsData.charts.find((c) => c.type === 'radar');
  const treemapChart = chartsData.charts.find((c) => c.type === 'treemap');
  const tableChart = chartsData.charts.find((c) => c.type === 'table');

  return (
    <div className="w-full h-screen flex flex-col bg-stone-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 shrink-0 bg-white border-b border-stone-200 px-6 flex items-center justify-between z-10 shadow-sm relative">
        <div className="flex items-center gap-4">
          <button
            onClick={onReset}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
            title="返回首页"
          >
            <span className="text-lg">&larr;</span>
          </button>
          <div className="h-6 w-px bg-stone-200" />
          <h1 className="font-bold text-stone-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            智能调度引擎 · {domainNames[domain] || domain}
          </h1>
          <span className="text-xs text-stone-500 font-mono font-medium bg-stone-100 px-2 py-1 rounded-md border border-stone-200">
            {fileName}
          </span>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/60 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-orange-600 shadow-sm ring-1 ring-stone-200/50'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar
        chartsData={chartsData}
        onChange={handleFilterChange}
        disabled={filtering}
        columnProfiles={columnProfiles}
      />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-gradient-to-br from-orange-50/40 via-peach-50/20 to-rose-50/30 p-6">
        {filtering && (
          <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
            <span className="animate-spin w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full" />
          </div>
        )}
        <div className="w-full h-full max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {activeTab === 'l0' && (
                <div className="h-full overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-stone-700">
                      <BarChart4 size={16} className="inline mr-1" />
                      智能图表推荐 ({localRecs.length})
                    </h2>
                    <button
                      onClick={() => setShowFieldSelector(!showFieldSelector)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        showFieldSelector ? 'bg-amber-100 border-amber-300 text-amber-700' : 'border-stone-200 text-stone-500 hover:bg-stone-100'
                      }`}
                    >
                      <SlidersHorizontal size={14} />
                      {showFieldSelector ? '收起筛选器' : '字段筛选器'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {localRecs.map((rec, i) => {
                      // 用 rec_index 精确匹配后端逐条生成的图表（每个推荐对应唯一图表）
                      let chart = chartsData.charts.find(
                        c => c.config?.rec_index === i
                      );
                      if (!chart) {
                        // 回退到 type + x_field + y_field 组合匹配
                        chart = chartsData.charts.find(
                          c => c.type === rec.chart_type &&
                            c.config?.x_field === rec.x_field &&
                            c.config?.y_field === rec.y_field
                        );
                      }
                      return (
                        <div key={i} className="bg-white rounded-xl border overflow-hidden">
                          <div className="px-4 py-2.5 border-b bg-stone-50/50 flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-xs text-stone-700">{rec.title}</h3>
                              <p className="text-[10px] text-stone-400">{rec.reason}</p>
                            </div>
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              {rec.chart_type}
                            </span>
                          </div>
                          <div className="p-3">
                            {chart ? renderMiniChart(chart) : (
                              <div className="text-xs text-stone-400 text-center py-8">
                                图表数据暂未生成，请使用"字段筛选器"调整字段
                              </div>
                            )}
                          </div>
                          {showFieldSelector && (
                            <div className="px-3 pb-3 border-t pt-2">
                              <FieldSelector
                                chartType={rec.chart_type}
                                chartTitle={rec.title}
                                currentFields={{ x: rec.x_field, y: rec.y_field }}
                                allColumns={allColumns}
                                columnProfiles={columnProfiles}
                                onFieldsChange={(x, y) => handleFieldOverride(i, x, y)}
                                onReset={() => handleFieldOverride(i, rec.x_field, rec.y_field)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {localRecs.length === 0 && (
                    <div className="text-center py-16 text-stone-400">
                      <BarChart4 size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无图表推荐</p>
                      <p className="text-xs mt-1">请切换到其他标签页查看固定图表</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'l1' && (
                <Level4Table
                  tableChart={tableChart || null}
                  summary={chartsData.summary}
                />
              )}
              {activeTab === 'l2' && (
                <Level5Stats
                  processedFileId={processedFileId}
                  onError={onError}
                />
              )}
              {activeTab === 'l3' && (
                <Level1Overview
                  lineChart={lineChart || null}
                  barChart={barChart || null}
                  treemapChart={treemapChart || null}
                  summary={chartsData.summary}
                  processResult={processResult}
                  domain={domain}
                />
              )}
              {activeTab === 'l4' && (
                <Level2Ranking
                  barChart={barChart || null}
                  pieChart={pieChart || null}
                  scatterChart={scatterChart || null}
                  radarChart={radarChart || null}
                  summary={chartsData.summary}
                />
              )}
              {activeTab === 'l5' && (
                <Level3Micro
                  scatterChart={scatterChart || null}
                  heatmapChart={heatmapChart || null}
                  summary={chartsData.summary}
                  processResult={processResult}
                  skippedCharts={chartsData.skipped_charts}
                />
              )}
              {activeTab === 'l6' && (
                <Level6AI
                  processedFileId={processedFileId}
                  aiConfig={aiConfig}
                  processResult={processResult}
                  chartsData={chartsData}
                  aiCharts={aiCharts}
                  onAIChartsChange={onAIChartsChange}
                  onError={onError}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
