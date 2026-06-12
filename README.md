# NH Archive

Local-first personal doujin archive platform. The first implementation slice builds the real path from remote discovery to CBZ import, local library reading, and persisted reader progress.

## Run

Backend:

```bash
cd backend
python3 -m pip install -r requirements.txt
NHENTAI_API_KEY=your_key uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to `http://127.0.0.1:8000`.

## Data

By default, local data is stored in `backend/.local-data/`:

- `archive.db`: SQLite metadata.
- `library/`: imported source CBZ files.
- `covers/`: extracted cover images.
- `pages/`: reserved page cache directory.
- `tmp/`: temporary downloads.
- `exports/`: reserved export directory.

Set `NH_ARCHIVE_DATA_DIR` to move the library outside the repo.
