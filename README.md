# GrowEasy AI CSV Importer

An AI-powered CSV importer that accepts arbitrary lead exports, previews the raw data first, and converts confirmed rows into the GrowEasy CRM schema.

## What This Solves

Lead CSVs rarely arrive with perfect column names. This app handles exports from Facebook, Google Ads, real estate CRMs, agency sheets, and hand-made spreadsheets by using an LLM-backed extraction pipeline with deterministic validation and fallback safety.

## Highlights

- Next.js responsive UI with drag-and-drop upload, file picker, dark mode, sticky tables, loading states, and large-table rendering guardrails.
- Confirm-before-processing workflow: CSV preview happens in the browser; the backend is called only after the user confirms.
- Express TypeScript API with CSV parsing, AI batching, retries, quota/error fallback, schema validation, and CRM normalization.
- Provider support for OpenAI, OpenRouter, Gemini, Claude, and local mock fallback.
- Download parsed CRM records as CSV or the full import response as JSON.
- Import metadata: provider, model, fallback usage, batch count, processing time, and field completeness score.
- Skips rows without email or mobile number.
- Moves extra emails/mobiles and ambiguous details into `crm_note`.
- Unit tests, Docker setup, sample datasets, and production deployment notes.

## CRM Output Fields

```text
created_at, name, email, country_code, mobile_without_country_code, company,
city, state, country, lead_owner, crm_status, crm_note, data_source,
possession_time, description
```

Allowed `crm_status` values:

```text
GOOD_LEAD_FOLLOW_UP
DID_NOT_CONNECT
BAD_LEAD
SALE_DONE
```

Allowed `data_source` values:

```text
leads_on_demand
meridian_tower
eden_park
varah_swamy
sarjapur_plots
```

## Architecture

```text
apps/web          Next.js frontend
apps/api          Express backend
packages/shared   Shared CRM types/constants
samples            Messy CSV test files
```

Flow:

```text
Upload CSV -> Browser preview -> Confirm -> Express API -> CSV parse
-> batched AI extraction -> validation/normalization -> structured JSON
-> result tables + downloads
```

## AI Strategy

The backend sends rows in batches with a strict extraction prompt. The prompt instructs the model to:

- map arbitrary columns into the GrowEasy CRM schema
- keep only the first email/mobile as primary
- append extra emails/mobiles into `crm_note`
- use allowed status/source values only
- skip rows with neither email nor mobile
- return structured JSON only

After AI extraction, the backend still performs deterministic cleanup:

- validates schema with Zod
- normalizes phone numbers and dates
- cleans line breaks for CSV compatibility
- validates allowed status/source values
- improves common India city/state mappings
- computes confidence and completeness metadata

If the AI provider fails due to quota, invalid JSON, or provider errors, the app uses a deterministic local extractor so demos and reviews still complete.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/health
```

## Environment

For stable local testing:

```env
AI_PROVIDER=mock
```

For OpenRouter:

```env
AI_PROVIDER=openai
AI_FALLBACK_ON_ERROR=true
OPENAI_API_KEY=your_openrouter_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=deepseek/deepseek-chat-v3-0324
OPENAI_MAX_TOKENS=4096
```

For official OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
```

For Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-flash-latest
```

## API

### `POST /api/import`

Multipart form-data:

```text
file: CSV file
```

Response includes:

- `records`: valid GrowEasy CRM records
- `quality`: confidence/completeness per imported row
- `skipped`: invalid rows with original data
- `summary`: total/imported/skipped/completeness
- `meta`: provider/model/fallback/batch information

## Sample CSVs

```text
samples/facebook-leads.csv
samples/google-ads-leads.csv
samples/messy-real-estate.csv
samples/multiple-contacts.csv
samples/bad-data.csv
```

## Docker

```bash
docker compose up --build
```

## Scripts

```bash
npm run dev
npm run build
npm test
```

## Deployment

Recommended:

- Deploy `apps/web` to Vercel.
- Deploy `apps/api` to Render, Railway, Fly.io, or similar.
- Set `NEXT_PUBLIC_API_URL` in the frontend deployment to the API URL.
- Set `CLIENT_ORIGIN` in the API deployment to the frontend URL.

## Production Notes

- Keep `AI_FALLBACK_ON_ERROR=true` for demos and unreliable free-tier AI quotas.
- Use provider billing or a paid model route for production reliability.
- The app is stateless and does not require a database.
- The importer caps file size to 8 MB and previews up to 1,000 rows in the browser.

## Position Applied For

Software Developer Intern
