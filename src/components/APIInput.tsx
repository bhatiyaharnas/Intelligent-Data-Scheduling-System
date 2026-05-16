import { useState, useEffect, useRef, type DragEvent } from 'react';
import { Upload, Database, FileUp, Check, ChevronDown, Brain, Settings, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { getDomains, uploadFile } from '../api/client';
import type { DomainInfo, UploadResponse, AIConfig } from '../types';

interface Props {
  domain: string | null;
  onDomainChange: (d: string) => void;
  aiConfig: AIConfig | null;
  onAIConfigChange: (c: AIConfig | null) => void;
  onUploadSuccess: (data: UploadResponse, fileName: string) => void;
  onError: (msg: string) => void;
}

export default function APIInput({ domain, onDomainChange, aiConfig, onAIConfigChange, onUploadSuccess, onError }: Props) {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiEndpoint, setAIEndpoint] = useState(aiConfig?.api_endpoint || 'https://api.openai.com/v1');
  const [aiKey, setAIKey] = useState(aiConfig?.api_key || '');
  const [aiModel, setAIModel] = useState(aiConfig?.model || 'gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    getDomains()
      .then((res) => setDomains(res.domains))
      .catch(() => onError('无法加载领域列表，请确认后端服务已启动'));
  }, []);

  const handleSaveAIConfig = () => {
    if (aiEndpoint && aiKey && aiModel) {
      onAIConfigChange({ api_endpoint: aiEndpoint, api_key: aiKey, model: aiModel });
      setShowAIConfig(false);
    }
  };

  const handleFileDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls', 'json'].includes(ext || '')) {
        onError('仅支持 CSV / Excel / JSON 格式');
        return;
      }
      if (f.size > 100 * 1024 * 1024) {
        onError('文件大小不能超过 100MB');
        return;
      }
      setFile(f);
    }
  };

  const handleUpload = async () => {
    if (!file || !domain) {
      onError('请先选择领域并上传文件');
      return;
    }
    setUploading(true);
    try {
      const data = await uploadFile(file);
      onUploadSuccess(data, file.name);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-lg w-full bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(251,146,60,0.15)] border border-orange-100"
    >
      <div className="flex flex-col items-center text-center gap-4 mb-8">
        <div className="p-4 bg-gradient-to-tr from-orange-500 to-rose-400 rounded-2xl text-white shadow-lg shadow-orange-500/20">
          <Database size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-orange-600 to-rose-700">
            智能数据调度引擎
          </h1>
          <p className="text-sm text-stone-500 font-medium mt-1">自动化数据处理与可视化系统</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* AI Config Section */}
        <div>
          <button
            onClick={() => setShowAIConfig(!showAIConfig)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
              aiConfig
                ? 'border-purple-300 bg-purple-50/50 text-purple-700'
                : 'border-stone-300 bg-stone-50/50 text-stone-500 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain size={18} className={aiConfig ? 'text-purple-500' : 'text-stone-400'} />
              <span className="text-sm font-semibold">
                {aiConfig ? `AI: ${aiConfig.model}` : 'AI 智能分析配置（可选）'}
              </span>
            </div>
            <Settings size={16} className={aiConfig ? 'text-purple-400' : 'text-stone-400'} />
          </button>

          {showAIConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">API Endpoint</label>
                <input
                  type="text"
                  value={aiEndpoint}
                  onChange={(e) => setAIEndpoint(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={aiKey}
                    onChange={(e) => setAIKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Model Name</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAIModel(e.target.value)}
                  placeholder="gpt-4o-mini / deepseek-chat / gemini-2.0-flash"
                  className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <button
                onClick={handleSaveAIConfig}
                className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                保存 AI 配置
              </button>
            </motion.div>
          )}
        </div>

        {/* Domain Selection */}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">
            选择数据领域
          </label>
          <div className="relative">
            <select
              value={domain || ''}
              onChange={(e) => onDomainChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-orange-200 bg-orange-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all border appearance-none text-stone-700 cursor-pointer"
            >
              <option value="" disabled>请选择数据所属领域...</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.description}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          </div>
          {domain && (
            <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
              <Check size={12} />
              已选择领域，系统将自动应用对应的字段映射和填充策略
            </p>
          )}
        </div>

        {/* File Upload Zone */}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">
            上传数据文件
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-orange-400 bg-orange-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-stone-300 bg-stone-50/50 hover:border-orange-300 hover:bg-orange-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 100 * 1024 * 1024) {
                    onError('文件大小不能超过 100MB');
                    return;
                  }
                  setFile(f);
                }
              }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp size={36} className="text-emerald-500" />
                <p className="font-semibold text-stone-700">{file.name}</p>
                <p className="text-xs text-stone-400">
                  {(file.size / 1024).toFixed(1)} KB · 点击更换文件
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={36} className="text-stone-400" />
                <p className="font-medium text-stone-600">拖拽文件到此处，或点击选择</p>
                <p className="text-xs text-stone-400">支持 CSV / Excel / JSON 格式，最大 100MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || !domain || uploading}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 hover:from-orange-600 to-rose-500 hover:to-rose-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              上传解析中...
            </>
          ) : (
            <>
              <Database size={18} />
              上传并预览数据
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
