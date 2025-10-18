# Fig Ops — Static GitHub Pages App

A local-first, static SPA to manage fig saplings operations.  
- Deployed on **GitHub Pages** (free, permanent).  
- Data stored as **JSONL files** in `/data` of this repo.  
- Works on phone & computer, offline (PWA).  
- Real-time charts via Chart.js.  
- Extensible: add new JSONL files, tables, or charts easily.

## Deploy
1. Create a new repo and upload these files (or upload the zip).  
2. In **Settings → Pages**, set Branch = `main` and Folder = `/ (root)`.  
3. Open your site URL (e.g., `https://<user>.github.io/<repo>`).

## Writing data to repo
- In **Settings → Developer settings → Fine-grained PAT**, create a token with `Contents: Read and Write` for this repo.
- In **Settings tab** inside the app, enter Owner/Repo/Branch/Token.
- The app writes JSONL to `/data/*.jsonl` using GitHub REST API (`PUT /contents`).  
  Token is kept only on your device (localStorage).

## Data portability
- All records live in `/data/*.jsonl` (JSON Lines); any tool can read them.  
- Use **Export All** to download data as a single JSON file for backup or migration.

## Extend
- Add fields to schemas in `/schema`.  
- Modify UI & analytics in `/modules/*.js`.  
- Add new charts by extending `analytics.js` and `charts.js`.

## Security note
- Your token stays on your device; never share the app URL with token included.
