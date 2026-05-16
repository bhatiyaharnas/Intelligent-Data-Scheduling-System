import json
import uuid
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import (
    DomainsResponse,
    DomainInfo,
    DomainStrategy,
    FillStrategy,
    UploadResponse,
    ProcessRequest,
    ProcessResponse,
    FillReportEntry,
    ChartsResponse,
    ChartDataItem,
    ChartFilter,
    StatsResponse,
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIChartRequest,
    AIChartResponse,
    AICleanRequest,
    AICleanResponse,
    AIChartCodeRequest,
    AIChartCodeResponse,
    # 新增
    ProfileResponse,
    MappingSuggestionRequest,
    MappingSuggestionResponse,
    MappingConfirmRequest,
    MappingConfirmation,
    CleanRequest,
    CleanResponse,
    LayerReport,
    CleanLayerEnum,
    DedupKeysResponse,
    DedupKeyCandidate,
    ChartRecommendResponse,
    ChartRecommendation,
    ChartGenerateRequest,
)
from services.data_loader import DataLoader
from services.data_processor import DataProcessor
from services.chart_engine import ChartEngine
from services.ai_service import AIService
from services.code_executor import CodeExecutor
from services.profiler import DataProfiler
from services.mapping_service import MappingService
from services.cleaning_service import CleaningService

app = FastAPI(title="Intelligent Data Dispatch Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
CONFIG_DIR = BASE_DIR / "config"
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)

data_loader = DataLoader(TEMP_DIR)
data_processor = DataProcessor(TEMP_DIR)
chart_engine = ChartEngine()
ai_service = AIService()
data_profiler = DataProfiler()
mapping_service = MappingService()
cleaning_service = CleaningService(TEMP_DIR)


def _load_strategies() -> dict:
    with open(CONFIG_DIR / "domain_strategies.json", "r", encoding="utf-8") as f:
        return json.load(f)


def _build_domain_info(domain_id: str, domain_cfg: dict) -> DomainInfo:
    return DomainInfo(
        id=domain_id,
        name=domain_cfg["name"],
        description=domain_cfg["description"],
    )


@app.get("/api/strategies", response_model=DomainsResponse)
async def get_strategies():
    data = _load_strategies()
    domains = [
        _build_domain_info(did, dcfg) for did, dcfg in data["domains"].items()
    ]
    return DomainsResponse(domains=domains)


@app.get("/api/strategies/{domain}", response_model=DomainStrategy)
async def get_domain_strategy(domain: str):
    data = _load_strategies()
    if domain not in data["domains"]:
        from fastapi import HTTPException
        raise HTTPException(404, f"领域 '{domain}' 不存在")
    d = data["domains"][domain]
    fill_strategies = {
        k: FillStrategy(**v) for k, v in d.get("fill_strategies", {}).items()
    }
    return DomainStrategy(
        id=domain,
        name=d["name"],
        description=d["description"],
        field_mappings=d.get("field_mappings", {}),
        fill_strategies=fill_strategies,
        charts=d.get("charts", []),
    )


@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    file_id = uuid.uuid4().hex[:12]
    ext = Path(file.filename).suffix.lower()
    file_path = TEMP_DIR / f"{file_id}{ext}"
    content = await file.read()
    file_path.write_bytes(content)

    try:
        df = data_loader.load_file(str(file_path))
    except Exception as e:
        raise ValueError(f"文件解析失败: {e}")

    row_count = len(df)
    preview_rows = df.head(20).fillna("").to_dict(orient="records")
    columns = list(df.columns)
    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

    df.to_parquet(TEMP_DIR / f"{file_id}.parquet", index=False)

    return UploadResponse(
        file_id=file_id,
        columns=columns,
        row_count=row_count,
        preview_rows=preview_rows,
        dtypes=dtypes,
    )


@app.post("/api/process", response_model=ProcessResponse)
async def process_data(req: ProcessRequest):
    parquet_path = TEMP_DIR / f"{req.file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{req.file_id}' 不存在，请先上传")

    data = _load_strategies()
    if req.domain not in data["domains"]:
        from fastapi import HTTPException
        raise HTTPException(404, f"领域 '{req.domain}' 不存在")

    domain_cfg = data["domains"][req.domain]
    df = pd.read_parquet(parquet_path)

    df_processed, mapping_report, fill_report_raw, summary = data_processor.process(
        df, domain_cfg
    )

    processed_id = f"{req.file_id}_processed"
    df_processed.to_parquet(TEMP_DIR / f"{processed_id}.parquet", index=False)

    fill_report = {
        k: FillReportEntry(
            filled=v.get("filled", 0),
            method=v.get("method", ""),
            fill_value=v.get("fill_value"),
        )
        for k, v in fill_report_raw.items()
    }
    preview_rows = df_processed.head(20).fillna("").to_dict(orient="records")

    return ProcessResponse(
        processed_file_id=processed_id,
        mapping_report=mapping_report,
        fill_report=fill_report,
        preview_rows=preview_rows,
        summary=summary,
    )


# ============================================================
# 新增端点：图表推荐（必须在参数化路由之前）
# ============================================================

@app.post("/api/charts/recommend/{file_id}", response_model=ChartRecommendResponse)
async def recommend_charts(file_id: str):
    """基于字段类型生成图表推荐"""
    parquet_path = TEMP_DIR / f"{file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{file_id}' 不存在，请先清洗后再试")

    df = pd.read_parquet(parquet_path)
    profile_result = data_profiler.profile(df)

    recommendations = chart_engine.recommend_charts(df, profile_result["columns"])
    rec_models = [ChartRecommendation(**r) for r in recommendations]
    return ChartRecommendResponse(file_id=file_id, recommendations=rec_models)


@app.post("/api/charts/generate", response_model=ChartsResponse)
async def generate_charts(req: ChartGenerateRequest):
    """根据推荐配置+用户覆盖生成图表"""
    parquet_path = TEMP_DIR / f"{req.file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{req.file_id}' 不存在")

    df = pd.read_parquet(parquet_path)

    # 将 Pydantic 模型转为 dict 列表
    recs = [r.model_dump() if hasattr(r, 'model_dump') else r for r in req.recommendations]

    charts_data, skipped, summary = chart_engine.generate_charts_from_recommendations(df, recs, 50)

    chart_items = [
        ChartDataItem(
            id=c["id"], type=c["type"], title=c["title"],
            description=c["description"], data=c["data"], config=c["config"],
        )
        for c in charts_data
    ]
    return ChartsResponse(charts=chart_items, summary=summary, skipped_charts=skipped)


@app.get("/api/charts/{processed_file_id}", response_model=ChartsResponse)
async def get_charts(processed_file_id: str):
    parquet_path = TEMP_DIR / f"{processed_file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"处理后的文件 '{processed_file_id}' 不存在，请先处理数据")

    df = pd.read_parquet(parquet_path)
    return _build_charts_response(df, ChartFilter(limit=50))


@app.post("/api/charts/{processed_file_id}", response_model=ChartsResponse)
async def post_charts(processed_file_id: str, filter_req: ChartFilter):
    parquet_path = TEMP_DIR / f"{processed_file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"处理后的文件 '{processed_file_id}' 不存在，请先处理数据")

    df = pd.read_parquet(parquet_path)
    return _build_charts_response(df, filter_req)


def _build_charts_response(df: pd.DataFrame, filter_req: ChartFilter) -> ChartsResponse:
    if filter_req.date_from or filter_req.date_to or filter_req.filters:
        df = chart_engine.apply_filters(df, filter_req)

    # Extract field overrides from filter + direct fields
    overrides = {}
    for k in list(filter_req.filters.keys()):
        if k in ('line_x', 'line_y', 'bar_x', 'bar_y', 'pie_name', 'pie_value'):
            if k == 'pie_name': overrides['pie_x'] = filter_req.filters.pop(k)
            elif k == 'pie_value': overrides['pie_y'] = filter_req.filters.pop(k)
            else: overrides[k] = filter_req.filters.pop(k)
    if filter_req.line_x: overrides['line_x'] = filter_req.line_x
    if filter_req.line_y: overrides['line_y'] = filter_req.line_y
    if filter_req.bar_x: overrides['bar_x'] = filter_req.bar_x
    if filter_req.bar_y: overrides['bar_y'] = filter_req.bar_y
    if filter_req.pie_name: overrides['pie_x'] = filter_req.pie_name
    if filter_req.pie_value: overrides['pie_y'] = filter_req.pie_value

    charts_data, skipped, summary = chart_engine.generate_all_charts(df, filter_req.limit, overrides if overrides else None)

    chart_items = [
        ChartDataItem(
            id=c["id"],
            type=c["type"],
            title=c["title"],
            description=c["description"],
            data=c["data"],
            config=c["config"],
        )
        for c in charts_data
    ]

    return ChartsResponse(charts=chart_items, summary=summary, skipped_charts=skipped)


