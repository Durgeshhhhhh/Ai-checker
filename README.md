# AI Text Detector by Requin Solutions

AI-vs-human text detection web app with:
- sentence-level prediction (`AI` / `Human`) from a trained model,
- file extraction support (`.txt`, `.pdf`, `.docx`, `.pptx`, `.ppt`),
- token-based user access control,
- scan history,
- downloadable branded PDF reports.

## Tech Stack

- Backend: FastAPI (Python)
- ML: XGBoost model + feature extraction pipeline
- DB: MongoDB
- Frontend: HTML/CSS/Vanilla JS

## Project Structure

```text
.
|-- app.py                      # Main FastAPI app
|-- backend/
|   |-- mongo.py                # Mongo connection + bootstrapping
|   |-- security.py             # JWT auth helpers
|   `-- crypto.py               # Password hashing/verification
|-- router/
|   |-- auth.py                 # Login/auth routes
|   `-- admin.py                # Admin routes (users/tokens/logs)
|-- features/
|   `-- feature_extractor.py    # NLP + embedding features
|-- models/
|   |-- xgb_model_.pkl
|   `-- onnx/bert/...
|-- frontend/
|   |-- prediction.html/.js/.css
|   |-- login.html/.css
|   |-- index.html (landing)
|   `-- config.js               # API base URL
`-- requirements.txt
```

## Features

- Analyze pasted text with sentence-level scoring.
- Extract text from uploaded files, then analyze.
- Donut chart + confidence summary in UI.
- Sentence-aware highlighting in results.
- Export a multi-page PDF report with:
  - branded first-page summary,
  - metrics and verdict,
  - detailed highlighted content pages.
- User token accounting per scan.
- User scan history.

## Requirements

- Python 3.10+ (recommended 3.11+)
- MongoDB instance (Atlas/local)
- Model files present in `models/`

## Backend Setup

1. Create and activate virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment (`.env`).
4. Start API:

```bash
uvicorn app:app --reload
```

Default local URL:
- `http://127.0.0.1:8000`

## Frontend Setup

Set API URL in [`frontend/config.js`](/c:/projects/share/frontend/config.js), then install and run frontend tooling:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

- Output directory: `dist/`
- Source maps: disabled (`sourcemap: false` in `vite.config.js`)
- Minifier: `terser`

Preview production bundle locally:

```bash
npm run preview
```

Main page:
- [`frontend/prediction.html`](/c:/projects/share/frontend/prediction.html)

## Environment Variables

Common variables used by app:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `JWT_SECRET_KEY`
- `JWT_EXPIRE_MINUTES`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `CHUNK_SENTENCE_SIZE`
- `MODEL_WARMUP`
- `MAX_UPLOAD_BYTES` (current configured: `20971520` = 20MB)
- `MAX_TEXT_CHARS` (current configured: `300000`)

Model/runtime flags (if used in your deployment):
- `BERT_BACKEND`
- `ONNX_RUNTIME_DOWNLOAD`
- `BERT_DISABLED`
- `ENABLE_PERPLEXITY`
- `BERT_ONNX_URL`
- `BERT_ONNX_DATA_URL`
- `BERT_ONNX_PATH`
- `ONNX_DATA_REQUIRED`

## API Endpoints

### Health
- `GET /` -> service status

### Auth
- `POST /auth/login`

### Prediction
- `POST /predict`
  - body: `{ "text": "..." }`
- `POST /extract-file`
  - multipart file upload, returns extracted plain text
- `POST /predict-file`
  - multipart file upload, extracts + predicts

### History
- `GET /my-history`

### Admin (requires admin role)
- Create users
- List users
- Update user tokens
- View logs

## Extraction Notes

File extraction is normalized to plain text for ML processing:
- PDF: layout-aware extraction when available
- DOCX: paragraphs + list-like structure + table text
- PPTX: slide/paragraph text extraction
- Text normalization includes whitespace cleanup and hyphen-wrap fixes

This improves readability but does not preserve original rich document styling.

## Report Export Notes

The report export in `prediction.js` uses `jsPDF`:
- first page: summary and risk overview,
- following pages: detailed highlighted content,
- watermark + branding on pages.

## Security Notes

- Do not commit real secrets in `.env`.
- Rotate any credentials that were ever shared publicly.
- Use strong `JWT_SECRET_KEY`.

## Troubleshooting

- `PDF libraries failed to load`:
  - verify internet access for CDN scripts in prediction page.
- `Text too large` / `File too large`:
  - adjust `MAX_TEXT_CHARS` / `MAX_UPLOAD_BYTES`.
- `Model not found`:
  - verify files exist in `models/`.
- CORS issues:
  - update allowed origins in `app.py`.

