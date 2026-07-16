# NH Archive

Local-first personal doujin archive platform. The first implementation slice builds the real path from remote discovery to CBZ import, local library reading, and persisted reader progress.

## Run

Install dependencies once:

```bash
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements.txt
npm --prefix apps/web install
```

Start the whole project from the repository root:

```bash
npm run dev
```

This starts FastAPI on `http://127.0.0.1:8001` and Vite on `http://127.0.0.1:5173`. Press `Ctrl+C` once to stop both. The web app proxies `/api` to the API automatically.

Set `NHENTAI_API_KEY` on the same command when needed:

```bash
NHENTAI_API_KEY=your_key npm run dev
```

## Data

By default, local data is stored in the repository-level `.local-data/` directory, outside both applications:

- `archive.db`: SQLite metadata, API keys, and saved application settings.
- `library/`: remote-downloaded CBZ files and the drop directory for local imports.
- `covers/`: extracted cover images.
- `pages/`: reserved page cache directory.
- `tmp/`: temporary downloads.
- `exports/`: reserved export directory.

Set `NH_ARCHIVE_DATA_DIR` to move the library outside the repo.

## Docker Compose

Start the app at `http://127.0.0.1:4349`:

```bash
docker compose up -d
```

Compose uses the published `ghcr.io/dormiveglia0/nhentai-archive:latest` image and mounts `./.local-data` directly at `/data`. API keys and settings saved in the Web UI persist in `./.local-data/archive.db`. Remote downloads and CBZ files copied in for local import share `./.local-data/library`; place local CBZ files there, then scan the library in the app.

Update or stop the service with:

```bash
docker compose pull
docker compose up -d
docker compose down
```
