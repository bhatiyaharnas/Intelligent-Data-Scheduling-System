import json
import urllib.request
import urllib.error


class AIService:
    @staticmethod
    def _call_ai(api_endpoint: str, api_key: str, model: str, system_prompt: str, user_prompt: str, max_tokens=3000) -> str:
        endpoint = api_endpoint.rstrip("/")
        if "platform.deepseek.com" in endpoint:
            endpoint = "https://api.deepseek.com/v1"
        elif "api.deepseek.com" in endpoint and "/v1" not in endpoint:
            endpoint = endpoint + "/v1"
        elif endpoint.endswith(".com") or endpoint.endswith(".cn"):
            if "/v1" not in endpoint:
                endpoint = endpoint + "/v1"
        endpoint = endpoint + "/chat/completions"

        body = json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": max_tokens,
        }).encode("utf-8")

        req = urllib.request.Request(endpoint, data=body, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        })

        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")[:500]
            code = e.code
            if code == 401:
                raise RuntimeError(f"AI API Key 无效 (401)")
            elif code == 404:
                raise RuntimeError(f"AI 端点不存在 (404) — DeepSeek 用户请使用 https://api.deepseek.com/v1")
            elif code == 429:
                raise RuntimeError(f"AI 请求过于频繁 (429)")
            else:
                raise RuntimeError(f"AI API 请求失败 ({code}): {err_body}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"无法连接 AI 服务器: {str(e.reason)}")
        except json.JSONDecodeError:
            raise RuntimeError(f"AI 返回内容无法解析")

    @staticmethod
    def _extract_code(content: str) -> str:
        content = content.strip()
        if "```python" in content:
            return content.split("```python")[1].split("```")[0].strip()
        elif "```" in content:
            parts = content.split("```")
            if len(parts) >= 2:
                return parts[1].strip()
        return content

    @staticmethod
    def _extract_json(content: str) -> str:
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])
        return content

    @staticmethod
    def generate_cleaning_code(
        columns: list[str],
        sample_rows: list[dict],
        api_endpoint: str, api_key: str, model: str,
        error_msg: str = "",
    ) -> str:
        sample_str = json.dumps(sample_rows[:5], ensure_ascii=False, indent=2)
        cols_str = ", ".join(columns)

        if error_msg:
            task = f"""之前的清洗代码执行出错，请修正。

错误信息：
{error_msg}

请重新生成修正后的完整清洗代码（只输出Python代码，不要解释）。"""
        else:
            task = f"""请生成Pandas数据清洗代码。

## 列名（保留所有列）
{cols_str}

## 样本数据
{sample_str}

## 要求
1. 输入df，结果赋值给 result 变量
2. **必须保留所有原始列**，不要删除任何列
3. 只清洗数据质量问题：去除全空行、填补缺失值（数值用中位数、分类用众数）、去除完全重复行、去除明显异常值（如金额为负数或超出3倍标准差）、统一日期格式（多种格式归一到YYYY-MM-DD）、去除字符串首尾空格
4. 数值列如果包含非数字字符串（如'N/A','-',''），需要转换为NaN后再补全
5. 使用 df.copy() 开始
6. 不要使用 inplace=True（会导致链式操作报错）
7. 只输出Python代码"""

        system = "你是一个Pandas数据清洗专家。只输出Python代码，不要任何解释文字。代码必须将最终清洗结果赋值给 result 变量。"

        content = AIService._call_ai(api_endpoint, api_key, model, system, task, max_tokens=3000)
        return AIService._extract_code(content)

    @staticmethod
    def generate_chart_code(
        columns: list[str],
        sample_rows: list[dict],
        api_endpoint: str, api_key: str, model: str,
        error_msg: str = "",
    ) -> str:
        sample_str = json.dumps(sample_rows[:5], ensure_ascii=False, indent=2)
        cols_str = ", ".join(columns)

        if error_msg:
            task = f"""之前的图表代码执行出错，请修正。

错误信息：
{error_msg}

请重新生成修正后的完整图表代码。
config 必须使用 x_field / y_field / name_field / value_field / group_field 作为 key。
只输出Python代码，不要解释。"""
        else:
            task = f"""请生成Pandas数据分析与图表数据生成代码。

## 列名
{cols_str}

## 样本数据
{sample_str}

## 核心规则（必须严格遵守）
1. 输入df，结果赋值给 charts 变量（list[dict]）
2. 每个dict格式:
   - bar/line/scatter: {{"type":"bar","title":"图表标题","data":[{{"x_field":"值","y_field":数值}},...],"config":{{"x_field":"列名","y_field":"列名"}}}}
   - pie: {{"type":"pie","title":"图表标题","data":[{{"name_field":"值","value_field":数值}},...],"config":{{"name_field":"列名","value_field":"列名"}}}}
   - heatmap: {{"type":"heatmap","title":"图表标题","data":[{{"x":"值","y":"值","value":数值}},...],"config":{{"x_field":"列名","y_field":"列名","value_field":"列名"}}}}
   - radar: {{"type":"radar","title":"图表标题","data":[{{"group_field":"组名","指标1":数值,"指标2":数值,...}},...],"config":{{"group_field":"列名","metrics":["指标1","指标2"]}}}}
3. config 中的 key 名必须是 x_field / y_field / name_field / value_field / group_field / metrics（不允许用其他名称）
4. data 中直接使用列名作为 key（如 {{"日期":"2024-01-01","销售额":1234}}），禁止使用 "x"/"y"/"name"/"value" 等通用 key
5. 每个图表 data 不超过 50 条
6. 使用 df.copy() 开始，不要用 inplace=True
7. 结果赋值给 charts 变量

## 图表选择指南
- **折线图(line)**: 展示时间趋势。X轴用日期列（按天/周/月聚合），Y轴用数值列
- **柱状图(bar)**: 对比分类。X轴用分类列，Y轴用数值列（sum聚合）
- **饼图(pie)**: 占比分布。用分类列+数值列sum
- **热力图(heatmap)**: 交叉分析。用2个分类列做pivot_table mean
- **雷达图(radar)**: 多维对比。>=3个数值列，group by分类列取均值

只输出Python代码。"""

        system = "你是一个数据可视化专家。只输出Python代码，将图表数据赋值给 charts 变量。charts是list[dict]，每个dict有type/title/data/config字段。"

        content = AIService._call_ai(api_endpoint, api_key, model, system, task, max_tokens=4000)
        return AIService._extract_code(content)

    @staticmethod
    def analyze_data(
        columns: list[str], sample_rows: list[dict],
        api_endpoint: str, api_key: str, model: str,
    ) -> dict:
        sample_str = json.dumps(sample_rows[:5], ensure_ascii=False, indent=2)
        columns_str = ", ".join(columns)

        prompt = f"""你是数据分析专家。给定数据集列名和样本，分析并给出图表建议。

## 列名
{columns_str}

## 样本
{sample_str}

## 任务
分析每列类型（date/numeric/categorical/text），建议图表配置。

## 输出JSON格式
{{
  "column_types": {{"列名": "date/numeric/categorical/text"}},
  "charts": {{
    "line": {{"x": "X轴列名", "y": "Y轴列名"}},
    "bar": {{"x": "分类列名", "y": "数值列名"}},
    "pie": {{"name": "分类列名", "value": "数值列名"}},
    "scatter": {{"x": "数值列名1", "y": "数值列名2"}},
    "heatmap": {{"x": "分类列名", "y": "分类列名", "value": "数值列名"}},
    "radar": {{"metrics": ["列1","列2","列3"], "group": "分类列名"}}
  }},
  "summary": "数据集中文总结（50字）"
}}
不合适的图表设为null。只返回JSON不要其他文字。"""

        system = "你是数据分析专家。只返回JSON格式，不要代码块标记。"
        content = AIService._call_ai(api_endpoint, api_key, model, system, prompt, max_tokens=2000)
        return json.loads(AIService._extract_json(content))
