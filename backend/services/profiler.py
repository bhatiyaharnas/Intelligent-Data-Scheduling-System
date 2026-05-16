import json
import re
from pathlib import Path
from typing import Any

import pandas as pd
import numpy as np


class DataProfiler:
    """智能数据剖析器：推断数据类型、语义类型、生成质量报告"""

    SAMPLE_SIZE = 5000
    SEMANTIC_SAMPLE_SIZE = 1000

    def __init__(self, patterns_config_path: Path | None = None):
        if patterns_config_path is None:
            patterns_config_path = Path(__file__).parent.parent / "config" / "semantic_patterns.json"
        with open(patterns_config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        self.patterns: dict[str, dict] = config["patterns"]
        self.column_keywords: dict[str, list[str]] = config["column_name_keywords"]
        self.rules: dict = config["type_detection_rules"]

    @staticmethod
    def _normalize_dtypes(df: pd.DataFrame) -> pd.DataFrame:
        """将 nullable dtypes 和 Categorical 转为标准 pandas 类型"""
        df = df.copy()
        for col in df.columns:
            dtype_str = str(df[col].dtype)
            if dtype_str in ('Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64'):
                df[col] = df[col].astype('float64')
            elif dtype_str in ('Float32', 'Float64'):
                df[col] = df[col].astype('float64')
            elif dtype_str in ('string', 'StringDtype'):
                df[col] = df[col].astype('object')
            elif isinstance(df[col].dtype, pd.CategoricalDtype):
                df[col] = df[col].astype('object')
        return df

    def profile(self, df: pd.DataFrame) -> dict:
        """对 DataFrame 执行完整剖析，返回结构化结果"""
        df = self._normalize_dtypes(df)
        df_sample = df.head(self.SAMPLE_SIZE).copy()
        total_rows = len(df)
        total_cols = len(df.columns)
        total_cells = total_rows * total_cols

        column_profiles = []
        for col in df_sample.columns:
            col_profile = self._profile_column(df_sample, col)
            column_profiles.append(col_profile)

        total_missing = int(df_sample.isna().sum().sum())
        duplicate_rows = int(df_sample.duplicated().sum())

        health = {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "total_missing": total_missing,
            "total_missing_rate": round(total_missing / total_cells, 4) if total_cells else 0,
            "duplicate_row_count": duplicate_rows,
            "duplicate_row_rate": round(duplicate_rows / total_rows, 4) if total_rows else 0,
            "constant_columns": [c["col_name"] for c in column_profiles if c["is_constant"]],
            "suspicious_columns": self._detect_suspicious_columns(df_sample, column_profiles),
            "health_score": self._compute_health_score(total_rows, total_cols, total_missing, duplicate_rows, column_profiles),
        }

        return {
            "columns": column_profiles,
            "health": health,
            "preview_rows": df.head(20).fillna("").to_dict(orient="records"),
        }

    def _profile_column(self, df: pd.DataFrame, col: str) -> dict:
        series = df[col]
        null_count = int(series.isna().sum())
        total = len(series)
        null_rate = round(null_count / total, 4) if total else 0

        pandas_dtype = str(series.dtype)
        unique_count = int(series.nunique())
        cardinality_ratio = round(unique_count / (total - null_count), 4) if (total - null_count) > 0 else 0
        is_constant = unique_count <= 1

        non_null = series.dropna()
        sample_values = non_null.head(10).tolist() if len(non_null) > 0 else []

        semantic_type, semantic_confidence = self._infer_semantic_type(series, col)

        return {
            "col_name": col,
            "pandas_dtype": pandas_dtype,
            "semantic_type": semantic_type,
            "semantic_confidence": round(semantic_confidence, 4),
            "unique_count": unique_count,
            "null_count": null_count,
            "null_rate": null_rate,
            "cardinality_ratio": cardinality_ratio,
            "sample_values": sample_values[:5],
            "is_constant": is_constant,
        }

    def _infer_semantic_type(self, series: pd.Series, col_name: str) -> tuple[str, float]:
        """推断列的语义类型，返回 (类型名, 置信度)"""
        non_null = series.dropna()
        if len(non_null) == 0:
            return "empty", 1.0

        sample = non_null.head(self.SEMANTIC_SAMPLE_SIZE).astype(str).str.strip()

        best_type = "text"
        best_score = 0.0

        col_lower = col_name.lower()

        for type_name, pattern_def in self.patterns.items():
            if "regex" not in pattern_def:
                continue

            # 要求列名关键词的地理类型（经纬度等），没有关键词则跳过
            if pattern_def.get("require_column_keyword"):
                required_kws = pattern_def.get("column_keywords", [])
                if not any(kw in col_lower for kw in required_kws):
                    continue

            try:
                regex = re.compile(pattern_def["regex"], re.IGNORECASE)
            except re.error:
                continue

            match_count = 0
            test_count = min(len(sample), self.SEMANTIC_SAMPLE_SIZE)
            for val in sample.head(test_count):
                if regex.match(str(val)):
                    match_count += 1

            match_rate = match_count / test_count if test_count > 0 else 0
            base_confidence = pattern_def.get("confidence", 0.8)

            # 列名关键词加分
            keyword_bonus = 0.0
            for category, keywords in self.column_keywords.items():
                if category in type_name or type_name.startswith(category):
                    if any(kw in col_lower for kw in keywords):
                        keyword_bonus = 0.15
                        break

            score = match_rate * base_confidence + keyword_bonus
            score = min(score, 1.0)

            if score > best_score and match_rate >= self.rules["semantic_min_match_rate"]:
                best_score = score
                best_type = type_name

        if best_score < 0.3:
            best_type = self._infer_base_type(series)

        if best_score < 0.3:
            best_score = 0.5

        return best_type, best_score

    def _infer_base_type(self, series: pd.Series) -> str:
        """推断基础数据类型（降级逻辑）"""
        non_null = series.dropna()
        if len(non_null) == 0:
            return "empty"

        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"

        if pd.api.types.is_bool_dtype(series):
            return "boolean"

        if pd.api.types.is_integer_dtype(series):
            return "integer"

        if pd.api.types.is_float_dtype(series):
            return "float"

        if pd.api.types.is_numeric_dtype(series):
            return "numeric"

        sample = non_null.head(200).astype(str).str.strip()

        # 尝试日期检测
        date_count = 0
        for val in sample:
            try:
                pd.to_datetime(val)
                date_count += 1
            except (ValueError, TypeError):
                pass
        if date_count / len(sample) >= self.rules["date_column_threshold"]:
            return "date"

        # 尝试数值检测
        num_count = 0
        for val in sample:
            try:
                cleaned = re.sub(r'[,\s]', '', str(val))
                float(cleaned)
                num_count += 1
            except (ValueError, TypeError):
                pass
        if num_count / len(sample) >= self.rules["numeric_column_threshold"]:
            return "numeric"

        return "text"

    def _detect_suspicious_columns(self, df: pd.DataFrame, column_profiles: list[dict]) -> list[dict]:
        """检测可疑列"""
        suspicious = []

        for cp in column_profiles:
            col = cp["col_name"]
            series = df[col]

            # 数值列中包含非数字字符串
            if cp["pandas_dtype"] in ("int64", "float64", "Int64", "Float64"):
                non_null = series.dropna().head(500)
                junk_count = 0
                for val in non_null:
                    try:
                        float(val)
                    except (ValueError, TypeError):
                        junk_count += 1
                if junk_count > 0:
                    suspicious.append({
                        "col_name": col,
                        "issue": f"数值列中发现 {junk_count} 个非数字值（如N/A、-、空字符串等）",
                        "severity": "warning",
                    })

            # 高空值率
            if cp["null_rate"] > self.rules["suspicious_null_ratio"]:
                suspicious.append({
                    "col_name": col,
                    "issue": f"空值率高达 {cp['null_rate']:.1%}",
                    "severity": "warning" if cp["null_rate"] < 0.8 else "error",
                })

            # 常量列
            if cp["is_constant"]:
                suspicious.append({
                    "col_name": col,
                    "issue": "常量列（仅含一个唯一值），可能无分析价值",
                    "severity": "warning",
                })

            # 超高基数文本列
            if cp["semantic_type"] == "text" and cp["cardinality_ratio"] > 0.95 and cp["unique_count"] > 100:
                suspicious.append({
                    "col_name": col,
                    "issue": f"文本列基数极高（{cp['unique_count']} 个唯一值），可能为自由文本或 ID",
                    "severity": "warning",
                })

        return suspicious

    def _compute_health_score(
        self, total_rows: int, total_cols: int, total_missing: int,
        duplicate_rows: int, column_profiles: list[dict],
    ) -> int:
        """计算综合健康评分 (0-100)"""
        score = 100
        total_cells = total_rows * total_cols if total_rows > 0 else 1

        # 缺失率惩罚
        missing_rate = total_missing / total_cells
        score -= int(missing_rate * 60)

        # 重复率惩罚
        dup_rate = duplicate_rows / total_rows if total_rows > 0 else 0
        score -= int(dup_rate * 40)

        # 常量列惩罚
        constant_count = sum(1 for c in column_profiles if c["is_constant"])
        if total_cols > 0:
            score -= int((constant_count / total_cols) * 20)

        # 可疑列惩罚
        suspicious_count = sum(1 for c in column_profiles if c["semantic_type"] == "text" and c["null_rate"] > 0.5)
        score -= suspicious_count * 3

        return max(0, min(100, score))

    def get_field_categories(self, column_profiles: list[dict]) -> dict[str, list[str]]:
        """根据剖析结果将列分为：日期、数值、分类、文本、布尔"""
        date_cols = []
        numeric_cols = []
        categorical_cols = []
        text_cols = []
        boolean_cols = []

        for cp in column_profiles:
            st = cp["semantic_type"]
            if st in ("date", "date_iso", "date_slash", "date_dot", "date_cn", "datetime", "datetime_iso"):
                date_cols.append(cp["col_name"])
            elif st in ("integer", "float", "numeric", "number_with_separator", "percentage",
                        "currency_rmb", "currency_usd", "currency_eur", "currency_general"):
                numeric_cols.append(cp["col_name"])
            elif st in ("boolean_en", "boolean_cn", "boolean_numeric", "boolean"):
                boolean_cols.append(cp["col_name"])
            elif st in ("email", "phone_cn_mobile", "phone_cn_landline", "phone_general", "url",
                        "ip_address_v4", "uuid", "id_number_cn", "unified_social_credit_code",
                        "zip_cn", "bank_card_number", "gender_label", "province_cn", "color_hex",
                        "longitude", "latitude"):
                categorical_cols.append(cp["col_name"])
            elif st == "text":
                if cp["cardinality_ratio"] < 0.3 and cp["unique_count"] <= 50:
                    categorical_cols.append(cp["col_name"])
                else:
                    text_cols.append(cp["col_name"])
            else:
                text_cols.append(cp["col_name"])

        return {
            "date": date_cols,
            "numeric": numeric_cols,
            "categorical": categorical_cols,
            "text": text_cols,
            "boolean": boolean_cols,
        }
