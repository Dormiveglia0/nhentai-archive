# Repository Guidelines

## Project Structure & Module Organization

NH Archive is a local-first React + FastAPI + SQLite application.

For frontend work, read `docs/AGENT_MAP.md` first. It maps each demo module, scene animation, CSS layer, formal component, and real API entry so agents can load only the files relevant to the change.

- `backend/app/`: FastAPI entrypoint, SQLite schema, config, and service modules.
- `backend/app/services/`: domain services such as discovery, import, archive parsing, reader state, settings, jobs, and dictionary logic.
- `backend/tests/`: focused pytest coverage for backend services and API behavior.
- `frontend/src/`: React application code, grouped by `components/`, `lib/`, and global styles.
- `frontend/src/components/`: feature folders for discover, library, reader, dictionary, settings, and shell layout.
- `frontend/src/components/folio/`: current visual system; use `/demo` and formal feature CSS as the maintained UI baseline.
- `docs/`: project map, status, development rules, and next-stage prompts for future agents.

## Build, Test, and Development Commands

- Backend dev server: `PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001`
- Backend tests: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
- Frontend dev server: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- Frontend preview: `cd frontend && npm run preview`

Use `VITE_API_PROXY_TARGET=http://127.0.0.1:8001` when the frontend must proxy to a non-default backend port.

## Coding Style & Naming Conventions

Python uses small service classes, explicit return dictionaries, and SQLite access through the existing database helpers. Keep API routes thin and put business logic in `backend/app/services/*_service.py`.

React uses TypeScript components with PascalCase filenames, feature-local components, and shared API types in `frontend/src/lib/api.ts`. Keep styling in the existing CSS system unless a feature already has a localized style pattern.

## Testing Guidelines

Use pytest for backend tests. Add small, real-behavior tests only; avoid large fixtures and generated fake libraries. Test names should describe behavior, for example `test_preview_apply_does_not_write`.

Frontend verification currently relies on `npm run build` plus browser/screenshot checks for visual changes. Do not add mock作品、假任务、随机统计、硬编码 tag 候选, or adult sample assets.

## Commit & Pull Request Guidelines

Recent commits use short imperative or descriptive messages, often in Chinese, for example `rebuild settings and discover baseline` or `热门模块动画效果完成`. Keep commits scoped to one stage or bugfix.

Pull requests should include: changed module summary, verification commands and results, UI screenshots for visual work, API or schema notes, and any known limitations. Update `docs/PROJECT_MAP.md`, `docs/PROJECT_STATUS.md`, and `docs/NEXT_STAGE_PROMPT.md` when module boundaries or stage status change.

## Security & Configuration Tips

Never commit `.env`, API keys, imported CBZ files, generated page caches, or `backend/.local-data/`. Settings APIs must report whether sensitive values are configured, not return plaintext secrets.
