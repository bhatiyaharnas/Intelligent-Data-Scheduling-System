import type {
  DomainsResponse,
  DomainStrategy,
  UploadResponse,
  ProcessResponse,
  ChartsResponse,
  ChartFilter,
  StatsResponse,
  AIAnalyzeResponse,
  AIChartResponse,
  AICleanResponse,
  AIChartCodeResponse,
  AIConfig,
  ProfileResponse,
  MappingSuggestionResponse,
  MappingConfirmation,
  CleanResponse,
  DedupKeysResponse,
  ChartRecommendResponse,
  ChartRecommendation,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8011/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `请求失败: ${res.status}`);
  }
  return res.json();
}

export async function getDomains(): Promise<DomainsResponse> {
  return request<DomainsResponse>('/strategies');
}

export async function getDomainStrategy(domain: string): Promise<DomainStrategy> {
  return request<DomainStrategy>(`/strategies/${domain}`);
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `上传失败: ${res.status}`);
  }
  return res.json();
}

export async function processData(
  fileId: string,
  domain: string
): Promise<ProcessResponse> {
  return request<ProcessResponse>('/process', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, domain }),
  });
}

export async function getCharts(
  processedFileId: string,
  filters?: ChartFilter
): Promise<ChartsResponse> {
  if (filters?.date_from || filters?.date_to || filters?.line_x || filters?.bar_x || filters?.pie_name || (filters?.filters && Object.keys(filters.filters).length > 0)) {
    return request<ChartsResponse>(`/charts/${processedFileId}`, {
      method: 'POST',
      body: JSON.stringify({
        date_from: filters.date_from || null,
        date_to: filters.date_to || null,
        filters: filters.filters || {},
        limit: filters.limit || 50,
        line_x: filters.line_x || null,
        line_y: filters.line_y || null,
        bar_x: filters.bar_x || null,
        bar_y: filters.bar_y || null,
        pie_name: filters.pie_name || null,
        pie_value: filters.pie_value || null,
      }),
    });
  }
  return request<ChartsResponse>(`/charts/${processedFileId}`);
}

export async function getStats(
  processedFileId: string
): Promise<StatsResponse> {
  return request<StatsResponse>(`/stats/${processedFileId}`);
}

export async function analyzeAI(
  processedFileId: string,
  aiConfig: AIConfig
): Promise<AIAnalyzeResponse> {
  return request<AIAnalyzeResponse>('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      processed_file_id: processedFileId,
      api_endpoint: aiConfig.api_endpoint,
      api_key: aiConfig.api_key,
      model: aiConfig.model,
    }),
  });
}

export async function getAICharts(
  processedFileId: string,
  chartConfigs: Record<string, unknown>
): Promise<AIChartResponse> {
  return request<AIChartResponse>('/ai/charts', {
    method: 'POST',
    body: JSON.stringify({
      processed_file_id: processedFileId,
      chart_configs: chartConfigs,
    }),
  });
}

export async function aiClean(
  fileId: string,
  aiConfig: AIConfig
): Promise<AICleanResponse> {
  return request<AICleanResponse>('/ai/clean', {
    method: 'POST',
    body: JSON.stringify({
      file_id: fileId,
      api_endpoint: aiConfig.api_endpoint,
      api_key: aiConfig.api_key,
      model: aiConfig.model,
    }),
  });
}

export async function aiChartCode(
  processedFileId: string,
  aiConfig: AIConfig
): Promise<AIChartCodeResponse> {
  return request<AIChartCodeResponse>('/ai/chart-code', {
    method: 'POST',
    body: JSON.stringify({
      processed_file_id: processedFileId,
      api_endpoint: aiConfig.api_endpoint,
      api_key: aiConfig.api_key,
      model: aiConfig.model,
    }),
  });
}

// ============================================================
// 新增：智能剖析
// ============================================================

export async function getProfile(fileId: string): Promise<ProfileResponse> {
  return request<ProfileResponse>(`/profile/${fileId}`, { method: 'POST' });
}

// ============================================================
// 新增：字段映射
// ============================================================

export async function getMappingSuggestions(
  fileId: string,
  domain: string
): Promise<MappingSuggestionResponse> {
  return request<MappingSuggestionResponse>('/mapping/suggest', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, domain }),
  });
}

export async function confirmMapping(
  fileId: string,
  domain: string,
  confirmations: MappingConfirmation[]
): Promise<CleanResponse> {
  return request<CleanResponse>('/mapping/confirm', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, domain, confirmations }),
  });
}

// ============================================================
// 新增：去重键检测
// ============================================================

export async function getDedupKeys(fileId: string): Promise<DedupKeysResponse> {
  return request<DedupKeysResponse>(`/clean/dedup-keys/${fileId}`);
}

// ============================================================
// 新增：图表推荐
// ============================================================

export async function getChartRecommendations(
  fileId: string
): Promise<ChartRecommendResponse> {
  return request<ChartRecommendResponse>(`/charts/recommend/${fileId}`, { method: 'POST' });
}

// ============================================================
// 新增：根据推荐生成图表
// ============================================================

export async function generateChartsFromRecs(
  fileId: string,
  recommendations: ChartRecommendation[],
  overrides?: Record<string, string>
): Promise<ChartsResponse> {
  return request<ChartsResponse>('/charts/generate', {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, recommendations, overrides: overrides || {} }),
  });
}
