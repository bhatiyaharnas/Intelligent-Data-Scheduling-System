import { useState } from 'react';
import Dashboard from './components/Dashboard';
import APIInput from './components/APIInput';
import DataPreview from './components/DataPreview';
import ProfilingReport from './components/ProfilingReport';
import MappingConfirmation from './components/MappingConfirmation';
import { uploadFile, processData, getCharts, getProfile, getMappingSuggestions, getChartRecommendations, generateChartsFromRecs, confirmMapping } from './api/client';
import type { Step, UploadResponse, ProcessResponse, ChartsResponse, AIConfig, ChartDataItem, ProfileResponse, MappingSuggestionResponse, CleanResponse, ChartRecommendation, ColumnProfile } from './types';

export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [domain, setDomain] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [processedFileId, setProcessedFileId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<UploadResponse | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResponse | null>(null);
  const [chartsData, setChartsData] = useState<ChartsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [aiCharts, setAICharts] = useState<ChartDataItem[]>([]);

  // 新增状态
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [mappingSuggestions, setMappingSuggestions] = useState<MappingSuggestionResponse | null>(null);
  const [cleanResult, setCleanResult] = useState<CleanResponse | null>(null);
  const [chartRecommendations, setChartRecommendations] = useState<ChartRecommendation[]>([]);
  const [columnProfiles, setColumnProfiles] = useState<ColumnProfile[]>([]);

  // ---- 旧版流程 ----
  const handleUploadSuccess = (data: UploadResponse, name: string) => {
    setFileId(data.file_id);
    setFileName(name);
    setPreviewData(data);
    setError(null);
    setStep('preview');
  };

  const handleProcessSuccess = (data: ProcessResponse) => {
    setProcessedFileId(data.processed_file_id);
    setProcessResult(data);
    setError(null);
  };

  const handleChartsLoaded = (data: ChartsResponse) => {
    setChartsData(data);
    setError(null);
    setStep('dashboard');
  };

  // ---- 新版流程 ----
  const handleUploadSuccessV2 = async (data: UploadResponse, name: string) => {
    setFileId(data.file_id);
    setFileName(name);
    setPreviewData(data);
    setError(null);

    // 自动执行剖析
    try {
      const profile = await getProfile(data.file_id);
      setProfileData(profile);
      setColumnProfiles(profile.columns);
      setStep('profiling');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '剖析失败，请重试');
      setStep('preview'); // 降级到旧版流程
    }
  };

  const handleProceedToMapping = async () => {
    if (!fileId || !domain) return;
    try {
      const suggestions = await getMappingSuggestions(fileId, domain);
      setMappingSuggestions(suggestions);
      setStep('mapping');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '获取映射建议失败');
    }
  };

  const handleMappingConfirmed = async (cleanResult: CleanResponse) => {
    setCleanResult(cleanResult);
    setProcessedFileId(cleanResult.cleaned_file_id);
    setColumnProfiles(columnProfiles); // 保留剖析类型信息

    // 到仪表盘
    try {
      const recs = await getChartRecommendations(cleanResult.cleaned_file_id);
      setChartRecommendations(recs.recommendations);

      const charts = await generateChartsFromRecs(cleanResult.cleaned_file_id, recs.recommendations);
      setChartsData(charts);
      setStep('dashboard');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '图表生成失败');
      setStep('dashboard');
    }
  };

  const handleSkipMapping = async () => {
    if (!fileId) {
      setError('文件未就绪，请返回重新上传');
      return;
    }
    try {
      const result = await confirmMapping(fileId, domain || 'general', []);
      setCleanResult(result);
      setProcessedFileId(result.cleaned_file_id);

      const recs = await getChartRecommendations(result.cleaned_file_id);
      setChartRecommendations(recs.recommendations);

      const charts = await generateChartsFromRecs(result.cleaned_file_id, recs.recommendations);
      setChartsData(charts);
      setStep('dashboard');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '处理失败，请检查数据后重试');
    }
  };

  const handleReset = () => {
    setStep('input');
    setDomain(null);
    setFileId(null);
    setFileName(null);
    setProcessedFileId(null);
    setPreviewData(null);
    setProcessResult(null);
    setChartsData(null);
    setAICharts([]);
    setProfileData(null);
    setMappingSuggestions(null);
    setCleanResult(null);
    setChartRecommendations([]);
    setColumnProfiles([]);
    setError(null);
  };

  const handleBackToInput = () => {
    setStep('input');
    setFileId(null);
    setFileName(null);
    setPreviewData(null);
    setProcessResult(null);
    setProfileData(null);
    setMappingSuggestions(null);
    setError(null);
  };

  const handleBackToProfiling = () => {
    setStep('profiling');
    setMappingSuggestions(null);
    setCleanResult(null);
    setError(null);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center font-sans text-stone-800">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-xl shadow-lg max-w-md text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">错误</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 font-bold">&times;</button>
          </div>
        </div>
      )}

      {/* Step 1: 导入 */}
      {step === 'input' && (
        <APIInput domain={domain} onDomainChange={setDomain}
          aiConfig={aiConfig} onAIConfigChange={setAIConfig}
          onUploadSuccess={handleUploadSuccessV2} onError={setError} />
      )}

      {/* Step 2: 智能剖析 */}
      {step === 'profiling' && profileData && (
        <ProfilingReport
          profileData={profileData}
          fileName={fileName || ''}
          domain={domain || ''}
          onProceedToMapping={handleProceedToMapping}
          onBack={handleBackToInput}
          onError={setError}
        />
      )}

      {/* Step 3: 映射确认（含清洗） */}
      {step === 'mapping' && mappingSuggestions && fileId && (
        <MappingConfirmation
          fileId={fileId}
          domain={domain || 'general'}
          suggestions={mappingSuggestions.suggestions}
          columnProfiles={columnProfiles}
          onConfirm={handleMappingConfirmed}
          onSkip={handleSkipMapping}
          onBack={handleBackToProfiling}
          onError={setError}
        />
      )}

      {/* 旧版预览（降级路径） */}
      {step === 'preview' && previewData && (
        <DataPreview previewData={previewData} fileName={fileName || ''}
          domain={domain || ''} processResult={processResult}
          processedFileId={processedFileId} fileId={fileId}
          aiConfig={aiConfig}
          onProcess={(domainId, useCleanedFileId) => {
            const targetId = useCleanedFileId || fileId;
            if (targetId) {
              processData(targetId, domainId)
                .then(handleProcessSuccess).catch((e) => setError(e.message));
            }
          }}
          onGenerateDashboard={() => {
            if (processedFileId) {
              getCharts(processedFileId)
                .then(handleChartsLoaded).catch((e) => setError(e.message));
            }
          }}
          onBack={handleBackToInput} onError={setError} />
      )}

      {/* Step 4: 可视化仪表盘 */}
      {step === 'dashboard' && chartsData && (
        <Dashboard chartsData={chartsData}
          processedFileId={processedFileId || ''}
          processResult={processResult} domain={domain || ''}
          fileName={fileName || ''} aiConfig={aiConfig}
          aiCharts={aiCharts} onAIChartsChange={setAICharts}
          columnProfiles={columnProfiles}
          recommendations={chartRecommendations}
          onReset={handleReset} onError={setError} />
      )}
    </div>
  );
}
