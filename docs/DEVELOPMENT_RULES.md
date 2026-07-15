# NH Archive Development Rules

## Non-Negotiables

- Do not seed fake galleries, fake works, fake covers, fake pages, fake job rows, fake file counts, or fake export records into the UI.
- Empty data must render an empty state, a configuration prompt, or a real error from the API.
- Unimplemented modules must be labeled as not connected to real capability. Do not make them look complete.
- Real covers and pages come only from remote imports or user/local CBZ files.
- Sensitive values such as API keys and tokens must never be echoed to the frontend.

## Design Rules

- The maintained visual source is `frontend/src/components/folio/`, `/demo`, and each formal route's feature-local CSS; use `docs/AGENT_MAP.md` to find the owner.
- Keep the Doujin Archive Gallery system: warm paper background, black editorial headings, terracotta primary actions, top global bar, secondary nav, right inspectors, and bottom task dock.
- If a module is visually unfinished, prefer a clear boundary screen over a decorative fake dashboard.
- Do not add adult sample assets to the repository. Non-explicit line art or empty-state graphics are allowed.

## Architecture Rules

- Keep `backend/app/main.py` limited to application creation, middleware, and lifespan hooks. Put HTTP adapters in `backend/app/api/<domain>.py`, request models in `api/schemas.py`, dependency assembly in `container.py`, and business behavior in `services/`.
- Keep frontend feature state and page composition in its feature folder. Move genuinely reused visual components to `components/folio/` and cross-feature formatting/navigation helpers to `lib/`; do not make one feature folder another feature's utility library.

## Documentation Rules

- Update `docs/PROJECT_STATUS.md` after every meaningful module stage.
- Update `docs/PROJECT_MAP.md` when adding APIs, services, routes, or important data paths.
- `PROJECT_STATUS.md` explains progress and next work. `PROJECT_MAP.md` explains where code lives and how interfaces flow.
