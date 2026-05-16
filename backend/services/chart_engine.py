import pandas as pd
import numpy as np

from models.schemas import ChartFilter


CHART_REQUIREMENTS = {
    "table": {
        "required_fields": [],
        "value_fields": [],
        "aggregation": "none",
        "max_data_points": 500,
        "min_records": 1,
        "description_template": "数据明细表",
    },
    "bar": {
        "required_fields": [("category", "categorical")],
        "value_fields": [("numeric", ">=1")],
        "aggregation": "sum",
        "max_data_points": 30,
        "min_records": 2,
        "description_template": "{group} 按 {value} 汇总",
    },
    "line": {
        "required_fields": [],
        "value_fields": [("numeric", ">=1")],
        "aggregation": "sum",
        "max_data_points": 60,
        "min_records": 3,
        "description_template": "{value} 变化趋势",
        "auto_resample": True,
    },
    "pie": {
        "required_fields": [("category", "categorical")],
        "value_fields": [("numeric", ">=1")],
        "aggregation": "sum",
        "max_data_points": 12,
        "min_records": 1,
        "description_template": "{group} 占比分布",
    },
    "scatter": {
        "required_fields": [],
        "value_fields": [("numeric", ">=2")],
        "aggregation": "none",
        "max_data_points": 200,
        "min_records": 5,
        "description_template": "{x} 与 {y} 相关性分析",
    },
    "heatmap": {
        "required_fields": [("category", "categorical")],
        "value_fields": [("numeric", ">=1")],
        "additional_fields": [("category", "categorical")],
        "aggregation": "mean",
        "max_data_points": 100,
        "min_records": 10,
        "description_template": "{row} x {col} {value} 热力图",
    },
    "radar": {
        "required_fields": [("category", "categorical")],
        "value_fields": [("numeric", ">=3")],
        "aggregation": "mean",
        "max_data_points": 10,
        "min_records": 3,
        "description_template": "{group} 多维度雷达图",
    },
    "treemap": {
        "required_fields": [("category", "categorical")],
        "value_fields": [("numeric", ">=1")],
        "aggregation": "sum",
        "max_data_points": 50,
        "min_records": 2,
        "description_template": "{group} {value} 矩形树图",
    },
}


