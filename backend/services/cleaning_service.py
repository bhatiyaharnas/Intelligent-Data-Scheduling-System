import re
from pathlib import Path
from typing import Any

import pandas as pd
import numpy as np


class CleaningService:
    """4层智能清洗管道：类型强制 → 通用清洗 → 去重 → 自定义规则"""

    # 不可见字符
    _INVISIBLE_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]')

    # 常见空值表示
    _NULL_VARIANTS = {'', 'null', 'NULL', 'None', 'none', 'N/A', 'n/a', 'NA', 'na', '-', '--', '...', 'NaN', 'nan', '无', '空', '缺失'}

    def __init__(self, temp_dir: Path | None = None, fill_strategies_path: Path | None = None):
        self.temp_dir = temp_dir
        if fill_strategies_path is None:
            fill_strategies_path = Path(__file__).parent.parent / "config" / "fill_strategies.json"
        self._fill_strategies_path = fill_strategies_path
        self._fill_strategies: dict | None = None

    def _load_fill_strategies(self) -> dict:
        if self._fill_strategies is None:
            import json
            with open(self._fill_strategies_path, "r", encoding="utf-8") as f:
                self._fill_strategies = json.load(f)
        return self._fill_strategies

    def get_fill_strategies(self, domain: str) -> dict:
        data = self._load_fill_strategies()
        if domain not in data:
            domain = "general"
        return data[domain]

    def save_fill_strategies(self, domain: str, strategies: dict) -> None:
        import json
        data = self._load_fill_strategies()
        data[domain] = strategies
        with open(self._fill_strategies_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self._fill_strategies = data

    @staticmethod
    def _normalize_dtypes(df: pd.DataFrame) -> pd.DataFrame:
        """将 nullable dtypes / Categorical 转为标准 pandas 类型"""
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

    def clean(
        self,
        df: pd.DataFrame,
        domain: str = "general",
        column_profiles: list[dict] | None = None,
        mapping: dict[str, str] | None = None,
        custom_rules: list[dict] | None = None,
        dedup_keys: list[str] | None = None,
        enabled_layers: list[str] | None = None,
    ) -> dict:
        """执行多层清洗，返回清洗后的 DataFrame 和每层报告"""
        if enabled_layers is None:
            enabled_layers = ["type_coercion", "universal", "dedup"]

        df_clean = self._normalize_dtypes(df)
        column_profiles = column_profiles or []
        # 同步更新 column_profiles 中的 pandas_dtype
        for cp in column_profiles:
            if cp["col_name"] in df_clean.columns:
                cp["pandas_dtype"] = str(df_clean[cp["col_name"]].dtype)
        layer_reports = []
        mapping = mapping or {}

        rows_before = len(df_clean)

        if "type_coercion" in enabled_layers:
            df_clean, type_report = self._layer_type_coercion(df_clean, column_profiles)
            layer_reports.append(type_report)

        if "universal" in enabled_layers:
            df_clean, univ_report = self._layer_universal(df_clean, domain, mapping)
            layer_reports.append(univ_report)

        if "dedup" in enabled_layers:
            df_clean, dedup_report = self._layer_dedup(df_clean, dedup_keys)
            layer_reports.append(dedup_report)

        if "custom" in enabled_layers and custom_rules:
            df_clean, custom_report = self._layer_custom(df_clean, custom_rules)
            layer_reports.append(custom_report)

        rows_after = len(df_clean)
        summary = {
            "rows_before": rows_before,
            "rows_after": rows_after,
            "rows_removed": rows_before - rows_after,
            "columns_count": len(df_clean.columns),
        }

        return {
            "dataframe": df_clean,
            "layer_reports": layer_reports,
            "summary": summary,
        }

    @staticmethod
    def _fullwidth_to_halfwidth(text: str) -> str:
        """将全角字符转换为半角（基于 Unicode 码点偏移）"""
        if not isinstance(text, str):
            return text
        result = []
        for ch in text:
            code = ord(ch)
            if code == 0x3000:  # 全角空格
                result.append(' ')
            elif 0xFF01 <= code <= 0xFF5E:  # 全角 ASCII 可打印字符
                result.append(chr(code - 0xFEE0))
            else:
                result.append(ch)
        return ''.join(result)

    @staticmethod
    def _parse_date_multi_format(series: pd.Series) -> pd.Series:
        """多格式日期解析，依次尝试常见格式"""
        formats = [
            "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
            "%d/%m/%Y", "%m/%d/%Y",
            "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",
            "%Y年%m月%d日", "%Y年%m月%d日 %H:%M:%S",
        ]
        result = pd.Series([pd.NaT] * len(series), index=series.index)
        remaining = series.notna()
        for fmt in formats:
            if not remaining.any():
                break
            parsed = pd.to_datetime(series[remaining], format=fmt, errors="coerce")
            mask = parsed.notna()
            result[parsed[mask].index] = parsed[mask]
            remaining = result.isna() & series.notna()
        # 最后尝试 pandas 自动推断
        if remaining.any():
            parsed = pd.to_datetime(series[remaining], errors="coerce")
            mask = parsed.notna()
            result[parsed[mask].index] = parsed[mask]
        return result

    def _layer_type_coercion(self, df: pd.DataFrame, column_profiles: list[dict]) -> tuple[pd.DataFrame, dict]:
        df = df.copy()
        changes = {}
        profile_map = {c["col_name"]: c for c in column_profiles}

        for col in df.columns:
            col_changes = {}
            cp = profile_map.get(col, {})
            semantic = cp.get("semantic_type", "text")

            # 日期列标准化
            if "date" in semantic or semantic in ("datetime_iso", "date_iso", "date_slash", "date_dot", "date_cn", "datetime", "time_hhmm"):
                original_nulls = int(df[col].isna().sum())
                converted = self._parse_date_multi_format(df[col])
                new_nulls = int(converted.isna().sum())
                if new_nulls <= original_nulls + len(df) * 0.4:
                    df[col] = converted.dt.strftime("%Y-%m-%d")
                    df[col] = df[col].replace("NaT", np.nan)
                    col_changes["date_standardized"] = int((~pd.isna(converted)).sum())

            # 货币/数值列：去除货币符号、千位分隔符
            elif any(t in semantic for t in ("currency", "percentage", "number_with_separator")) or (
                cp.get("pandas_dtype") == "object" and semantic in ("numeric", "float", "integer")
            ):
                original_nulls = int(df[col].isna().sum())
                cleaned = df[col].astype(str).str.strip()
                cleaned = cleaned.replace(self._NULL_VARIANTS, np.nan)
                cleaned = cleaned.str.replace(r'[¥$€£￥,\s]', '', regex=True)
                cleaned = cleaned.str.replace(r'%', '', regex=True)
                cleaned = pd.to_numeric(cleaned, errors="coerce")
                if cleaned.notna().sum() > original_nulls:
                    df[col] = cleaned
                    col_changes["numeric_cleaned"] = int(cleaned.notna().sum())

            # 布尔列统一
            elif "boolean" in semantic:
                bool_map = {
                    "是": True, "否": False, "true": True, "false": False,
                    "yes": True, "no": False, "y": True, "n": False,
                    "真": True, "假": False, "对": True, "错": False,
                    "有": True, "无": False, "1": True, "0": False,
                    "t": True, "f": False, "TRUE": True, "FALSE": False,
                    "YES": True, "NO": False,
                }
                original = df[col].copy()
                df[col] = df[col].astype(str).str.strip().map(bool_map)
                converted = int(df[col].notna().sum())
                if converted > 0:
                    col_changes["boolean_unified"] = converted

            if col_changes:
                changes[col] = col_changes

        return df, {
            "layer": "type_coercion",
            "rows_before": len(df),
            "rows_after": len(df),
            "columns_affected": len(changes),
            "changes": changes,
        }

    # ---- Layer 2: Universal Cleaning ----

    def _layer_universal(self, df: pd.DataFrame, domain: str = "general", mapping: dict[str, str] | None = None) -> tuple[pd.DataFrame, dict]:
        df = df.copy()
        changes = {}

        for col in df.columns:
            col_changes = {}

            if df[col].dtype == object or pd.api.types.is_string_dtype(df[col]):
                series = df[col].astype(str)

                # 1) 统一空值
                before_null = int(df[col].isna().sum())
                series = series.replace(self._NULL_VARIANTS, np.nan)
                after_variant = int(series.isna().sum())

                # 2) 全角转半角
                series = series.apply(self._fullwidth_to_halfwidth)

                # 确保仍是 string-compatible dtype
                if not (series.dtype == object or pd.api.types.is_string_dtype(series)):
                    series = series.astype(str)

                # 3) 去除不可见字符
                series = series.str.replace(self._INVISIBLE_CHARS, '', regex=True)

                # 4) 去除首尾空格 + 多余换行
                series = series.str.strip()
                series = series.str.replace(r'\s*\n\s*', ' ', regex=True)

                # 5) 去除多余空格
                series = series.str.replace(r' {2,}', ' ', regex=True)

                df[col] = series

                null_cleaned = int(series.isna().sum()) - before_null
                if null_cleaned > 0:
                    col_changes["null_normalized"] = null_cleaned
                if col_changes:
                    col_changes["whitespace_cleaned"] = True

            # 数值列也处理空值变体
            elif pd.api.types.is_numeric_dtype(df[col]):
                before_null = int(df[col].isna().sum())
                df[col] = df[col].replace([float('inf'), float('-inf')], np.nan)
                after_clean = int(df[col].isna().sum())
                if after_clean > before_null:
                    col_changes["inf_removed"] = after_clean - before_null

            if col_changes:
                changes[col] = col_changes

        # 6) 域感知缺失值填充
        fill_changes = {}
        mapping = mapping or {}
        reverse_map: dict[str, str] = {v: k for k, v in mapping.items()}

        # 加载该领域的填充策略
        domain_fill = self.get_fill_strategies(domain)
        rules = domain_fill.get("rules", {})

        for col in df.columns:
            null_count = int(df[col].isna().sum())
            if null_count == 0:
                continue

            # 确定该列对应哪个标准字段（通过映射）
            standard_name = reverse_map.get(col, col)

            # 查找填充规则（优先精确匹配，其次回退）
            rule = rules.get(standard_name)

            if rule:
                method = rule.get("method", "median")
                fallback = rule.get("fallback")
                specific_value = rule.get("value")
            else:
                # 无规则时按类型回退
                if pd.api.types.is_numeric_dtype(df[col]):
                    method, fallback, specific_value = "median", None, None
                else:
                    method, fallback, specific_value = "mode", None, None

            fill_value = None
            try:
                if method == "ffill":
                    df[col] = df[col].ffill()
                elif method == "bfill":
                    df[col] = df[col].bfill()
                elif method == "median":
                    fill_value = df[col].median()
                    if pd.isna(fill_value):
                        fill_value = fallback
                elif method == "mean":
                    fill_value = df[col].mean()
                    if pd.isna(fill_value):
                        fill_value = fallback
                elif method == "mode":
                    modes = df[col].mode()
                    fill_value = modes[0] if len(modes) > 0 else fallback
                elif method == "specific":
                    fill_value = specific_value if specific_value is not None else fallback
                else:
                    fill_value = fallback

                if method not in ("ffill", "bfill"):
                    df[col] = df[col].fillna(fill_value)
            except Exception:
                if fallback is not None:
                    df[col] = df[col].fillna(fallback)

            remaining = int(df[col].isna().sum())
            filled = null_count - remaining
            if filled > 0:
                fill_changes[col] = {"filled": filled, "method": method, "rule": standard_name}

        return df, {
            "layer": "universal",
            "rows_before": len(df),
            "rows_after": len(df),
            "columns_affected": len(changes) + len(fill_changes),
            "changes": {**changes, **{f"fill_{k}": v for k, v in fill_changes.items()}},
        }

    # ---- Layer 3: Dedup ----

    def _layer_dedup(self, df: pd.DataFrame, dedup_keys: list[str] | None = None) -> tuple[pd.DataFrame, dict]:
        df = df.copy()
        before = len(df)

        if dedup_keys:
            valid_keys = [k for k in dedup_keys if k in df.columns]
            if valid_keys:
                df = df.drop_duplicates(subset=valid_keys)
        else:
            df = df.drop_duplicates()

        after = len(df)
        return df, {
            "layer": "dedup",
            "rows_before": before,
            "rows_after": after,
            "columns_affected": 0,
            "changes": {"_total": {"rows_removed": before - after, "dedup_keys_used": dedup_keys or "all_columns"}},
        }

    # ---- Layer 4: Custom Rules ----

    def _layer_custom(self, df: pd.DataFrame, custom_rules: list[dict]) -> tuple[pd.DataFrame, dict]:
        df = df.copy()
        changes = {}

        for rule in custom_rules:
            col = rule.get("column", "")
            action = rule.get("action", "")
            params = rule.get("params", {})

            if col not in df.columns:
                continue

            if action == "replace":
                old_val = params.get("old")
                new_val = params.get("new")
                if old_val is not None:
                    mask = df[col].astype(str).str.strip() == str(old_val)
                    count = int(mask.sum())
                    df.loc[mask, col] = new_val
                    changes.setdefault(col, {})["replaced"] = count

            elif action == "fill":
                value = params.get("value")
                count = int(df[col].isna().sum())
                df[col] = df[col].fillna(value)
                changes.setdefault(col, {})["filled"] = count

            elif action == "regex_replace":
                pattern = params.get("pattern", "")
                replacement = params.get("replacement", "")
                if pattern:
                    original = df[col].copy()
                    df[col] = df[col].astype(str).str.replace(pattern, replacement, regex=True)
                    changed = int((original != df[col]).sum())
                    changes.setdefault(col, {})["regex_replaced"] = changed

            elif action == "clip":
                lo = params.get("min")
                hi = params.get("max")
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].clip(lower=lo, upper=hi)
                    changes.setdefault(col, {})["clipped"] = True

        return df, {
            "layer": "custom",
            "rows_before": len(df),
            "rows_after": len(df),
            "columns_affected": len(changes),
            "changes": changes,
        }

    # ---- 去重键自动检测 ----

    @staticmethod
    def detect_dedup_keys(df: pd.DataFrame, column_profiles: list[dict] | None = None) -> list[dict]:
        """自动检测候选去重键：高基数 + 低空值率"""
        candidates = []
        total = len(df)

        for col in df.columns:
            null_count = int(df[col].isna().sum())
            null_rate = null_count / total if total > 0 else 0
            unique_count = int(df[col].nunique())
            cardinality = unique_count / (total - null_count) if (total - null_count) > 0 else 0

            score = 0.0
            if cardinality > 0.9 and null_rate < 0.05:
                score = cardinality * (1 - null_rate)
            elif cardinality > 0.7 and null_rate < 0.1:
                score = cardinality * (1 - null_rate) * 0.7

            if score > 0.5:
                candidates.append({
                    "col_name": col,
                    "cardinality_ratio": round(cardinality, 4),
                    "null_rate": round(null_rate, 4),
                    "score": round(score, 4),
                })

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates
