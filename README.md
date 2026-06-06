# NHentai v2 Archive Platform

Single-admin web platform for authorized personal archive workflows. The service imports gallery IDs or search results, queues downloads, writes CBZ files with `ComicInfo.xml`, and maintains an independent tag/title dictionary plus machine-translation suggestions.

## Run

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173` and log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Configuration

- `TRANSLATION_PROVIDER`: `none`, `deepl`, or `google`
- `DEEPL_API_KEY`: required when using DeepL
- `GOOGLE_TRANSLATE_API_KEY`: required when using Google Translate API
- `DATA_DIR`, `DATABASE_PATH`, `LIBRARY_DIR`: storage locations inside the backend container

The app refuses to bypass remote access controls. Use it only for works you are authorized to preserve.
