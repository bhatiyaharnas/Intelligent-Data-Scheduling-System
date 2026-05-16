import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { type ComponentType } from 'react';
import { TrendingUp, Hash, AlertTriangle, BarChart3 } from 'lucide-react';
import { getStats } from '../api/client';
import type { StatsResponse, NumericStats, CategoricalStats } from '../types';

interface Props {
  processedFileId: string;
  onError: (msg: string) => void;
}

export default function Level5Stats({ processedFileId, onError }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStats(processedFileId)
      .then(setStats)
      .catch((e) => {
        const msg = e.message || String(e);
        if (msg.includes('404') || msg.includes('Not Found')) {
          onError('统计服务不可用: 请重启后端加载新版代码（缺少 /api/stats 端点）');
        } else {
          onError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [processedFileId]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="animate-spin w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
        统计数据不可用
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full flex flex-col gap-4 overflow-auto"
    >
      {/* Quality Cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <QCard icon={Hash} label="总行数" value={stats.quality.total_rows} color="text-blue-500" bg="bg-blue-50" />
        <QCard icon={BarChart3} label="总列数" value={stats.quality.total_columns} color="text-emerald-500" bg="bg-emerald-50" />
        <QCard icon={AlertTriangle} label="缺失值" value={stats.quality.total_missing} color="text-amber-500" bg="bg-amber-50" />
        <QCard icon={Hash} label="重复行" value={stats.quality.duplicate_rows} color="text-rose-500" bg="bg-rose-50" />
      </div>

      {/* Numeric Stats Tables */}
      {Object.keys(stats.numeric_stats).length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-4">
          <h3 className="font-bold text-stone-700 text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-orange-500" />
            数值字段统计
          </h3>
          <div className="overflow-auto">
            {Object.entries(stats.numeric_stats).map(([field, ns]: [string, NumericStats]) => (
              <div key={field} className="mb-4 last:mb-0">
                <h4 className="text-sm font-semibold text-stone-600 mb-2">{field}</h4>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {(['count', 'mean', 'std', 'min', 'p25', 'p50', 'p75', 'max'] as const).map((k) => (
                    <div key={k} className="flex justify-between bg-stone-50 rounded px-2 py-1">
                      <span className="text-stone-500">{k}</span>
                      <span className="font-mono text-stone-700">{ns[k as keyof NumericStats]}</span>
                    </div>
                  ))}
                  <div className="flex justify-between bg-amber-50 rounded px-2 py-1">
                    <span className="text-amber-600">缺失</span>
                    <span className="font-mono text-amber-700">{ns.missing}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorical Stats */}
      {Object.keys(stats.categorical_stats).length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-sm p-4">
          <h3 className="font-bold text-stone-700 text-sm mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            分类字段频数 (Top 10)
          </h3>
          <div className="space-y-4">
            {Object.entries(stats.categorical_stats).map(([field, cs]: [string, CategoricalStats]) => (
              <div key={field}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-stone-600">{field}</span>
                  <span className="text-xs text-stone-400">
                    {cs.unique} 个唯一值 · {cs.missing} 个缺失
                  </span>
                </div>
                <div className="space-y-1">
                  {cs.top_values.map((tv, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-stone-500 w-20 truncate">{tv.value}</span>
                      <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-300 rounded-full"
                          style={{
                            width: `${Math.max(3, (tv.count / (cs.top_values[0]?.count || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-stone-600 w-12 text-right">{tv.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function QCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <Icon size={16} className={`${color} mx-auto mb-1`} />
      <p className="text-xl font-bold text-stone-700">{value.toLocaleString()}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
