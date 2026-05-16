import re
from pathlib import Path

import pandas as pd
import numpy as np


class DataProcessor:
    def __init__(self, temp_dir: Path):
        self.temp_dir = temp_dir

    def process(
        self, df: pd.DataFrame, domain_cfg: dict
    ) -> tuple[pd.DataFrame, dict, dict, dict]:
        field_mappings = domain_cfg.get("field_mappings", {})
        fill_strategies = domain_cfg.get("fill_strategies", {})

        # Step 0: Dedup first
        before_dedup = len(df)
        df = df.drop_duplicates()
        dedup_removed = before_dedup - len(df)

        # Step 1: Map columns (exact + fuzzy)
        df_mapped, mapping_report = self.map_columns(df, field_mappings)

        # Step 2: Fill missing values
        df_filled, fill_report = self.fill_missing(df_mapped, fill_strategies)

        # Step 3: Strip whitespace from string columns
        for col in df_filled.select_dtypes(include=["object", "string"]).columns:
            df_filled[col] = df_filled[col].astype(str).str.strip()

        # Summary
        numeric_cols = df_filled.select_dtypes(include=["number"]).columns.tolist()
        categorical_cols = df_filled.select_dtypes(
            include=["object", "category", "string"]
        ).columns.tolist()
        date_cols = []
        for col in df_filled.columns:
            if col in categorical_cols:
                try:
                    s = df_filled[col].dropna()
                    if len(s) > 0:
                        pd.to_datetime(s.iloc[:10], errors="raise")
                        date_cols.append(col)
                except (ValueError, TypeError):
                    pass

        summary = {
            "total_records": len(df_filled),
            "total_fields": len(df_filled.columns),
            "mapped_fields": len(mapping_report),
            "dedup_removed": dedup_removed,
            "numeric_fields": numeric_cols,
            "categorical_fields": categorical_cols,
            "date_fields": date_cols,
            "domain": domain_cfg.get("name", ""),
        }

        return df_filled, mapping_report, fill_report, summary

    # Column name patterns that should NOT match certain field types
    _id_patterns = ['id', '编号', '代码', 'code', '账号', '账户', 'account', 'no', '号码']
    _location_patterns = ['国家', '省', '市', '区', '县', '地区', '地点', '地址', '位置', 'city', 'region', 'country', 'province', 'location', 'address', '收货', '发货']
    _time_patterns = ['日期', '时间', 'date', 'time', '年', '月', '日']

    def _has_id_pattern(self, col: str) -> bool:
        return any(p in col.lower() for p in self._id_patterns)

    def _has_location_pattern(self, col: str) -> bool:
        return any(p in col.lower() for p in self._location_patterns)

    def _has_time_pattern(self, col: str) -> bool:
        return any(p in col.lower() for p in self._time_patterns)

    def _should_skip_match(self, col_name: str, standard_name: str) -> bool:
        """Negative matching: prevent clearly wrong mappings."""
        c = col_name.lower()
        # ID columns should NOT match name/category/description
        if self._has_id_pattern(c) and standard_name in ('name', 'category', 'description', 'channel'):
            return True
        # Location columns should NOT match quantity/amount/name
        if self._has_location_pattern(c) and standard_name in ('quantity', 'amount', 'name', 'age', 'gender'):
            return True
        # Time columns should only match date
        if self._has_time_pattern(c) and standard_name not in ('date',):
            # Unless the column also has non-time context
            if standard_name in ('quantity', 'amount', 'name'):
                return True
        return False

    def _fuzzy_match(self, col_name: str, synonyms: list[str]) -> bool:
        """Strict fuzzy match: exact, substring (min 50% length), or cleaned match."""
        c = col_name.lower().strip()
        for s in synonyms:
            s_low = s.lower().strip()
            if c == s_low:
                return True
            # Substring with length constraint: shorter >= 50% of longer
            shorter = c if len(c) <= len(s_low) else s_low
            longer = s_low if shorter == c else c
            if len(shorter) >= max(2, len(longer) * 0.5):
                if shorter in longer:
                    return True
            # Cleaned match
            c_clean = re.sub(r'[_\-\s/\(\)（）　]', '', c)
            s_clean = re.sub(r'[_\-\s/\(\)（）　]', '', s_low)
            if len(c_clean) >= 2 and c_clean == s_clean:
                return True
        return False

    def map_columns(
        self, df: pd.DataFrame, field_mappings: dict[str, list[str]]
    ) -> tuple[pd.DataFrame, dict]:
        mapping_report = {}
        df = df.copy()
        used_std = set()   # Standard names already assigned
        used_orig = set()  # Original column names already mapped

        for standard_name, synonyms in field_mappings.items():
            if standard_name in used_std:
                continue

            if standard_name in df.columns:
                mapping_report[standard_name] = standard_name
                used_std.add(standard_name)
                continue

            for col in df.columns:
                if col in used_orig:
                    continue
                if standard_name in used_std:
                    break
                if self._should_skip_match(col, standard_name):
                    continue
                if self._fuzzy_match(col, synonyms):
                    # For date: handle multiple time columns by keeping first as "date", rest keep original name
                    if standard_name == 'date' and standard_name in df.columns:
                        # Date already mapped, skip this one - keep original name
                        break
                    df.rename(columns={col: standard_name}, inplace=True)
                    mapping_report[standard_name] = col
                    used_std.add(standard_name)
                    used_orig.add(col)
                    break

        return df, mapping_report

    def fill_missing(
        self, df: pd.DataFrame, fill_strategies: dict
    ) -> tuple[pd.DataFrame, dict]:
        df = df.copy()
        fill_report = {}

        # Auto-fill numeric columns with median even if not in strategy
        for col in df.select_dtypes(include=["number"]).columns:
            if col not in fill_strategies:
                null_count = int(df[col].isna().sum())
                if null_count > 0:
                    med = df[col].median()
                    if not pd.isna(med):
                        df[col] = df[col].fillna(med)
                        fill_report[col] = {"filled": null_count, "method": "median (auto)", "fill_value": round(float(med), 2)}

        # Auto-fill object columns with mode
        for col in df.select_dtypes(include=["object", "string"]).columns:
            if col not in fill_strategies:
                null_count = int(df[col].isna().sum())
                if null_count > 0:
                    modes = df[col].mode()
                    if len(modes) > 0:
                        df[col] = df[col].fillna(modes[0])
                        fill_report[col] = {"filled": null_count, "method": "mode (auto)", "fill_value": str(modes[0])}

        # Apply explicit strategies
        for field, strategy in fill_strategies.items():
            if field not in df.columns:
                continue

            method = strategy.get("method", "mode")
            fallback = strategy.get("fallback")
            specific_value = strategy.get("value")

            null_count = int(df[field].isna().sum())
            if null_count == 0:
                if field not in fill_report:
                    fill_report[field] = {"filled": 0, "method": method, "fill_value": None}
                continue

            fill_value = None
            try:
                if method == "median":
                    fill_value = df[field].median()
                    if pd.isna(fill_value):
                        fill_value = fallback
                elif method == "mean":
                    fill_value = df[field].mean()
                    if pd.isna(fill_value):
                        fill_value = fallback
                elif method == "mode":
                    modes = df[field].mode()
                    fill_value = modes[0] if len(modes) > 0 else fallback
                elif method == "ffill":
                    df[field] = df[field].ffill()
                elif method == "bfill":
                    df[field] = df[field].bfill()
                elif method == "specific":
                    fill_value = specific_value if specific_value is not None else fallback
                else:
                    fill_value = fallback
            except Exception:
                fill_value = fallback

            if method not in ("ffill", "bfill"):
                df[field] = df[field].fillna(fill_value)

            remaining = int(df[field].isna().sum())
            filled_now = null_count - remaining

            fill_report[field] = {
                "filled": filled_now,
                "method": method,
                "fill_value": (
                    fill_value
                    if not isinstance(fill_value, float) or not np.isnan(float(fill_value))
                    else None
                ),
            }

        return df, fill_report