@app.get("/api/stats/{processed_file_id}", response_model=StatsResponse)
async def get_stats(processed_file_id: str):
    parquet_path = TEMP_DIR / f"{processed_file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"处理后的文件 '{processed_file_id}' 不存在")

    df = pd.read_parquet(parquet_path)

    numeric_stats = {}
    for col in df.select_dtypes(include=["number"]).columns:
        desc = df[col].describe()
        numeric_stats[col] = {
            "count": int(desc.get("count", 0)),
            "mean": round(float(desc.get("mean", 0)), 2),
            "std": round(float(desc.get("std", 0)), 2),
            "min": round(float(desc.get("min", 0)), 2),
            "p25": round(float(desc.get("25%", 0)), 2),
            "p50": round(float(desc.get("50%", 0)), 2),
            "p75": round(float(desc.get("75%", 0)), 2),
            "max": round(float(desc.get("max", 0)), 2),
            "missing": int(df[col].isna().sum()),
        }

    categorical_stats = {}
    for col in df.select_dtypes(include=["object", "category", "string"]).columns:
        vc = df[col].value_counts().head(10)
        categorical_stats[col] = {
            "unique": int(df[col].nunique()),
            "missing": int(df[col].isna().sum()),
            "top_values": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
        }

    quality = {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "total_missing": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
    }

    return StatsResponse(
        numeric_stats=numeric_stats,
        categorical_stats=categorical_stats,
        quality=quality,
    )


@app.post("/api/ai/analyze", response_model=AIAnalyzeResponse)
async def ai_analyze(req: AIAnalyzeRequest):
    parquet_path = TEMP_DIR / f"{req.processed_file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"处理后的文件 '{req.processed_file_id}' 不存在")

    df = pd.read_parquet(parquet_path)
    columns = list(df.columns)
    sample_rows = df.head(5).fillna("").to_dict(orient="records")

    try:
        result = ai_service.analyze_data(
            columns=columns,
            sample_rows=sample_rows,
            api_endpoint=req.api_endpoint,
            api_key=req.api_key,
            model=req.model,
        )
        return AIAnalyzeResponse(success=True, data=result, error=None)
    except Exception as e:
        return AIAnalyzeResponse(success=False, data=None, error=str(e))


@app.post("/api/ai/charts", response_model=AIChartResponse)
async def ai_charts(req: AIChartRequest):
    parquet_path = TEMP_DIR / f"{req.processed_file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"处理后的文件 '{req.processed_file_id}' 不存在")

    df = pd.read_parquet(parquet_path)
    try:
        charts_data = chart_engine.compute_ai_charts(df, req.chart_configs)
        chart_items = [
            ChartDataItem(
                id=c["id"], type=c["type"], title=c["title"],
                description=c["description"], data=c["data"], config=c["config"],
            )
            for c in charts_data
        ]
        return AIChartResponse(charts=chart_items, error=None)
    except Exception as e:
        return AIChartResponse(charts=[], error=str(e))


