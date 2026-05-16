import io
import traceback
import pandas as pd
import numpy as np


class CodeExecutor:
    """Safely execute AI-generated Python code in a restricted sandbox."""

    @staticmethod
    def execute(code: str, df: pd.DataFrame) -> tuple[pd.DataFrame | None, str, str]:
        stdout_buf = io.StringIO()
        local_vars = {
            "df": df.copy(),
            "pd": pd,
            "np": np,
            "print": lambda *a, **kw: print(*a, **kw, file=stdout_buf),
        }

        # Pre-check: fix common AI mistakes
        lines = code.strip().split("\n")
        fixed_lines = []
        for line in lines:
            # Fix: inplace=True used in chain
            if "inplace=True" in line and "." in line:
                line = line.replace("inplace=True", "inplace=False")
            # Fix: pd.drop with inplace
            if "drop(" in line and "inplace=True" in line and "=" not in line.split("drop(")[0]:
                line = line.replace("inplace=True", "")
                line = line.replace(", )", ")").replace("(  )", "()")
            fixed_lines.append(line)
        code = "\n".join(fixed_lines)

        try:
            exec(code, {"__builtins__": __builtins__}, local_vars)
            result_df = local_vars.get("result", local_vars.get("df", df))

            if not isinstance(result_df, pd.DataFrame):
                return None, stdout_buf.getvalue(), "代码执行后未返回DataFrame（请赋值给 result 变量）"

            return result_df, stdout_buf.getvalue(), ""
        except Exception:
            tb = traceback.format_exc()
            # Extract the last meaningful error line
            tb_lines = tb.strip().split("\n")
            short_err = "\n".join(tb_lines[-4:])  # Last 4 lines contain the actual error
            return None, stdout_buf.getvalue(), short_err

    @staticmethod
    def _sanitize_chart_data(charts: list[dict]) -> list[dict]:
        """将 numpy 类型转为原生 Python 类型，并修复常见 config key 名"""
        result = []
        for c in charts:
            if not isinstance(c, dict):
                continue
            # 修复 config key 名：AI 可能用 x/y/name/value 代替 x_field/y_field 等
            cfg = dict(c.get("config", {}))
            key_fixes = {
                "x": "x_field", "y": "y_field",
                "name": "name_field", "value": "value_field",
                "group": "group_field",
            }
            for old_k, new_k in key_fixes.items():
                if old_k in cfg and new_k not in cfg:
                    cfg[new_k] = cfg.pop(old_k)

            # 转换 data 中的 numpy 类型
            data = []
            for row in c.get("data", []):
                if not isinstance(row, dict):
                    continue
                clean_row = {}
                for k, v in row.items():
                    if isinstance(v, (np.integer,)):
                        clean_row[k] = int(v)
                    elif isinstance(v, (np.floating,)):
                        clean_row[k] = round(float(v), 4)
                    elif isinstance(v, (np.bool_,)):
                        clean_row[k] = bool(v)
                    elif pd.isna(v):
                        clean_row[k] = None
                    else:
                        clean_row[k] = v
                data.append(clean_row)

            result.append({
                "id": c.get("id", ""),
                "type": c.get("type", "bar"),
                "title": c.get("title", ""),
                "description": c.get("description", ""),
                "data": data,
                "config": cfg,
            })
        return result

    @staticmethod
    def execute_charts(code: str, df: pd.DataFrame) -> list[dict]:
        """
        Run AI-generated chart code. The code should produce a list of chart data dicts
        assigned to a variable named 'charts'.
        Each chart: {"type": "bar", "title": "...", "data": [...], "config": {...}}
        """
        local_vars = {
            "df": df.copy(),
            "pd": pd,
            "np": np,
        }

        try:
            exec(code, {"__builtins__": __builtins__}, local_vars)
            charts = local_vars.get("charts", local_vars.get("result", []))
            if not isinstance(charts, list):
                return []
            return CodeExecutor._sanitize_chart_data(charts)
        except Exception:
            tb = traceback.format_exc()
            print(f"[CodeExecutor] AI chart code failed:\n{tb}", flush=True)
            return []
