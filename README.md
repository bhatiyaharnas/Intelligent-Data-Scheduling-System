# 智能数据调度引擎

> Intelligent Data Dispatch Engine — 一站式数据导入、剖析、映射、清洗与可视化平台。

## 功能特性

- **智能剖析**：自动推断数据类型（数值/日期/文本/布尔）和语义类型（邮箱/手机/URL/货币/身份证等 35+ 种）
- **字段映射推荐**：基于模糊列名匹配（thefuzz）+ 数据模式评分，覆盖 5 大领域（通用/金融/电商/物流/医疗）共 150+ 标准字段
- **分层清洗**：4 层清洗管道（类型强制 → 通用清洗 → 去重 → 自定义规则）+ 领域感知的缺失值填充策略
- **动态可视化**：类型驱动的图表推荐系统 + 字段筛选器，自由切换 X/Y 轴
- **AI 增强**（可选）：接入 OpenAI/DeepSeek 等兼容 API，实现 AI 智能绘图

## 系统架构

```
浏览器 (React 19 + Vite + Tailwind + Recharts)
    │ HTTP (localhost:3000 ↔ localhost:8011)
FastAPI 后端 (Python 3.10+)
    ├── DataLoader      → CSV / Excel / JSON 解析
    ├── DataProfiler    → 数据类型 + 语义类型推断 + 健康报告
    ├── MappingService  → thefuzz 模糊列名匹配 + 数据模式评分
    ├── CleaningService → 4 层清洗管道 + 领域填充策略
    ├── ChartEngine     → 图表推荐 + 逐条生成
    └── AIService       → LLM 图表代码生成（可选）
```

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Python | 3.10+ | 后端运行环境 |
| Node.js | 18+ | 前端构建运行 |
| npm | 9+ | 包管理器 |

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/<your-username>/intelligent-data-dispatch-engine.git
cd intelligent-data-dispatch-engine
```

### 2. 安装后端依赖

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 安装前端依赖

```bash
# 回到项目根目录
cd ..

# 安装 npm 依赖
npm install
```

### 4. 启动服务

**启动后端**：

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8011
```

**启动前端**（：

```bash
# 新开一个终端，在项目根目录
npm run dev
```

### 5. 使用流程

1. **导入数据** — 选择领域（通用/金融/电商/物流/医疗），上传 CSV / Excel / JSON 文件
2. **智能剖析** — 自动检测每列的数据类型和语义类型，展示数据健康评分
3. **字段映射** — 确认或调整系统推荐的列映射，未映射的列进入通用字段池
4. **执行清洗** — 类型标准化、通用清洗、去重、缺失值填充
5. **可视化仪表盘** — 概览推荐图表 / 数据明细 / 统计摘要 / 全局概览 / 因子分析 / 交叉分析 / AI 分析

## AI 配置（可选）

在首页展开"AI 配置"面板，填入：

- **API Endpoint**：如 `https://api.openai.com/v1` 或 `https://api.deepseek.com/v1`
- **API Key**：你的 API Key
- **Model**：如 `gpt-4o`、`deepseek-chat` 等

AI Key 仅在浏览器会话中使用，不会被存储到文件或上传到服务器。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_URL` | 后端 API 地址 | `http://localhost:8011/api` |

通过 `.env` 文件设置（参考 `.env.example`）：

```bash
# .env
VITE_API_URL=http://localhost:8011/api
```

## 项目结构

```
├── backend/
│   ├── config/
│   │   ├── domain_strategies.json   # 5个领域的字段映射 + 图表配置
│   │   ├── fill_strategies.json     # 各领域的缺失值填充策略
│   │   └── semantic_patterns.json   # 35+ 种语义类型的正则检测
│   ├── models/
│   │   └── schemas.py               # Pydantic 数据模型
│   ├── services/
│   │   ├── profiler.py              # 智能剖析
│   │   ├── mapping_service.py       # 字段映射推荐
│   │   ├── cleaning_service.py      # 分层清洗管道
│   │   ├── chart_engine.py          # 图表生成与推荐
│   │   ├── ai_service.py            # LLM 调用
│   │   ├── code_executor.py         # AI 代码沙箱执行
│   │   ├── data_loader.py           # 文件解析
│   │   └── data_processor.py        # 旧版处理管道（兼容）
│   ├── main.py                      # FastAPI 入口（24 个端点）
│   └── requirements.txt
├── src/
│   ├── components/
│   │   ├── ProfilingReport.tsx      # 剖析报告 + 健康评分
│   │   ├── MappingConfirmation.tsx  # 映射确认界面
│   │   ├── FieldSelector.tsx        # 字段筛选器
│   │   ├── Dashboard.tsx            # 仪表盘主框架
│   │   ├── FilterBar.tsx            # 筛选栏
│   │   └── Level*.tsx               # 各分析标签页
│   ├── api/client.ts                # API 客户端
│   ├── types/index.ts               # TypeScript 类型
│   └── App.tsx                      # 4 步状态机
├── .env.example                     # 环境变量模板
├── package.json
└── README.md
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| CSS | Tailwind CSS 4 |
| 图表 | Recharts |
| 动画 | Motion (framer-motion) |
| 后端框架 | FastAPI (Python) |
| 数据处理 | Pandas 2.2 |
| 模糊匹配 | thefuzz + python-Levenshtein |
| 序列化 | PyArrow (Parquet) |

## License

MIT
