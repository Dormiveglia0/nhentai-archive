# NHentai v2 Archive Platform

Single-admin web platform for authorized personal archive workflows. The service imports gallery IDs or search results, queues downloads, writes CBZ files with `ComicInfo.xml`, and maintains an independent tag/title dictionary plus machine-translation suggestions.

## Run

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173` and log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

For a public host, set these values in `.env` before rebuilding:

```bash
CORS_ORIGINS=http://your-domain:5173
VITE_ALLOWED_HOSTS=your-domain
VITE_API_BASE_URL=http://your-domain:8000
```

If `VITE_API_BASE_URL` is blank, the frontend uses the current browser hostname and port `8000`.

## Configuration

- `TRANSLATION_PROVIDER`: `none`, `deepl`, or `google`
- `DEEPL_API_KEY`: required when using DeepL
- `GOOGLE_TRANSLATE_API_KEY`: required when using Google Translate API
- `DATA_DIR`, `DATABASE_PATH`, `LIBRARY_DIR`: storage locations inside the backend container

The app refuses to bypass remote access controls. Use it only for works you are authorized to preserve.
