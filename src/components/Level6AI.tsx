import { useState } from 'react';
import { motion } from 'motion/react';
import { Brain, CheckCircle, XCircle, Sparkles, Play } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart as RPieChart, Pie, AreaChart, Area, ScatterChart, Scatter,
} from 'recharts';
import { aiChartCode } from '../api/client';
import type { ChartsResponse, ProcessResponse, AIConfig, ChartDataItem } from '../types';

interface Props {
  processedFileId: string;
  aiConfig: AIConfig | null;
  processResult: ProcessResponse | null;
  chartsData: ChartsResponse | null;
  aiCharts: ChartDataItem[];
  onAIChartsChange: (charts: ChartDataItem[]) => void;
  onError: (msg: string) => void;
}

const COLORS = ['#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];

export default function Level6AI({ processedFileId, aiConfig, processResult, chartsData, aiCharts, onAIChartsChange, onError }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerateCharts = async () => {
    if (!aiConfig) { onError('请先在首页配置 AI 参数'); return; }
    setLoading(true);
    try {
      const res = await aiChartCode(processedFileId, aiConfig);
      if (res.success && res.charts.length > 0) {
        onAIChartsChange(res.charts);
      } else {
        onError(res.error || 'AI 未生成图表');
      }
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'AI 图表生成失败');
    } finally { setLoading(false); }
  };

  const mappedCount = processResult?.summary.mapped_fields || 0;
  const totalCols = chartsData?.summary.total_fields || 1;
  const mappingRate = Math.round((mappedCount / totalCols) * 100);

  const renderChart = (c: ChartDataItem) => {
    const data = (c.data || []) as Record<string, unknown>[];
    if (!data.length) return null;
    const cfg = c.config || {};
    // 兼容 AI 可能返回的不同 config key 名 (x/y/name/value → x_field/y_field/name_field/value_field)
    const xKey = (cfg.x_field || cfg.x || '') as string;
    const yKey = (cfg.y_field || cfg.y || '') as string;
    const nameKey = (cfg.name_field || cfg.name || '') as string;
    const valKey = (cfg.value_field || cfg.value || '') as string;
    const groupKey = (cfg.group_field || cfg.group || '') as string;
    const metrics = (cfg.metrics || []) as string[];

    return (
      <div key={c.id} className="bg-white/80 rounded-xl border border-stone-200/60 p-4">
        <h4 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
          <Sparkles size={14} className="text-purple-500" />{c.title}
        </h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {c.type === 'bar' ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={xKey} tick={{fontSize:10}} />
                <YAxis tick={{fontSize:10}} />
                <Tooltip />
                <Bar dataKey={yKey} fill="#f97316" radius={[4,4,0,0]}>
                  {data.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : c.type === 'line' ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={xKey} tick={{fontSize:10}} />
                <YAxis tick={{fontSize:10}} />
                <Tooltip />
                <Area type="monotone" dataKey={yKey} stroke="#f97316" fill="#fed7aa" />
              </AreaChart>
            ) : c.type === 'pie' ? (
              <RPieChart>
                <Pie data={data} dataKey={valKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={80}
                  label={({name,value}) => `${name}: ${value}`}>
                  {data.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </RPieChart>
            ) : c.type === 'scatter' ? (
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={xKey} tick={{fontSize:10}} type="number" />
                <YAxis dataKey={yKey} tick={{fontSize:10}} type="number" />
                <Tooltip />
                <Scatter data={data} fill="#a855f7" opacity={0.6} />
              </ScatterChart>
            ) : c.type === 'heatmap' ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" tick={{fontSize:10}} />
                <YAxis tick={{fontSize:10}} />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" radius={[4,4,0,0]}>
                  {data.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : c.type === 'radar' ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={groupKey} tick={{fontSize:10}} />
                <YAxis tick={{fontSize:10}} />
                <Tooltip />
                {metrics.slice(0,5).map((m,i) => <Bar key={m} dataKey={m} fill={COLORS[i%COLORS.length]} />)}
              </BarChart>
            ) : (
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{fontSize:10}} />
                <YAxis type="category" dataKey={groupKey||yKey} width={80} tick={{fontSize:10}} />
                <Tooltip />
                {metrics.length > 0
                  ? metrics.slice(0,4).map((m,i) => <Bar key={m} dataKey={m} fill={COLORS[i%COLORS.length]} barSize={12} />)
                  : yKey ? <Bar dataKey={yKey} fill="#f97316" barSize={12} /> : null}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="w-full h-full flex flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2"><Brain size={20} className="text-purple-500" /><h3 className="font-bold text-stone-700 text-sm">AI 智能分析</h3></div>
        <div className="flex items-center gap-3">
          {!aiConfig ? <span className="text-xs text-amber-600 flex items-center gap-1"><XCircle size={14} />未配置 AI</span>
          : <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={14} />{aiConfig.model}</span>}
          <button onClick={handleGenerateCharts} disabled={loading || !aiConfig}
            className="flex items-center gap-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Play size={14} fill="currentColor" />}
            {aiCharts.length > 0 ? '重新生成' : 'AI 智能绘图'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 shrink-0">
        <div className="bg-white/80 rounded-xl border border-stone-200/60 p-3"><p className="text-xs text-stone-500">字段映射率</p><p className={`text-lg font-bold ${mappingRate<50?'text-amber-600':'text-emerald-600'}`}>{mappingRate}%</p></div>
        <div className="bg-white/80 rounded-xl border border-stone-200/60 p-3"><p className="text-xs text-stone-500">已映射字段</p><p className="text-lg font-bold text-stone-700">{mappedCount}/{totalCols}</p></div>
        <div className="bg-white/80 rounded-xl border border-stone-200/60 p-3"><p className="text-xs text-stone-500">AI 图表</p><p className="text-lg font-bold text-purple-600">{aiCharts.length > 0 ? `${aiCharts.length} 个` : loading ? '生成中' : '-'}</p></div>
      </div>

      {loading && <div className="flex-1 flex items-center justify-center gap-3"><span className="animate-spin w-6 h-6 border-3 border-purple-400 border-t-transparent rounded-full" /><span className="text-sm text-purple-600">AI 正在分析数据并生成图表...</span></div>}

      {!loading && aiCharts.length > 0 && <div className="grid grid-cols-2 gap-4">{aiCharts.map(renderChart)}</div>}

      {!loading && aiCharts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3">
          <Brain size={48} />
          <p className="text-sm">点击"AI 智能绘图"让 AI 自动分析数据并生成图表</p>
          <p className="text-xs text-stone-300">结果会保留在当前会话中，切换标签页不会丢失</p>
        </div>
      )}
    </motion.div>
  );
}
