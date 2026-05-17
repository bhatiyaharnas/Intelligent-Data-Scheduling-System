# Intelligent Data Dispatch Engine

> Intelligent Data Dispatch Engine — an all-in-one platform for data import, profiling, mapping, cleaning, and visualization.

<img width="2511" height="1352" alt="屏幕截图 2026-05-17 224930" src="https://github.com/user-attachments/assets/eb6a52c8-c97e-45d6-86e8-f95bdc3b7019" />

<img width="2532" height="1371" alt="屏幕截图 2026-05-17 225319" src="https://github.com/user-attachments/assets/5f7fac0e-e08e-4935-a610-81c2058ca28b" />

<img width="2503" height="1360" alt="屏幕截图 2026-05-17 225439" src="https://github.com/user-attachments/assets/dd673ea5-5bb2-4cc9-84ae-2c0523d7d2dc" />

<img width="2530" height="1362" alt="屏幕截图 2026-05-17 225603" src="https://github.com/user-attachments/assets/f19cc984-ed76-4c86-9a9a-f23cfa6b3542" />

<img width="2531" height="1375" alt="屏幕截图 2026-05-17 230001" src="https://github.com/user-attachments/assets/bc575ba8-f603-4eb5-9a5a-36e679b2a61d" />

## Features

- **Intelligent Profiling**: Automatically infer data types (numeric/date/text/boolean) and semantic types (email/phone/URL/currency/ID number, etc., covering 35+ types)
- **Field Mapping Recommendation**: Fuzzy column-name matching (thefuzz) + data-pattern scoring, covering 150+ standard fields across 5 domains (General/Finance/E-commerce/Logistics/Healthcare)
- **Layered Cleaning**: 4-layer cleaning pipeline (type coercion → general cleaning → deduplication → custom rules) + domain-aware missing-value filling strategies
- **Dynamic Visualization**: Type-driven chart recommendation system + field selector, freely switch X/Y axes
- **AI Enhancement** (optional): Integrate OpenAI / DeepSeek and other compatible APIs for AI-powered chart generation

## System Architecture

```
Browser (React 19 + Vite + Tailwind + Recharts)
    │ HTTP (localhost:3000 ↔ localhost:8011)
FastAPI Backend (Python 3.10+)
    ├── DataLoader      → CSV / Excel / JSON parsing
    ├── DataProfiler    → Data type + semantic type inference + health report
    ├── MappingService  → thefuzz fuzzy column-name matching + data-pattern scoring
    ├── CleaningService → 4-layer cleaning pipeline + domain filling strategies
    ├── ChartEngine     → Chart recommendation + per-chart generation
    └── AIService       → LLM chart code generation (optional)
```

## Environment Requirements

| Dependency | Minimum Version | Description          |
|------------|-----------------|----------------------|
| Python     | 3.10+           | Backend runtime      |
| Node.js    | 18+             | Frontend build & run |
| npm        | 9+              | Package manager      |

## Quick Start

### 1. Clone the Project

```bash
git clone https://github.com/<your-username>/intelligent-data-dispatch-engine.git
cd intelligent-data-dispatch-engine
```

### 2. Install Backend Dependencies

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
# Go back to the project root
cd ..

# Install npm dependencies
npm install
```

### 4. Start Services

**Start the backend**:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8011
```

**Start the frontend**:

```bash
# Open a new terminal, in the project root
npm run dev
```

### 5. Usage Flow

1. **Import Data** — Select a domain (General/Finance/E-commerce/Logistics/Healthcare), upload CSV / Excel / JSON file
2. **Intelligent Profiling** — Automatically detect data type and semantic type for each column, display data health score
3. **Field Mapping** — Confirm or adjust the recommended column mapping; unmapped columns go into the generic field pool
4. **Execute Cleaning** — Type standardization, general cleaning, deduplication, missing-value filling
5. **Visualization Dashboard** — Overview recommended charts / Data details / Statistical summary / Global overview / Factor analysis / Cross analysis / AI analysis

## AI Configuration (Optional)

Expand the "AI Configuration" panel on the home page and fill in:

- **API Endpoint**: e.g., `https://api.openai.com/v1` or `https://api.deepseek.com/v1`
- **API Key**: Your API Key
- **Model**: e.g., `gpt-4o`, `deepseek-chat`, etc.

The AI Key is only used within the browser session and will never be stored to a file or uploaded to the server.

## Project Structure

```
├── backend/
│   ├── config/
│   │   ├── domain_strategies.json   # Field mapping + chart configuration for 5 domains
│   │   ├── fill_strategies.json     # Missing-value filling strategies per domain (editable)
│   │   └── semantic_patterns.json   # Regex detection for 35+ semantic types
│   ├── models/
│   │   └── schemas.py               # Pydantic data models
│   ├── services/
│   │   ├── profiler.py              # Intelligent profiling
│   │   ├── mapping_service.py       # Field mapping recommendation
│   │   ├── cleaning_service.py      # Layered cleaning pipeline
│   │   ├── chart_engine.py          # Chart generation & recommendation
│   │   ├── ai_service.py            # LLM invocation
│   │   ├── code_executor.py         # AI code sandbox execution
│   │   ├── data_loader.py           # File parsing
│   │   └── data_processor.py        # Legacy processing pipeline (compatible)
│   ├── main.py                      # FastAPI entry point
│   └── requirements.txt
├── src/
│   ├── components/
│   │   ├── ProfilingReport.tsx      # Profiling report + health score
│   │   ├── MappingConfirmation.tsx  # Mapping confirmation interface
│   │   ├── FieldSelector.tsx        # Field selector
│   │   ├── Dashboard.tsx            # Dashboard main frame
│   │   ├── FilterBar.tsx            # Filter bar
│   │   └── Level*.tsx               # Analysis tab pages
│   ├── api/client.ts                # API client
│   ├── types/index.ts               # TypeScript types
│   └── App.tsx                      # 4-step state machine
├── .env.example                     # Environment variables template
├── package.json
└── README.md
```

## Technology Stack

| Layer          | Technology                      |
|----------------|---------------------------------|
| Frontend Framework | React 19 + TypeScript        |
| Build Tool     | Vite 6                          |
| CSS            | Tailwind CSS 4                  |
| Charts         | Recharts                        |
| Animation      | Motion (framer-motion)          |
| Backend Framework | FastAPI (Python)             |
| Data Processing| Pandas 2.2                      |
| Fuzzy Matching | thefuzz + python-Levenshtein    |
| Serialization  | PyArrow (Parquet)               |

## License

MIT
