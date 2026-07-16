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

- `archive.db`: SQLite metadata.
- `library/`: imported source CBZ files.
- `covers/`: extracted cover images.
- `pages/`: reserved page cache directory.
- `tmp/`: temporary downloads.
- `exports/`: reserved export directory.

Set `NH_ARCHIVE_DATA_DIR` to move the library outside the repo.

## Docker Compose

Build and start the app at `http://127.0.0.1:8001`:

```bash
docker compose up -d --build
```

Compose uses the published `ghcr.io/dormiveglia0/nhentai-archive:latest` image and a persistent named volume. To reuse the repository's existing data, run with the host user and bind the current data directory:

```bash
NH_ARCHIVE_DATA_PATH=./.local-data \
NH_ARCHIVE_UID=$(id -u) \
NH_ARCHIVE_GID=$(id -g) \
docker compose up -d
```

Optional settings can be placed in an ignored `.env` file:

```dotenv
NHENTAI_API_KEY=
NH_ARCHIVE_BIND=127.0.0.1
NH_ARCHIVE_PORT=8001
IMAGE_TAG=latest
```

Update or stop the service with:

```bash
docker compose pull
docker compose up -d
docker compose down
```
