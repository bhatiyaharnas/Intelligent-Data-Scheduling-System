from enum import Enum
from pydantic import BaseModel
from typing import Any


# ---- Enums ----

class CleanLayerEnum(str, Enum):
    type_coercion = "type_coercion"
    universal = "universal"
    dedup = "dedup"
    custom = "custom"


# ---- Domain ----

class DomainInfo(BaseModel):
    id: str
    name: str
    description: str


class DomainsResponse(BaseModel):
    domains: list[DomainInfo]


class FillStrategy(BaseModel):
    method: str
    fallback: Any = None
    value: Any = None


class FieldMapping(BaseModel):
    pass


class DomainStrategy(BaseModel):
    id: str
    name: str
    description: str
    field_mappings: dict[str, list[str]]
    fill_strategies: dict[str, FillStrategy]
    charts: list[str]


class UploadResponse(BaseModel):
    file_id: str
    columns: list[str]
    row_count: int
    preview_rows: list[dict[str, Any]]
    dtypes: dict[str, str]


class ProcessRequest(BaseModel):
    file_id: str
    domain: str


class FillReportEntry(BaseModel):
    filled: int
    method: str
    fill_value: Any = None


class ProcessResponse(BaseModel):
    processed_file_id: str
    mapping_report: dict[str, str]
    fill_report: dict[str, FillReportEntry]
    preview_rows: list[dict[str, Any]]
    summary: dict[str, Any]


class ChartDataItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    data: list[dict[str, Any]]
    config: dict[str, Any]


class ChartFilter(BaseModel):
    date_from: str | None = None
    date_to: str | None = None
    filters: dict[str, str] = {}
    limit: int = 50
    line_x: str | None = None
    line_y: str | None = None
    bar_x: str | None = None
    bar_y: str | None = None
    pie_name: str | None = None
    pie_value: str | None = None


class ChartsResponse(BaseModel):
    charts: list[ChartDataItem]
    summary: dict[str, Any]
    skipped_charts: list[dict[str, Any]] = []


class NumericStats(BaseModel):
    count: int
    mean: float
    std: float
    min: float
    p25: float
    p50: float
    p75: float
    max: float
    missing: int


class TopValue(BaseModel):
    value: str
    count: int


class CategoricalStats(BaseModel):
    unique: int
    missing: int
    top_values: list[TopValue]


class QualityReport(BaseModel):
    total_rows: int
    total_columns: int
    total_missing: int
    duplicate_rows: int


class StatsResponse(BaseModel):
    numeric_stats: dict[str, NumericStats] = {}
    categorical_stats: dict[str, CategoricalStats] = {}
    quality: QualityReport


class AIAnalyzeRequest(BaseModel):
    processed_file_id: str
    api_endpoint: str
    api_key: str
    model: str


class AIAnalyzeResponse(BaseModel):
    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None


class AIChartRequest(BaseModel):
    processed_file_id: str
    chart_configs: dict[str, Any]


class AIChartResponse(BaseModel):
    charts: list[ChartDataItem]
    error: str | None = None


class AICleanRequest(BaseModel):
    file_id: str
    api_endpoint: str
    api_key: str
    model: str


class AICleanResponse(BaseModel):
    success: bool
    cleaned_file_id: str | None = None
    preview_rows: list[dict[str, Any]] = []
    columns: list[str] = []
    summary: dict[str, Any] = {}
    error: str | None = None


class AIChartCodeRequest(BaseModel):
    processed_file_id: str
    api_endpoint: str
    api_key: str
    model: str


class AIChartCodeResponse(BaseModel):
    success: bool
    charts: list[ChartDataItem] = []
    error: str | None = None


# ============================================================
# 新增：智能剖析 (Profiling)
# ============================================================

class ColumnProfile(BaseModel):
    col_name: str
    pandas_dtype: str
    semantic_type: str
    semantic_confidence: float
    unique_count: int
    null_count: int
    null_rate: float
    cardinality_ratio: float
    sample_values: list[Any] = []
    is_constant: bool = False


class SuspiciousColumn(BaseModel):
    col_name: str
    issue: str
    severity: str  # "warning" | "error"


class HealthReport(BaseModel):
    total_rows: int
    total_columns: int
    total_missing: int
    total_missing_rate: float
    duplicate_row_count: int
    duplicate_row_rate: float
    constant_columns: list[str] = []
    suspicious_columns: list[SuspiciousColumn] = []
    health_score: int = 100


class ProfileResponse(BaseModel):
    file_id: str
    columns: list[ColumnProfile]
    health: HealthReport
    preview_rows: list[dict[str, Any]]


# ============================================================
# 新增：字段映射 (Mapping)
# ============================================================

class MappingCandidate(BaseModel):
    standard_field: str
    score: float
    reason: str


class ColumnMappingSuggestion(BaseModel):
    original_col: str
    candidates: list[MappingCandidate] = []


class MappingSuggestionRequest(BaseModel):
    file_id: str
    domain: str


class MappingSuggestionResponse(BaseModel):
    file_id: str
    domain: str
    suggestions: list[ColumnMappingSuggestion]


class MappingConfirmation(BaseModel):
    original_col: str
    mapped_to: str | None = None  # None 表示"标记为未映射，进入通用字段池"


class MappingConfirmRequest(BaseModel):
    file_id: str
    domain: str
    confirmations: list[MappingConfirmation]


# ============================================================
# 新增：分层清洗 (Cleaning)
# ============================================================

class CustomCleanRule(BaseModel):
    column: str
    action: str  # "replace" | "fill" | "regex_replace" | "clip"
    params: dict[str, Any] = {}


class CleanRequest(BaseModel):
    file_id: str
    enabled_layers: list[CleanLayerEnum] = []
    custom_rules: list[CustomCleanRule] = []
    dedup_keys: list[str] = []


class LayerReport(BaseModel):
    layer: str
    rows_before: int
    rows_after: int
    columns_affected: int
    changes: dict[str, Any] = {}


class CleanResponse(BaseModel):
    cleaned_file_id: str
    preview_rows: list[dict[str, Any]]
    columns: list[str]
    layer_reports: list[LayerReport]
    summary: dict[str, Any]


class DedupKeyCandidate(BaseModel):
    col_name: str
    cardinality_ratio: float
    null_rate: float
    score: float


class DedupKeysResponse(BaseModel):
    file_id: str
    candidates: list[DedupKeyCandidate]


# ============================================================
# 新增：图表推荐 (Chart Recommendation)
# ============================================================

class ChartRecommendation(BaseModel):
    chart_type: str  # "line" | "bar" | "pie" | "scatter" | "heatmap" | "radar" | "treemap"
    title: str
    x_field: str
    y_field: str
    priority_score: float
    reason: str


class ChartRecommendResponse(BaseModel):
    file_id: str
    recommendations: list[ChartRecommendation]


class ChartGenerateRequest(BaseModel):
    file_id: str
    recommendations: list[ChartRecommendation] = []
    overrides: dict[str, str] = {}  # 用户覆盖字段
