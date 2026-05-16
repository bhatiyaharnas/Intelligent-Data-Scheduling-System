import json
import re
from pathlib import Path

import pandas as pd

try:
    from thefuzz import fuzz
    HAS_FUZZ = True
except ImportError:
    HAS_FUZZ = False


class MappingService:
    """智能字段映射服务：thefuzz 模糊列名匹配 + 数据模式评分"""

    def __init__(self, strategies_config_path: Path | None = None):
        if strategies_config_path is None:
            strategies_config_path = Path(__file__).parent.parent / "config" / "domain_strategies.json"
        with open(strategies_config_path, "r", encoding="utf-8") as f:
            self.strategies = json.load(f)

        self._id_patterns = ['id', '编号', '代码', 'code', '账号', '账户', 'account', 'no', '号码']
        self._location_patterns = ['国家', '省', '市', '区', '县', '地区', '地点', '地址', '位置',
                                   'city', 'region', 'country', 'province', 'location', 'address',
                                   '收货', '发货']
        self._time_patterns = ['日期', '时间', 'date', 'time', '年', '月', '日']

    def _col_similarity(self, col_name: str, candidate: str) -> float:
        """计算列名与候选标准字段名的相似度 (0-1)"""
        c = col_name.lower().strip()
        s = candidate.lower().strip()

        if c == s:
            return 1.0

        if HAS_FUZZ:
            token_score = fuzz.token_sort_ratio(c, s) / 100.0
            partial_score = fuzz.partial_ratio(c, s) / 100.0
            return 0.6 * token_score + 0.4 * partial_score

        # 降级：cleaned substring match
        c_clean = re.sub(r'[_\-\s/\(\)（）　]', '', c)
        s_clean = re.sub(r'[_\-\s/\(\)（）　]', '', s)
        if c_clean == s_clean:
            return 0.9
        shorter = c_clean if len(c_clean) <= len(s_clean) else s_clean
        longer = s_clean if shorter == c_clean else c_clean
        if len(shorter) >= max(2, len(longer) * 0.5) and shorter in longer:
            return 0.7
        return 0.0

    def _should_skip_match(self, col_name: str, standard_name: str, col_profile: dict | None = None) -> bool:
        """负向匹配：阻止明显错误的映射（复用现有逻辑 + 语义类型检查）"""
        c = col_name.lower()
        if self._has_id_pattern(c) and standard_name in ('name', 'category', 'description', 'channel'):
            return True
        if self._has_location_pattern(c) and standard_name in ('quantity', 'amount', 'name', 'age', 'gender'):
            return True
        if self._has_time_pattern(c) and standard_name not in (
            'date', 'order_date', 'payment_time', 'submit_time', 'ship_date',
            'delivery_date', 'admission_date', 'discharge_date', 'surgery_date',
            'appointment_date', 'follow_up_date', 'delivery_days', 'ship_time', 'arrival_time'
        ):
            if standard_name in ('quantity', 'amount', 'name', 'sales', 'profit', 'cost'):
                return True

        # 语义类型负向匹配
        if col_profile:
            semantic = col_profile.get("semantic_type", "")
            # email/phone/url 类型的列不应映射到 name
            if standard_name == "name" and any(t in semantic for t in ("email", "phone", "url")):
                return True
            # 百分比列不应映射到 amount（百分比是比率不是金额）
            if standard_name in ("amount", "total_amount") and "percentage" in semantic:
                return True
            # 经纬度不应映射到 quantity/amount
            if standard_name in ("quantity", "amount") and semantic in ("longitude", "latitude"):
                return True

        return False

    def _has_id_pattern(self, col: str) -> bool:
        return any(p in col.lower() for p in self._id_patterns)

    def _has_location_pattern(self, col: str) -> bool:
        return any(p in col.lower() for p in self._location_patterns)

    def _has_time_pattern(self, col: str) -> bool:
        return any(p in col.lower() for p in self._time_patterns)

    def _data_pattern_score(self, col_name: str, col_profile: dict, standard_name: str) -> float:
        """根据列的数据特征与标准字段的预期特征匹配度评分"""
        score = 0.0
        semantic = col_profile.get("semantic_type", "text")
        cardinality = col_profile.get("cardinality_ratio", 0.0)

        # 语义类型与标准字段匹配
        semantic_field_map = {
            # 货币语义 → 金额类字段
            "currency_rmb": ["amount", "cost", "total_amount", "price", "sales", "profit", "discount", "unit_price", "tax", "fee", "budget", "forecast", "balance", "debit", "credit", "fuel_cost", "toll_cost", "labor_cost", "insurance"],
            "currency_usd": ["amount", "cost", "total_amount", "price", "sales", "profit", "discount", "unit_price", "tax", "fee"],
            "currency_eur": ["amount", "cost", "total_amount", "price", "sales", "profit", "discount", "unit_price", "tax", "fee"],
            "currency_general": ["amount", "cost", "total_amount", "price", "sales", "profit", "discount", "unit_price", "tax", "fee", "budget", "forecast", "balance"],
            # 日期语义 → 时间类字段
            "date_iso": ["date", "order_date", "payment_time", "submit_time", "ship_date", "delivery_date", "admission_date", "discharge_date", "appointment_date", "follow_up_date", "surgery_date", "delivery_days"],
            "date_slash": ["date", "order_date", "payment_time", "submit_time", "ship_date", "delivery_date"],
            "date_dot": ["date", "order_date", "payment_time", "submit_time", "ship_date", "delivery_date"],
            "date_cn": ["date", "order_date", "payment_time", "submit_time", "ship_date", "delivery_date"],
            "datetime_iso": ["date", "order_date", "payment_time", "submit_time", "ship_date", "delivery_date"],
            "datetime": ["date", "order_date", "payment_time", "submit_time", "ship_date", "delivery_date"],
            # 百分比语义
            "percentage": ["quantity", "discount", "return_rate", "conversion_rate", "cart_abandon_rate", "tax", "exchange_rate"],
            # 数值语义
            "integer": ["quantity", "age", "amount", "cost", "total_amount", "items_purchased", "days_since_last_purchase", "satisfaction_level", "stock", "click_count", "session_count", "delivery_days", "delay_days", "height", "weight", "heart_rate"],
            "float": ["amount", "cost", "total_amount", "sales", "profit", "discount", "quantity", "unit_price", "tax", "fee", "exchange_rate", "average_rating", "bmi", "temperature", "cargo_volume", "conversion_rate", "return_rate"],
            "numeric": ["amount", "cost", "total_amount", "sales", "profit", "discount", "quantity", "age", "unit_price", "tax", "fee", "stock", "items_purchased", "satisfaction_level", "average_rating", "days_since_last_purchase", "exchange_rate", "delivery_days", "delay_days"],
            # 邮箱/手机 → 联系方式类
            "email": ["email", "account", "name", "customer_id"],
            "phone_cn_mobile": ["phone", "account", "name", "customer_id"],
            "phone_cn_landline": ["phone", "account"],
            "phone_general": ["phone", "account"],
            # 性别/布尔/地址
            "gender_label": ["gender"],
            "boolean_cn": ["status", "reconciliation_status", "approval_status", "audit_flag", "readmission_flag"],
            "boolean_en": ["status", "reconciliation_status", "approval_status", "audit_flag", "readmission_flag"],
            "boolean_numeric": ["status", "reconciliation_status", "approval_status", "audit_flag", "readmission_flag"],
            "province_cn": ["region", "country", "destination", "warehouse"],
            "url": ["channel", "traffic_source"],
            # 身份证/UUID → ID类
            "id_number_cn": ["customer_id", "patient_id", "driver_id"],
            "uuid": ["order_id", "customer_id", "patient_id", "tracking_number"],
            # 评分
            "rating_1_5": ["satisfaction_level", "average_rating"],
            "rating_1_10": ["satisfaction_level", "average_rating"],
        }

        if standard_name in semantic_field_map.get(semantic, []):
            score += 0.6

        # 标准字段的基数预期
        cardinality_expectations = {
            "date": (0.01, 0.9), "order_date": (0.01, 0.9), "payment_time": (0.01, 0.9),
            "submit_time": (0.01, 0.9), "ship_date": (0.01, 0.9), "delivery_date": (0.01, 0.9),
            "admission_date": (0.01, 0.5), "discharge_date": (0.01, 0.5),
            "region": (0.001, 0.3), "country": (0.001, 0.1), "destination": (0.001, 0.3),
            "category": (0.001, 0.3), "industry": (0.001, 0.1), "segment": (0.001, 0.1),
            "gender": (0.001, 0.05), "blood_type": (0.001, 0.05),
            "status": (0.001, 0.1), "delivery_status": (0.001, 0.1),
            "reconciliation_status": (0.001, 0.05), "approval_status": (0.001, 0.1),
            "audit_flag": (0.001, 0.05), "readmission_flag": (0.001, 0.05),
            "channel": (0.001, 0.2), "traffic_source": (0.001, 0.2),
            "department": (0.001, 0.2), "doctor": (0.001, 0.3), "nurse": (0.001, 0.3),
            "amount": (0.01, 1.0), "sales": (0.01, 1.0), "total_amount": (0.01, 1.0),
            "profit": (0.01, 1.0), "discount": (0.01, 1.0), "cost": (0.01, 1.0),
            "quantity": (0.01, 1.0), "items_purchased": (0.01, 1.0), "stock": (0.01, 1.0),
            "name": (0.01, 1.0), "medication": (0.01, 0.5),
            "membership_type": (0.001, 0.05), "currency_type": (0.001, 0.05),
            "payment_method": (0.001, 0.1), "shipping_method": (0.001, 0.1),
            "device_type": (0.001, 0.05), "insurance": (0.001, 0.05),
            "satisfaction_level": (0.001, 0.1), "average_rating": (0.001, 0.3),
            "age": (0.001, 0.1), "days_since_last_purchase": (0.001, 1.0),
            "tax": (0.001, 0.5), "fee": (0.001, 1.0),
            "exchange_rate": (0.001, 0.1), "fiscal_year": (0.001, 0.02),
            "fiscal_quarter": (0.001, 0.01), "customer_id": (0.5, 1.0),
            "patient_id": (0.5, 1.0), "order_id": (0.5, 1.0),
            "tracking_number": (0.8, 1.0),
        }
        if standard_name in cardinality_expectations:
            lo, hi = cardinality_expectations[standard_name]
            if lo <= cardinality <= hi:
                score += 0.2

        return score

    def suggest_mappings(
        self, df: pd.DataFrame, domain: str, column_profiles: list[dict],
    ) -> dict:
        """为每列生成映射建议

        返回:
          suggestions: [{original_col, candidates: [{standard_field, score, reason}]}]
        """
        if domain not in self.strategies.get("domains", {}):
            raise ValueError(f"领域 '{domain}' 不存在")

        domain_cfg = self.strategies["domains"][domain]
        field_mappings = domain_cfg.get("field_mappings", {})

        suggestions = []
        for col in df.columns:
            col_profile = next((c for c in column_profiles if c["col_name"] == col), {})

            candidates = []
            for standard_name, synonyms in field_mappings.items():
                if self._should_skip_match(col, standard_name, col_profile):
                    continue

                name_score = 0.0
                # 先检查 exact match
                if col.strip().lower() in [s.lower() for s in synonyms]:
                    name_score = 0.95
                else:
                    best_syn_score = 0.0
                    for syn in synonyms:
                        s = self._col_similarity(col, syn)
                        if s > best_syn_score:
                            best_syn_score = s
                    name_score = best_syn_score

                data_score = self._data_pattern_score(col, col_profile, standard_name)

                combined = 0.5 * name_score + 0.5 * data_score
                combined = min(combined, 1.0)

                if combined > 0.2:
                    reasons = []
                    if name_score > 0.6:
                        reasons.append(f"列名相似度 {name_score:.0%}")
                    if data_score > 0.3:
                        st = col_profile.get("semantic_type", "text")
                        reasons.append(f"数据类型匹配 ({st})")
                    candidates.append({
                        "standard_field": standard_name,
                        "score": round(combined, 4),
                        "reason": "; ".join(reasons) if reasons else "综合匹配",
                    })

            candidates.sort(key=lambda x: x["score"], reverse=True)
            suggestions.append({
                "original_col": col,
                "candidates": candidates[:3],
            })

        return {"suggestions": suggestions, "domain": domain}
