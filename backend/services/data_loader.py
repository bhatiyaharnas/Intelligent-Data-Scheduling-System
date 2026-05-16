import json
from pathlib import Path

import pandas as pd
import chardet


class DataLoader:
    def __init__(self, temp_dir: Path):
        self.temp_dir = temp_dir

    def load_file(self, file_path: str) -> pd.DataFrame:
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext == ".csv":
            return self._load_csv(path)
        elif ext in (".xlsx", ".xls"):
            return self._load_excel(path)
        elif ext == ".json":
            return self._load_json(path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}，支持 CSV/Excel/JSON")

    def _load_csv(self, path: Path) -> pd.DataFrame:
        raw = path.read_bytes()
        detected = chardet.detect(raw)
        encoding = detected.get("encoding", "utf-8")
        if encoding and "gb" in encoding.lower():
            encoding = "gbk"

        encodings = [encoding, "utf-8", "gbk", "gb2312", "latin-1"]
        tried = set()

        for enc in encodings:
            if enc is None or enc in tried:
                continue
            tried.add(enc)
            try:
                return pd.read_csv(path, encoding=enc)
            except (UnicodeDecodeError, UnicodeError):
                continue

        return pd.read_csv(path, encoding="gbk")

    def _load_excel(self, path: Path) -> pd.DataFrame:
        return pd.read_excel(path, engine="openpyxl")

    def _load_json(self, path: Path) -> pd.DataFrame:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            return pd.DataFrame(data)
        elif isinstance(data, dict):
            # Try common orient keys
            for key in ("data", "records", "rows", "items"):
                if key in data and isinstance(data[key], list):
                    return pd.DataFrame(data[key])
            # orient guessing
            if "columns" in data and "data" in data:
                return pd.DataFrame(data["data"], columns=data["columns"])
            if "index" in data and "values" in data:
                return pd.read_json(json.dumps(data))

        return pd.read_json(path, encoding="utf-8")

    def load_api_data(self, json_data: list | dict) -> pd.DataFrame:
        if isinstance(json_data, list):
            return pd.DataFrame(json_data)
        elif isinstance(json_data, dict):
            for key in ("data", "records", "rows", "items"):
                if key in json_data and isinstance(json_data[key], list):
                    return pd.DataFrame(json_data[key])
            return pd.DataFrame([json_data])
        return pd.DataFrame()
