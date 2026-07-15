# NH Archive

Local-first personal doujin archive platform. The first implementation slice builds the real path from remote discovery to CBZ import, local library reading, and persisted reader progress.

## Run

Install dependencies once:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend install
```

Start the whole project from the repository root:

```bash
npm run dev
```

This starts FastAPI on `http://127.0.0.1:8001` and Vite on `http://127.0.0.1:5173`. Press `Ctrl+C` once to stop both. The frontend proxies `/api` to the backend automatically.

Set `NHENTAI_API_KEY` on the same command when needed:

```bash
NHENTAI_API_KEY=your_key npm run dev
```

## Data

By default, local data is stored in `backend/.local-data/`:

- `archive.db`: SQLite metadata.
- `library/`: imported source CBZ files.
- `covers/`: extracted cover images.
- `pages/`: reserved page cache directory.
- `tmp/`: temporary downloads.
- `exports/`: reserved export directory.

Set `NH_ARCHIVE_DATA_DIR` to move the library outside the repo.
