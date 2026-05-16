export interface DomainInfo {
  id: string;
  name: string;
  description: string;
}

export interface DomainsResponse {
  domains: DomainInfo[];
}

export interface FillStrategy {
  method: string;
  fallback?: unknown;
  value?: unknown;
}

export interface DomainStrategy {
  id: string;
  name: string;
  description: string;
  field_mappings: Record<string, string[]>;
  fill_strategies: Record<string, FillStrategy>;
  charts: string[];
}

export interface UploadResponse {
  file_id: string;
  columns: string[];
  row_count: number;
  preview_rows: Record<string, unknown>[];
  dtypes: Record<string, string>;
}

export interface FillReportEntry {
  filled: number;
  method: string;
  fill_value?: unknown;
}

export interface ProcessResponse {
  processed_file_id: string;
  mapping_report: Record<string, string>;
  fill_report: Record<string, FillReportEntry>;
  preview_rows: Record<string, unknown>[];
  summary: {
    total_records: number;
    total_fields: number;
    mapped_fields: number;
    numeric_fields: string[];
    categorical_fields: string[];
    date_fields: string[];
    domain?: string;
  };
}

export interface ChartDataItem {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap' | 'radar' | 'treemap' | 'table';
  title: string;
  description: string;
  data: Record<string, unknown>[];
  config: Record<string, unknown>;
}

export interface ChartFilter {
  date_from?: string;
  date_to?: string;
  filters?: Record<string, string>;
  limit?: number;
  line_x?: string;
  line_y?: string;
  bar_x?: string;
  bar_y?: string;
  pie_name?: string;
  pie_value?: string;
}

export interface SkippedChart {
  type: string;
  applicable: boolean;
  reason: string;
}

export interface ChartsResponse {
  charts: ChartDataItem[];
  summary: {
    total_records: number;
    total_fields: number;
    numeric_fields: string[];
    categorical_fields: string[];
    date_fields: string[];
  };
  skipped_charts: SkippedChart[];
}

export interface AIConfig {
  api_endpoint: string;
  api_key: string;
  model: string;
}

export interface AIAnalyzeResponse {
  success: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
}

export interface NumericStats {
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  p50: number;
  p75: number;
  max: number;
  missing: number;
}

export interface TopValue {
  value: string;
  count: number;
}

export interface CategoricalStats {
  unique: number;
  missing: number;
  top_values: TopValue[];
}

export interface QualityReport {
  total_rows: number;
  total_columns: number;
  total_missing: number;
  duplicate_rows: number;
}

export interface StatsResponse {
  numeric_stats: Record<string, NumericStats>;
  categorical_stats: Record<string, CategoricalStats>;
  quality: QualityReport;
}

export interface AIChartResponse {
  charts: ChartDataItem[];
  error: string | null;
}

export interface AICleanResponse {
  success: boolean;
  cleaned_file_id: string | null;
  preview_rows: Record<string, unknown>[];
  columns: string[];
  summary: {
    original_rows: number;
    cleaned_rows: number;
    original_cols: number;
    cleaned_cols: number;
    rows_removed: number;
    attempts: number;
  };
  error: string | null;
}

export interface AIChartCodeResponse {
  success: boolean;
  charts: ChartDataItem[];
  error: string | null;
}

// ============================================================
// 新增：智能剖析 (Profiling)
// ============================================================

export interface ColumnProfile {
  col_name: string;
  pandas_dtype: string;
  semantic_type: string;
  semantic_confidence: number;
  unique_count: number;
  null_count: number;
  null_rate: number;
  cardinality_ratio: number;
  sample_values: unknown[];
  is_constant: boolean;
}

export interface SuspiciousColumn {
  col_name: string;
  issue: string;
  severity: 'warning' | 'error';
}

export interface HealthReport {
  total_rows: number;
  total_columns: number;
  total_missing: number;
  total_missing_rate: number;
  duplicate_row_count: number;
  duplicate_row_rate: number;
  constant_columns: string[];
  suspicious_columns: SuspiciousColumn[];
  health_score: number;
}

export interface ProfileResponse {
  file_id: string;
  columns: ColumnProfile[];
  health: HealthReport;
  preview_rows: Record<string, unknown>[];
}

// ============================================================
// 新增：字段映射 (Mapping)
// ============================================================

export interface MappingCandidate {
  standard_field: string;
  score: number;
  reason: string;
}

export interface ColumnMappingSuggestion {
  original_col: string;
  candidates: MappingCandidate[];
}

export interface MappingSuggestionResponse {
  file_id: string;
  domain: string;
  suggestions: ColumnMappingSuggestion[];
}

export interface MappingConfirmation {
  original_col: string;
  mapped_to: string | null;
}

// ============================================================
// 新增：分层清洗 (Cleaning)
// ============================================================

export type CleanLayer = 'type_coercion' | 'universal' | 'dedup' | 'custom';

export interface CustomCleanRule {
  column: string;
  action: 'replace' | 'fill' | 'regex_replace' | 'clip';
  params: Record<string, unknown>;
}

export interface LayerReport {
  layer: string;
  rows_before: number;
  rows_after: number;
  columns_affected: number;
  changes: Record<string, Record<string, unknown>>;
}

export interface CleanResponse {
  cleaned_file_id: string;
  preview_rows: Record<string, unknown>[];
  columns: string[];
  layer_reports: LayerReport[];
  summary: Record<string, unknown>;
}

export interface DedupKeyCandidate {
  col_name: string;
  cardinality_ratio: number;
  null_rate: number;
  score: number;
}

export interface DedupKeysResponse {
  file_id: string;
  candidates: DedupKeyCandidate[];
}

// ============================================================
// 新增：图表推荐 (Chart Recommendation)
// ============================================================

export interface ChartRecommendation {
  chart_type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'radar' | 'treemap';
  title: string;
  x_field: string;
  y_field: string;
  priority_score: number;
  reason: string;
}

export interface ChartRecommendResponse {
  file_id: string;
  recommendations: ChartRecommendation[];
}

export type Step = 'input' | 'profiling' | 'mapping' | 'dashboard';
