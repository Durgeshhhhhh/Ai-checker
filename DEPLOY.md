# Deploy Guide (Render + Vercel)

This backend computes features using BERT embeddings. To avoid out-of-memory errors on small instances, the backend is configured to run BERT via ONNX Runtime by default and to not load GPT-2 perplexity unless explicitly enabled.

## Render (backend)

`render.yaml` is included and runs:

- `python scripts/fetch_onnx.py`
- `pip install -r requirements.txt`

### 1) Host the 2 ONNX files somewhere

You must host these files with direct download links:

- `model.onnx`
- `model.onnx.data`

### 2) Set Render environment variables

In Render Dashboard -> Service -> Environment, set:

- `BERT_ONNX_URL` = direct URL to `model.onnx`
- `BERT_ONNX_DATA_URL` = direct URL to `model.onnx.data`

Optional (defaults shown):

- `BERT_ONNX_PATH=models/onnx/bert/model.onnx`
- `BERT_BACKEND=onnx`
- `ENABLE_PERPLEXITY=0` (recommended to avoid loading GPT-2)

The build step downloads files to:

- `models/onnx/bert/model.onnx`
- `models/onnx/bert/model.onnx.data`

### 3) Required backend variables

Also set:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `JWT_SECRET_KEY`
- `JWT_EXPIRE_MINUTES`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

Health endpoint:

- `GET /`

## Vercel (frontend)

Set project root directory to `frontend`.

After backend deploy, update:

- `frontend/config.js`
  - Replace `https://YOUR_RENDER_BACKEND_URL.onrender.com` with your Render API URL.

Then redeploy frontend.

## Production Safety Checks

- Confirm backend has `AUTH_DISABLED=false`.
- Login with admin credentials.
- Create a user from admin panel.
- Run a text scan and verify response time and history update.