@app.post("/api/ai/clean", response_model=AICleanResponse)
async def ai_clean(req: AICleanRequest):
    parquet_path = TEMP_DIR / f"{req.file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{req.file_id}' 不存在，请先上传")

    df = pd.read_parquet(parquet_path)
    columns = list(df.columns)
    sample_rows = df.head(5).fillna("").to_dict(orient="records")
    error_msg = ""
    code = ""

    # Retry loop: max 3 attempts
    for attempt in range(3):
        try:
            code = ai_service.generate_cleaning_code(
                columns, sample_rows,
                req.api_endpoint, req.api_key, req.model,
                error_msg=error_msg,
            )
            result_df, stdout, err = CodeExecutor.execute(code, df)
            if err:
                error_msg = err[:800]
                continue
            if result_df is None:
                error_msg = "代码执行后未返回DataFrame"
                continue

            # Success: save cleaned data
            cleaned_id = f"{req.file_id}_ai_cleaned"
            result_df.to_parquet(TEMP_DIR / f"{cleaned_id}.parquet", index=False)

            return AICleanResponse(
                success=True,
                cleaned_file_id=cleaned_id,
                preview_rows=result_df.head(20).fillna("").to_dict(orient="records"),
                columns=list(result_df.columns),
                summary={
                    "original_rows": len(df),
                    "cleaned_rows": len(result_df),
                    "original_cols": len(df.columns),
                    "cleaned_cols": len(result_df.columns),
                    "rows_removed": len(df) - len(result_df),
                    "attempts": attempt + 1,
                },
                error=None,
            )
        except Exception as e:
            error_msg = str(e)[:500]

    return AICleanResponse(
        success=False,
        error=f"AI清洗失败（尝试{3}次）: {error_msg[:300]}",
        preview_rows=sample_rows,
        columns=columns,
        summary={"attempts": 3},
    )


@app.post("/api/ai/chart-code", response_model=AIChartCodeResponse)
async def ai_chart_code(req: AIChartCodeRequest):
    parquet_path = TEMP_DIR / f"{req.processed_file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"处理后的文件 '{req.processed_file_id}' 不存在")

    df = pd.read_parquet(parquet_path)
    columns = list(df.columns)
    sample_rows = df.head(5).fillna("").to_dict(orient="records")
    error_msg = ""
    all_charts = []

    for attempt in range(3):
        try:
            code = ai_service.generate_chart_code(
                columns, sample_rows,
                req.api_endpoint, req.api_key, req.model,
                error_msg=error_msg,
            )
            charts = CodeExecutor.execute_charts(code, df)
            if not charts:
                error_msg = "代码执行后未生成图表数据（请确保将结果赋值给 charts 变量）"
                continue

            chart_items = [
                ChartDataItem(
                    id=c.get("id", f"ai_chart_{i}"),
                    type=c.get("type", "bar"),
                    title=c.get("title", "AI图表"),
                    description=c.get("description", ""),
                    data=c.get("data", []),
                    config=c.get("config", {}),
                )
                for i, c in enumerate(charts)
            ]
            return AIChartCodeResponse(success=True, charts=chart_items, error=None)
        except Exception as e:
            error_msg = str(e)[:500]

    return AIChartCodeResponse(
        success=False,
        charts=[],
        error=f"AI图表生成失败（尝试{3}次）: {error_msg[:300]}",
    )


# ============================================================
# 新增端点：智能剖析
# ============================================================

@app.post("/api/profile/{file_id}", response_model=ProfileResponse)
async def profile_data(file_id: str):
    """对已上传文件执行智能剖析"""
    parquet_path = TEMP_DIR / f"{file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{file_id}' 不存在，请先上传")

    df = pd.read_parquet(parquet_path)
    result = data_profiler.profile(df)
    result["file_id"] = file_id
    return ProfileResponse(**result)


# ============================================================
# 新增端点：字段映射推荐
# ============================================================

@app.post("/api/mapping/suggest", response_model=MappingSuggestionResponse)
async def suggest_mappings(req: MappingSuggestionRequest):
    """获取列映射建议（基于模糊列名+数据模式评分）"""
    parquet_path = TEMP_DIR / f"{req.file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{req.file_id}' 不存在，请先上传")

    df = pd.read_parquet(parquet_path)
    profile_result = data_profiler.profile(df)

    result = mapping_service.suggest_mappings(df, req.domain, profile_result["columns"])
    result["file_id"] = req.file_id
    return MappingSuggestionResponse(**result)


# ============================================================
# 新增端点：确认映射并执行清洗
# ============================================================

@app.post("/api/mapping/confirm", response_model=CleanResponse)
async def confirm_mapping(req: MappingConfirmRequest):
    """提交用户确认的映射，执行第1-3层清洗"""
    parquet_path = TEMP_DIR / f"{req.file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{req.file_id}' 不存在，请先上传")

    try:
        df = pd.read_parquet(parquet_path)
        profile_result = data_profiler.profile(df)

        clean_result = cleaning_service.clean(
            df,
            domain=req.domain,
            column_profiles=profile_result["columns"],
            mapping={c.original_col: c.mapped_to for c in req.confirmations if c.mapped_to},
            enabled_layers=["type_coercion", "universal", "dedup"],
        )

        cleaned_id = f"{req.file_id}_cleaned"
        clean_result["dataframe"].to_parquet(TEMP_DIR / f"{cleaned_id}.parquet", index=False)

        preview_rows = clean_result["dataframe"].head(20).fillna("").to_dict(orient="records")
        columns = list(clean_result["dataframe"].columns)
        layer_reports = [LayerReport(**lr) for lr in clean_result["layer_reports"]]

        return CleanResponse(
            cleaned_file_id=cleaned_id,
            preview_rows=preview_rows,
            columns=columns,
            layer_reports=layer_reports,
            summary=clean_result["summary"],
        )
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        detail = f"数据处理失败: {str(e)[:500]}"
        print(f"ERROR in /api/mapping/confirm: {traceback.format_exc()}")
        raise HTTPException(500, detail)


# ============================================================
# 新增端点：去重键自动检测
# ============================================================

@app.get("/api/clean/dedup-keys/{file_id}", response_model=DedupKeysResponse)
async def detect_dedup_keys(file_id: str):
    """自动检测候选去重键列"""
    parquet_path = TEMP_DIR / f"{file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{file_id}' 不存在，请先上传")

    df = pd.read_parquet(parquet_path)
    candidates_raw = cleaning_service.detect_dedup_keys(df)
    candidates = [DedupKeyCandidate(**c) for c in candidates_raw]
    return DedupKeysResponse(file_id=file_id, candidates=candidates)


# ============================================================
# 新增端点：自定义清洗规则
# ============================================================

@app.post("/api/clean/custom", response_model=CleanResponse)
async def apply_custom_cleaning(req: CleanRequest):
    """应用自定义清洗规则（仅第4层）"""
    parquet_path = TEMP_DIR / f"{req.file_id}.parquet"
    if not parquet_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, f"文件 '{req.file_id}' 不存在，请先清洗后再试")

    df = pd.read_parquet(parquet_path)
    custom_rules = [r.model_dump() for r in req.custom_rules]

    clean_result = cleaning_service.clean(
        df,
        custom_rules=custom_rules,
        enabled_layers=["custom"],
    )

    cleaned_id = f"{req.file_id}_custom"
    clean_result["dataframe"].to_parquet(TEMP_DIR / f"{cleaned_id}.parquet", index=False)

    preview_rows = clean_result["dataframe"].head(20).fillna("").to_dict(orient="records")
    columns = list(clean_result["dataframe"].columns)
    layer_reports = [LayerReport(**lr) for lr in clean_result["layer_reports"]]

    return CleanResponse(
        cleaned_file_id=cleaned_id,
        preview_rows=preview_rows,
        columns=columns,
        layer_reports=layer_reports,
        summary=clean_result["summary"],
    )


# ============================================================
# 新增端点：填充策略
# ============================================================

@app.get("/api/fill-strategies/{domain}")
async def get_fill_strategies(domain: str):
    """获取某领域的填充策略"""
    try:
        strategies = cleaning_service.get_fill_strategies(domain)
        return {"domain": domain, **strategies}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(404, f"领域 '{domain}' 的填充策略不存在: {str(e)}")


@app.post("/api/fill-strategies/{domain}")
async def update_fill_strategies(domain: str, strategies: dict):
    """更新某领域的填充策略（用户自定义）"""
    try:
        cleaning_service.save_fill_strategies(domain, strategies)
        return {"success": True, "domain": domain}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(500, f"保存填充策略失败: {str(e)}")


