import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen


def _download(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)

    # Basic streaming download with a browser-like UA (some hosts block default UA).
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (render-build)"})
    with urlopen(req, timeout=300) as r:
        if getattr(r, "status", 200) >= 400:
            raise RuntimeError(f"Download failed ({r.status}) for {url}")

        tmp = dst.with_suffix(dst.suffix + ".tmp")
        with open(tmp, "wb") as f:
            while True:
                chunk = r.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        tmp.replace(dst)


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    raw_onnx_path = Path(os.getenv("BERT_ONNX_PATH", "models/onnx/minilm/model.onnx"))
    onnx_path = raw_onnx_path if raw_onnx_path.is_absolute() else (project_root / raw_onnx_path)
    data_path = onnx_path.with_suffix(onnx_path.suffix + ".data")

    onnx_url = os.getenv(
        "BERT_ONNX_URL",
        "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx",
    ).strip()
    data_url = os.getenv("BERT_ONNX_DATA_URL", "").strip()
    onnx_data_required = os.getenv("ONNX_DATA_REQUIRED", "0").strip().lower() in {"1", "true", "yes", "on"}
    needs_data = onnx_data_required or bool(data_url)

    print(f"Resolved ONNX target: {onnx_path}")
    print(f"Resolved ONNX data target: {data_path}")

    # If files already exist (e.g. cached build), do nothing.
    if onnx_path.exists() and ((not needs_data) or data_path.exists()):
        print("ONNX already present.")
        return 0

    if not onnx_url:
        print("Missing ONNX file and no download URL configured.")
        print("Set BERT_ONNX_URL as Render environment variable.")
        print(f"Expected path: {onnx_path}")
        return 2

    print(f"Downloading ONNX graph -> {onnx_path}")
    _download(onnx_url, onnx_path)

    if needs_data:
        if not data_url:
            print("ONNX external data is required but BERT_ONNX_DATA_URL is missing.")
            return 2
        print(f"Downloading ONNX weights -> {data_path}")
        _download(data_url, data_path)

    if not onnx_path.exists() or onnx_path.stat().st_size == 0:
        raise RuntimeError("Downloaded model.onnx is missing/empty")
    if needs_data and (not data_path.exists() or data_path.stat().st_size == 0):
        raise RuntimeError("Downloaded model.onnx.data is missing/empty")

    print("ONNX download complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