class ChartEngine:
    def __init__(self):
        pass

    def recommend_charts(self, df: pd.DataFrame, column_profiles: list[dict]) -> list[dict]:
        """基于字段类型生成图表推荐"""
        profile_map = {c["col_name"]: c for c in column_profiles}
        numeric_cols, categorical_cols, date_cols = self._classify_columns(df)

        # 使用 profiler 提供的更精确分类
        for cp in column_profiles:
            col = cp["col_name"]
            st = cp.get("semantic_type", "")
            if "date" in st and col not in date_cols:
                date_cols.append(col)

        recommendations = []
        used_combos = set()

        # 1) 时间 + 度量 → 折线图
        if date_cols and numeric_cols:
            date_col = self._pick_best_date(df, date_cols)
            val_col = self._pick_best_numeric(df, numeric_cols)
            if date_col and val_col:
                combo = ("line", date_col, val_col)
                if combo not in used_combos:
                    used_combos.add(combo)
                    recommendations.append({
                        "chart_type": "line",
                        "title": f"{val_col} 时间趋势",
                        "x_field": date_col,
                        "y_field": val_col,
                        "priority_score": 0.95,
                        "reason": f"时间列 {date_col} + 度量列 {val_col}，适合展示时变序列趋势",
                    })

        # 2) 低基数维度(≤12) + 度量 → 柱状图 & 饼图
        for cat_col in categorical_cols[:6]:
            n_unique = df[cat_col].nunique()
            if n_unique < 2 or n_unique > 30:
                continue
            val_col = self._pick_best_numeric(df, numeric_cols)
            if not val_col:
                continue

            if n_unique <= 12:
                combo = ("bar", cat_col, val_col)
                if combo not in used_combos and (not self._is_location_field(cat_col) or n_unique <= 5):
                    used_combos.add(combo)
                    recommendations.append({
                        "chart_type": "bar",
                        "title": f"{cat_col} 维度 {val_col} 汇总",
                        "x_field": cat_col,
                        "y_field": val_col,
                        "priority_score": 0.85,
                        "reason": f"分类列 {cat_col}（{n_unique}类）+ {val_col}，适合柱状图对比",
                    })

            if n_unique <= 8:
                combo = ("pie", cat_col, val_col)
                if combo not in used_combos:
                    used_combos.add(combo)
                    recommendations.append({
                        "chart_type": "pie",
                        "title": f"{cat_col} 占比分布",
                        "x_field": cat_col,
                        "y_field": val_col,
                        "priority_score": 0.75,
                        "reason": f"分类列 {cat_col}（{n_unique}类）+ {val_col}，适合饼图展示占比",
                    })

        # 3) 两个度量 → 散点图
        if len(numeric_cols) >= 2:
            f1, f2 = self._pick_scatter_pair(df, numeric_cols)
            if f1 and f2:
                combo = ("scatter", f1, f2)
                if combo not in used_combos:
                    used_combos.add(combo)
                    recommendations.append({
                        "chart_type": "scatter",
                        "title": f"{f1} vs {f2} 相关性",
                        "x_field": f1,
                        "y_field": f2,
                        "priority_score": 0.70,
                        "reason": f"两个度量列 {f1} 与 {f2}，适合散点图探索相关性",
                    })

        # 4) 2个分类 + 度量 → 热力图
        if len(categorical_cols) >= 2 and numeric_cols:
            cat1 = self._pick_best_categorical(df, categorical_cols[:10], 15)
            remaining = [c for c in categorical_cols if c != cat1]
            cat2 = self._pick_best_categorical(df, remaining, 15) if remaining else None
            if cat1 and cat2 and numeric_cols:
                val_col = self._pick_best_numeric(df, numeric_cols)
                combo = ("heatmap", cat1, cat2)
                if combo not in used_combos:
                    used_combos.add(combo)
                    recommendations.append({
                        "chart_type": "heatmap",
                        "title": f"{cat1} x {cat2} {val_col} 交叉分析",
                        "x_field": cat1,
                        "y_field": cat2,
                        "priority_score": 0.65,
                        "reason": f"两个分类列 {cat1}、{cat2} + {val_col}，适合热力图交叉分析",
                    })

        # 5) ≥3个度量 + 分类 → 雷达图
        if len(numeric_cols) >= 3 and categorical_cols:
            cat_col = self._pick_best_categorical(df, categorical_cols, 8)
            if cat_col:
                combo = ("radar", cat_col, ",".join(numeric_cols[:4]))
                if combo not in used_combos:
                    used_combos.add(combo)
                    recommendations.append({
                        "chart_type": "radar",
                        "title": f"{cat_col} 多维度雷达图",
                        "x_field": cat_col,
                        "y_field": ",".join(numeric_cols[:4]),
                        "priority_score": 0.60,
                        "reason": f"多度量列 + 分类列 {cat_col}，适合雷达图多维对比",
                    })

        # 6) 单度量 → 高基数维度 → 排名条形图
        if numeric_cols and categorical_cols:
            for cat_col in categorical_cols[:4]:
                n_unique = df[cat_col].nunique()
                if 12 < n_unique <= 50:
                    val_col = self._pick_best_numeric(df, numeric_cols)
                    combo = ("bar", cat_col, val_col)
                    if combo not in used_combos:
                        used_combos.add(combo)
                        recommendations.append({
                            "chart_type": "bar",
                            "title": f"{cat_col} Top排名(按{val_col})",
                            "x_field": cat_col,
                            "y_field": val_col,
                            "priority_score": 0.55,
                            "reason": f"高基数列 {cat_col}（{n_unique}类）+ {val_col}，适合排名条形图",
                        })
                    break

        recommendations.sort(key=lambda x: x["priority_score"], reverse=True)
        return recommendations

    def generate_charts_from_recommendations(
        self, df: pd.DataFrame, recommendations: list[dict], limit: int = 50,
    ) -> tuple[list, list, dict]:
        """按推荐逐条生成图表：N 条推荐 → N 个图表（不复用，不覆盖）"""
        numeric_cols, categorical_cols, date_cols = self._classify_columns(df)
        charts_data = []
        skipped = []

        # 始终生成数据明细表（L1 标签页使用）
        table_req = CHART_REQUIREMENTS.get("table")
        if table_req:
            try:
                table_data = self._build_table(df, table_req, limit)
                table_data["id"] = "chart_table_0"
                table_data["config"]["rec_index"] = -1  # 不属于任何推荐
                charts_data.append(table_data)
            except Exception:
                pass

        for i, rec in enumerate(recommendations):
            chart_type = rec.get("chart_type", "bar")
            req = CHART_REQUIREMENTS.get(chart_type)
            if not req:
                skipped.append({"type": chart_type, "applicable": False, "reason": f"不支持的图表类型"})
                continue

            x_field = rec.get("x_field", "")
            y_field = rec.get("y_field", "")
            if not x_field or not y_field or x_field not in df.columns or y_field not in df.columns:
                skipped.append({"type": chart_type, "applicable": False, "reason": f"字段不存在: x={x_field}, y={y_field}"})
                continue

            try:
                chart_data = self._compute_chart_data(
                    chart_type, req, df,
                    numeric_cols, categorical_cols, date_cols, limit,
                    override_x=x_field, override_y=y_field,
                )
                if chart_data:
                    chart_data["id"] = f"chart_{chart_type}_{i}_{x_field}_{y_field}"
                    chart_data["config"]["rec_index"] = i
                    chart_data["title"] = rec.get("title", chart_data.get("title", ""))
                    charts_data.append(chart_data)
                else:
                    skipped.append({
                        "type": chart_type, "applicable": False,
                        "reason": f"字段组合无法生成图表 (x={x_field}, y={y_field})",
                    })
            except Exception as e:
                skipped.append({"type": chart_type, "applicable": False, "reason": str(e)})

        summary = {
            "total_records": len(df),
            "total_fields": len(df.columns),
            "numeric_fields": numeric_cols,
            "categorical_fields": categorical_cols,
            "date_fields": date_cols,
        }

        return charts_data, skipped, summary

    def apply_filters(self, df: pd.DataFrame, filter_req: ChartFilter) -> pd.DataFrame:
        df = df.copy()
        date_cols = self._detect_dates(df)

        if filter_req.date_from and date_cols:
            date_col = date_cols[0]
            df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
            df = df[df[date_col] >= pd.Timestamp(filter_req.date_from)]
        if filter_req.date_to and date_cols:
            date_col = date_cols[0]
            df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
            df = df[df[date_col] <= pd.Timestamp(filter_req.date_to)]

        for field, value in (filter_req.filters or {}).items():
            if field in df.columns and value:
                df = df[df[field].astype(str) == str(value)]

        return df

    def _classify_columns(self, df: pd.DataFrame) -> tuple[list, list, list]:
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        numeric_cols = [
            c
            for c in numeric_cols
            if not any(
                kw in c.lower() for kw in ["id", "编号", "代码", "code", "index"]
            )
        ]
        if not numeric_cols:
            numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

        categorical_cols = df.select_dtypes(
            include=["object", "category", "string"]
        ).columns.tolist()

        date_cols = self._detect_dates(df)

        # Deduplicate: remove date columns from categorical_cols
        categorical_cols = [c for c in categorical_cols if c not in date_cols]

        return numeric_cols, categorical_cols, date_cols

    def _detect_dates(self, df: pd.DataFrame) -> list:
        date_cols = list(df.select_dtypes(include=["datetime"]).columns)
        for col in df.select_dtypes(include=["object", "category", "string"]).columns:
            if col in date_cols:
                continue
            try:
                s = df[col].dropna()
                if len(s) > 0:
                    pd.to_datetime(s.iloc[:20], errors="raise")
                    date_cols.append(col)
            except (ValueError, TypeError):
                pass
        return date_cols

    def generate_all_charts(
        self, df: pd.DataFrame, limit: int = 50, overrides: dict | None = None
    ) -> tuple[list, list, dict]:
        numeric_cols, categorical_cols, date_cols = self._classify_columns(df)
        overrides = overrides or {}
        charts_data = []
        skipped = []

        for chart_type, req in CHART_REQUIREMENTS.items():
            override_x = overrides.get(f"{chart_type}_x", "")
            override_y = overrides.get(f"{chart_type}_y", "")
            has_override = override_x and override_y

            if not has_override:
                applicable, reason = self._check_applicability(
                    chart_type, req, df, numeric_cols, categorical_cols, date_cols
                )
                if not applicable:
                    skipped.append({"type": chart_type, "applicable": False, "reason": reason})
                    continue

            try:
                chart_data = self._compute_chart_data(
                    chart_type, req, df,
                    numeric_cols, categorical_cols, date_cols, limit,
                    override_x=override_x, override_y=override_y,
                )
                if chart_data:
                    charts_data.append(chart_data)
                else:
                    reason = f"指定字段组合无法生成图表 (X={override_x}, Y={override_y})" if has_override else "字段不满足生成条件"
                    skipped.append({"type": chart_type, "applicable": False, "reason": reason})
            except Exception as e:
                skipped.append(
                    {"type": chart_type, "applicable": False, "reason": str(e)}
                )

        summary = {
            "total_records": len(df),
            "total_fields": len(df.columns),
            "numeric_fields": numeric_cols,
            "categorical_fields": categorical_cols,
            "date_fields": date_cols,
        }

        return charts_data, skipped, summary

    def compute_ai_charts(self, df: pd.DataFrame, ai_chart_configs: dict) -> list[dict]:
        """Compute chart data from AI-suggested field mappings."""
        charts = []
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

        for chart_type, config in ai_chart_configs.items():
            if not config or not isinstance(config, dict):
                continue
            try:
                chart_data = None
                if chart_type == 'line':
                    x = config.get('x', '')
                    y = config.get('y', '')
                    if x in df.columns and y in df.columns and y in numeric_cols:
                        df2 = df[[x, y]].dropna()
                        if len(df2) >= 3:
                            # Try date x-axis first
                            try:
                                df2[x] = pd.to_datetime(df2[x], errors='raise')
                                df2 = df2.set_index(x)
                                freq = self._detect_date_frequency(df2.reset_index(), x)
                                agg = df2.resample(freq)[y].sum().reset_index()
                                agg[x] = agg[x].astype(str)
                            except Exception:
                                agg = df2.groupby(x)[y].sum().sort_index().head(60).reset_index()
                            chart_data = {
                                "id": f"ai_line", "type": "line",
                                "title": f"AI: {y} 趋势", "description": f"X={x}, Y={y}",
                                "data": self._to_records(agg),
                                "config": {"x_field": x, "y_field": y},
                            }

                elif chart_type == 'bar':
                    x = config.get('x', '')
                    y = config.get('y', '')
                    if x in df.columns and y in df.columns and y in numeric_cols:
                        agg = df.groupby(x)[y].sum().sort_values(ascending=False).head(30).reset_index()
                        chart_data = {
                            "id": "ai_bar", "type": "bar",
                            "title": f"AI: {x} 维度 {y} 汇总", "description": f"X={x}, Y={y}",
                            "data": self._to_records(agg),
                            "config": {"x_field": x, "y_field": y},
                        }

                elif chart_type == 'pie':
                    name = config.get('name', '')
                    value = config.get('value', '')
                    if name in df.columns and value in df.columns and value in numeric_cols:
                        agg = df.groupby(name)[value].sum().sort_values(ascending=False).head(12).reset_index()
                        chart_data = {
                            "id": "ai_pie", "type": "pie",
                            "title": f"AI: {name} 占比", "description": f"name={name}, value={value}",
                            "data": self._to_records(agg),
                            "config": {"name_field": name, "value_field": value},
                        }

                elif chart_type == 'scatter':
                    x = config.get('x', '')
                    y = config.get('y', '')
                    if x in df.columns and y in df.columns and x in numeric_cols and y in numeric_cols:
                        sub = df[[x, y]].dropna().sample(n=min(200, len(df))).reset_index(drop=True)
                        chart_data = {
                            "id": "ai_scatter", "type": "scatter",
                            "title": f"AI: {x} vs {y}", "description": f"X={x}, Y={y}",
                            "data": self._to_records(sub),
                            "config": {"x_field": x, "y_field": y},
                        }

                elif chart_type == 'heatmap':
                    x = config.get('x', '')
                    y = config.get('y', '')
                    value = config.get('value', '')
                    if x in df.columns and y in df.columns and value in df.columns and value in numeric_cols:
                        pivot = df.pivot_table(values=value, index=y, columns=x, aggfunc='mean')
                        records = []
                        for idx in pivot.index[:10]:
                            for col in pivot.columns[:10]:
                                v = pivot.loc[idx, col]
                                if not pd.isna(v):
                                    records.append({"x": str(col), "y": str(idx), "value": round(float(v), 2)})
                        chart_data = {
                            "id": "ai_heatmap", "type": "heatmap",
                            "title": f"AI: {y} x {x} {value}", "description": f"热力图",
                            "data": records[:100],
                            "config": {"x_field": x, "y_field": y, "value_field": value},
                        }

                elif chart_type == 'radar':
                    metrics = config.get('metrics', [])
                    group = config.get('group', '')
                    if isinstance(metrics, list) and len(metrics) >= 3 and group in df.columns:
                        valid_metrics = [m for m in metrics if m in numeric_cols]
                        if len(valid_metrics) >= 3:
                            top_cats = df[group].value_counts().head(8).index.tolist()
                            records = []
                            for cat in top_cats:
                                sub = df[df[group] == cat]
                                row = {group: str(cat)}
                                for m in valid_metrics[:6]:
                                    row[m] = round(float(sub[m].mean()), 2)
                                records.append(row)
                            chart_data = {
                                "id": "ai_radar", "type": "radar",
                                "title": f"AI: {group} 多维度雷达", "description": f"雷达图",
                                "data": records,
                                "config": {"group_field": group, "metrics": valid_metrics[:6], "groups": [str(c) for c in top_cats]},
                            }

                if chart_data:
                    charts.append(chart_data)
            except Exception:
                pass

        return charts

    def _check_applicability(
        self,
        chart_type: str,
        req: dict,
        df: pd.DataFrame,
        numeric_cols: list,
        categorical_cols: list,
        date_cols: list,
    ) -> tuple[bool, str | None]:
        if len(df) < req.get("min_records", 0):
            return False, f"数据记录不足（需至少{req['min_records']}条，当前{len(df)}条）"

        for field_dtype, _ in req.get("required_fields", []):
            if field_dtype == "category" and not categorical_cols:
                return False, "缺少分类字段（文本列）"
            if field_dtype == "date" and not date_cols:
                return False, "缺少日期字段"

        for field_dtype, count_req in req.get("value_fields", []):
            if field_dtype == "numeric":
                needed = 1
                if isinstance(count_req, str) and count_req.startswith(">="):
                    needed = int(count_req[2:])
                if len(numeric_cols) < needed:
                    return False, f"需要至少{needed}个数值字段，当前有{len(numeric_cols)}个"

        for field_dtype, count_req in req.get("additional_fields", []):
            if field_dtype == "category":
                needed = 1
                if isinstance(count_req, str) and count_req.startswith(">="):
                    needed = int(count_req[2:])
                if len(categorical_cols) < needed + 1:
                    return False, f"需要至少{needed + 1}个分类字段"

        return True, None

    def _compute_chart_data(
        self, chart_type: str, req: dict, df: pd.DataFrame,
        numeric_cols: list, categorical_cols: list, date_cols: list, limit: int,
        override_x: str = "", override_y: str = "",
    ) -> dict | None:
        if chart_type == "table":
            return self._build_table(df, req, limit)
        elif chart_type == "bar":
            return self._build_bar(df, req, categorical_cols, numeric_cols, limit, override_x, override_y)
        elif chart_type == "line":
            return self._build_line(df, req, date_cols, categorical_cols, numeric_cols, limit, override_x, override_y)
        elif chart_type == "pie":
            return self._build_pie(df, req, categorical_cols, numeric_cols, limit, override_x, override_y)
        elif chart_type == "scatter":
            return self._build_scatter(df, req, numeric_cols, limit)
        elif chart_type == "heatmap":
            return self._build_heatmap(df, req, categorical_cols, numeric_cols, limit)
        elif chart_type == "radar":
            return self._build_radar(df, req, categorical_cols, numeric_cols, limit)
        elif chart_type == "treemap":
            return self._build_treemap(df, req, categorical_cols, numeric_cols, limit)
        return None

    _location_kw = ['省', '市', '区', '县', '地区', '地点', '地址', '位置', 'city', 'region', 'address', 'location', 'origin', 'destination', '始发', '目的', '收货', '发货', '省份', '城市', '国家', 'country', 'province', 'state', 'town']
    _time_kw = ['月', '季度', '年', '周', 'month', 'quarter', 'year', 'week', 'period', '日期', 'date']

    def _is_location_field(self, col_name: str) -> bool:
        return any(kw in col_name.lower() for kw in self._location_kw)

    def _is_time_ordered_field(self, col_name: str) -> bool:
        return any(kw in col_name.lower() for kw in self._time_kw)

    def _pick_best_categorical(self, df, categorical_cols, max_categories=30, min_categories=2, prefer_ordered=False):
        best = None
        best_score = -1
        for col in categorical_cols:
            n_unique = df[col].nunique()
            if n_unique < min_categories or n_unique > max_categories:
                continue
            loc_penalty = 0.01 if self._is_location_field(col) else 1.0
            time_boost = 2.0 if (prefer_ordered and self._is_time_ordered_field(col)) else 1.0
            score = min(n_unique, max_categories - n_unique) * loc_penalty * time_boost
            if score > best_score:
                best_score = score
                best = col
        if best is None and categorical_cols:
            for col in categorical_cols:
                if df[col].nunique() >= 2 and (not prefer_ordered or not self._is_location_field(col)):
                    return col
            for col in categorical_cols:
                if not self._is_location_field(col):
                    return col
            return categorical_cols[0]
        return best

    def _pick_best_numeric(self, df, numeric_cols):
        if not numeric_cols:
            return None
        best = None
        best_var = -1
        priority_keywords = ["amount", "cost", "value", "金额", "费用", "价格", "收入", "支出"]
        for col in numeric_cols:
            var = df[col].var()
            if pd.isna(var):
                continue
            boost = 2 if any(kw in col.lower() for kw in priority_keywords) else 1
            score = var * boost
            if score > best_var:
                best_var = score
                best = col
        return best if best else numeric_cols[0]

    def _pick_best_date(self, df, date_cols):
        if not date_cols:
            return None
        best = None
        best_range = None
        for col in date_cols:
            try:
                s = pd.to_datetime(df[col], errors="coerce").dropna()
                if len(s) < 2:
                    continue
                date_range = (s.max() - s.min()).days
                if best_range is None or date_range > best_range:
                    best_range = date_range
                    best = col
            except Exception:
                continue
        return best if best else date_cols[0]

    def _pick_scatter_pair(self, df, numeric_cols):
        if len(numeric_cols) < 2:
            return numeric_cols[0], numeric_cols[1] if len(numeric_cols) >= 2 else (None, None)

        best_pair = (numeric_cols[0], numeric_cols[1])
        best_corr = -1
        for i in range(min(len(numeric_cols), 5)):
            for j in range(i + 1, min(len(numeric_cols), 5)):
                sub = df[[numeric_cols[i], numeric_cols[j]]].dropna()
                if len(sub) > 3:
                    corr = abs(sub.corr().iloc[0, 1])
                    if not np.isnan(corr) and corr > best_corr:
                        best_corr = corr
                        best_pair = (numeric_cols[i], numeric_cols[j])
        return best_pair

    def _detect_date_frequency(self, df, date_col):
        try:
            dates = pd.to_datetime(df[date_col], errors="coerce").dropna().sort_values()
            if len(dates) < 3:
                return "D"
            total_days = (dates.max() - dates.min()).days
            # Span < 3 days: use hours
            if total_days < 3:
                return "h"
            # Span < 60 days: use days
            elif total_days < 60:
                return "D"
            # Span < 2 years: use weeks
            elif total_days < 730:
                return "W"
            # Span >= 2 years: use months
            else:
                return "M"
        except Exception:
            return "D"

    def _format_date_axis(self, dates_series, freq: str) -> list[str]:
        """Format date strings based on frequency and span."""
        try:
            dt = pd.to_datetime(dates_series)
            if freq == "h":
                return dt.dt.strftime("%m-%d %H:%M").tolist()
            elif freq == "D":
                return dt.dt.strftime("%m-%d").tolist()
            elif freq == "W":
                return dt.dt.strftime("%m-%d").tolist()
            elif freq == "M":
                return dt.dt.strftime("%Y-%m").tolist()
        except Exception:
            pass
        return dates_series.astype(str).tolist()

    def _to_records(self, df_in):
        records = df_in.to_dict(orient="records")
        for r in records:
            for k, v in r.items():
                if isinstance(v, (np.integer,)):
                    r[k] = int(v)
                elif isinstance(v, (np.floating,)):
                    r[k] = round(float(v), 4)
                elif pd.isna(v):
                    r[k] = None
        return records

    # ---- Chart builders ----

    def _build_table(self, df, req, limit):
        sample = df.head(min(limit, req["max_data_points"]))
        records = self._to_records(sample)
        return {
            "id": "chart_table_0",
            "type": "table",
            "title": "数据明细表",
            "description": f"共 {len(df)} 条记录，展示前 {len(sample)} 行",
            "data": records,
            "config": {"columns": list(df.columns), "total_rows": len(df)},
        }

    def _build_bar(self, df, req, categorical_cols, numeric_cols, limit, override_x="", override_y=""):
        if override_x:
            if override_x in df.columns:
                cat_field = override_x
            else:
                return None  # User's field doesn't exist
        else:
            cat_field = self._pick_best_categorical(df, categorical_cols, 12)
        if cat_field is None:
            return None
        if override_y:
            if override_y in df.columns and override_y in numeric_cols:
                val_field = override_y
            else:
                return None  # User's field doesn't exist or isn't numeric
        else:
            val_field = self._pick_best_numeric(df, numeric_cols)
        if val_field is None:
            return None
        if df[cat_field].nunique() > 30:
            return None
        if self._is_location_field(cat_field) and df[cat_field].nunique() > 8:
            return None

        try:
            agg_df = (
                df.groupby(cat_field)[val_field]
                .sum()
                .sort_values(ascending=False)
                .head(min(limit, req["max_data_points"]))
                .reset_index()
            )
        except Exception:
            return None
        return {
            "id": "chart_bar_0",
            "type": "bar",
            "title": f"{cat_field} 维度 {val_field} 汇总",
            "description": req["description_template"].format(group=cat_field, value=val_field),
            "data": self._to_records(agg_df),
            "config": {"x_field": cat_field, "y_field": val_field},
        }

    def _build_line(self, df, req, date_cols, categorical_cols, numeric_cols, limit, override_x="", override_y=""):
        if override_y:
            if override_y in df.columns and override_y in numeric_cols:
                val_field = override_y
            else:
                return None
        else:
            val_field = self._pick_best_numeric(df, numeric_cols)
        if val_field is None:
            return None
        if override_x and override_x in df.columns:
            # User-specified X: build line chart with it directly
            if override_x in date_cols:
                df_time = df.copy()
                df_time[override_x] = pd.to_datetime(df_time[override_x], errors="coerce")
                df_time = df_time.dropna(subset=[override_x])
                if len(df_time) >= 3:
                    freq = self._detect_date_frequency(df_time, override_x)
                    df_time = df_time.set_index(override_x)
                    agg_df = df_time.resample(freq)[val_field].sum().reset_index()
                    agg_df[override_x] = self._format_date_axis(agg_df[override_x], freq)
                    return {"id":"chart_line_0","type":"line","title":f"{val_field} 趋势","description":"","data":self._to_records(agg_df.tail(60)),"config":{"x_field":override_x,"y_field":val_field,"frequency":freq}}
            # Categorical x override
            if override_x in categorical_cols or override_x in df.columns:
                agg_df = df.groupby(override_x)[val_field].sum().sort_index().head(60).reset_index()
                if len(agg_df) >= 2:
                    return {"id":"chart_line_0","type":"line","title":f"{val_field} 按{override_x}趋势","description":"","data":self._to_records(agg_df),"config":{"x_field":override_x,"y_field":val_field}}

        # Prefer date column, fallback to categorical, then index
        date_field = self._pick_best_date(df, date_cols)
        if date_field is not None:
            # Date-based line chart with resampling
            df_time = df.copy()
            df_time[date_field] = pd.to_datetime(df_time[date_field], errors="coerce")
            df_time = df_time.dropna(subset=[date_field])
            if len(df_time) < 3:
                date_field = None  # fall through to categorical fallback
            else:
                freq = self._detect_date_frequency(df_time, date_field)
                df_time = df_time.set_index(date_field)
                agg_df = df_time.resample(freq)[val_field].sum().reset_index()
                agg_df = agg_df.tail(min(limit, req["max_data_points"]))
                agg_df[date_field] = self._format_date_axis(agg_df[date_field], freq)
                return {
                    "id": "chart_line_0",
                    "type": "line",
                    "title": f"{val_field} 时间趋势",
                    "description": req["description_template"].format(value=val_field),
                    "data": self._to_records(agg_df),
                    "config": {"x_field": date_field, "y_field": val_field, "frequency": freq},
                }

        # Fallback 1: use categorical field as x-axis (prefer ordered/non-location)
        cat_field = self._pick_best_categorical(df, categorical_cols, 60, 2, prefer_ordered=True)
        if cat_field is not None:
            agg_df = (
                df.groupby(cat_field)[val_field]
                .sum()
                .sort_index()
                .head(min(limit, req["max_data_points"]))
                .reset_index()
            )
            return {
                "id": "chart_line_0",
                "type": "line",
                "title": f"{val_field} 按 {cat_field} 趋势",
                "description": f"{val_field} 按 {cat_field} 分组变化趋势",
                "data": self._to_records(agg_df),
                "config": {"x_field": cat_field, "y_field": val_field},
            }

        # No suitable x-axis found: skip line chart instead of using meaningless index
        return None

    def _build_pie(self, df, req, categorical_cols, numeric_cols, limit, override_name="", override_value=""):
        if override_name:
            if override_name in df.columns:
                cat_field = override_name
            else:
                return None
        else:
            cat_field = self._pick_best_categorical(df, categorical_cols, 12)
        if cat_field is None:
            return None
        if override_value:
            if override_value in df.columns and override_value in numeric_cols:
                val_field = override_value
            else:
                return None
        else:
            val_field = self._pick_best_numeric(df, numeric_cols)
        if val_field is None:
            return None

        agg_df = (
            df.groupby(cat_field)[val_field]
            .sum()
            .sort_values(ascending=False)
            .head(min(limit, req["max_data_points"]))
            .reset_index()
        )
        return {
            "id": "chart_pie_0",
            "type": "pie",
            "title": f"{cat_field} 占比分布",
            "description": req["description_template"].format(group=cat_field),
            "data": self._to_records(agg_df),
            "config": {"name_field": cat_field, "value_field": val_field},
        }

    def _build_scatter(self, df, req, numeric_cols, limit):
        if len(numeric_cols) < 2:
            return None
        f1, f2 = self._pick_scatter_pair(df, numeric_cols)
        if f1 is None or f2 is None:
            return None

        sub = df[[f1, f2]].dropna()
        sample_n = min(limit, req["max_data_points"], len(sub))
        sub = sub.sample(n=sample_n, random_state=42) if len(sub) > sample_n else sub

        return {
            "id": "chart_scatter_0",
            "type": "scatter",
            "title": f"{f1} vs {f2} 相关性",
            "description": req["description_template"].format(x=f1, y=f2),
            "data": self._to_records(sub),
            "config": {"x_field": f1, "y_field": f2},
        }

    def _build_heatmap(self, df, req, categorical_cols, numeric_cols, limit):
        if len(categorical_cols) < 2:
            return None
        cat1 = self._pick_best_categorical(df, categorical_cols, 15)
        remaining = [c for c in categorical_cols if c != cat1]
        cat2 = self._pick_best_categorical(df, remaining, 15) if remaining else None
        if cat2 is None:
            return None
        val_field = self._pick_best_numeric(df, numeric_cols)
        if val_field is None:
            return None

        pivot = df.pivot_table(
            values=val_field, index=cat1, columns=cat2, aggfunc="mean"
        )
        if pivot.shape[0] > 15:
            pivot = pivot.iloc[:15]
        if pivot.shape[1] > 15:
            pivot = pivot.iloc[:, :15]

        records = []
        for idx in pivot.index:
            for col in pivot.columns:
                v = pivot.loc[idx, col]
                if not pd.isna(v):
                    records.append(
                        {
                            "x": str(col),
                            "y": str(idx),
                            "value": round(float(v), 2),
                        }
                    )

        return {
            "id": "chart_heatmap_0",
            "type": "heatmap",
            "title": f"{cat1} x {cat2} {val_field} 热力图",
            "description": req["description_template"].format(row=cat1, col=cat2, value=val_field),
            "data": records[: req["max_data_points"]],
            "config": {
                "x_field": cat2,
                "y_field": cat1,
                "value_field": val_field,
            },
        }

    def _build_radar(self, df, req, categorical_cols, numeric_cols, limit):
        if len(numeric_cols) < 3:
            return None
        cat_field = self._pick_best_categorical(df, categorical_cols, 10)
        if cat_field is None:
            return None

        # Use top categories by count
        top_cats = df[cat_field].value_counts().head(8).index.tolist()
        numeric_subset = numeric_cols[:6]  # max 6 metrics for readability

        records = []
        for cat in top_cats:
            sub = df[df[cat_field] == cat]
            row = {cat_field: str(cat)}
            for ncol in numeric_subset:
                row[ncol] = round(float(sub[ncol].mean()), 2)
            records.append(row)

        return {
            "id": "chart_radar_0",
            "type": "radar",
            "title": f"{cat_field} 多维度雷达图",
            "description": req["description_template"].format(group=cat_field),
            "data": records,
            "config": {
                "group_field": cat_field,
                "metrics": numeric_subset,
                "groups": [str(c) for c in top_cats],
            },
        }

    def _build_treemap(self, df, req, categorical_cols, numeric_cols, limit):
        cat_field = self._pick_best_categorical(df, categorical_cols, 50)
        if cat_field is None:
            return None
        val_field = self._pick_best_numeric(df, numeric_cols)
        if val_field is None:
            return None

        agg_df = (
            df.groupby(cat_field)[val_field]
            .sum()
            .sort_values(ascending=False)
            .head(min(limit, req["max_data_points"]))
            .reset_index()
        )
        records = self._to_records(agg_df)
        treemap_data = [
            {"name": str(r[cat_field]), "value": float(r[val_field])}
            for r in records
        ]

        return {
            "id": "chart_treemap_0",
            "type": "treemap",
            "title": f"{cat_field} {val_field} 树图",
            "description": req["description_template"].format(group=cat_field, value=val_field),
            "data": treemap_data,
            "config": {"name_field": "name", "value_field": "value"},
        }
