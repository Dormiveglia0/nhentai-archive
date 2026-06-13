# NH Archive Development Rules

## Non-Negotiables

- Do not seed fake galleries, fake works, fake covers, fake pages, fake job rows, fake file counts, or fake export records into the UI.
- Empty data must render an empty state, a configuration prompt, or a real error from the API.
- Unimplemented modules must be labeled as not connected to real capability. Do not make them look complete.
- Real covers and pages come only from remote imports or user/local CBZ files.
- Sensitive values such as API keys and tokens must never be echoed to the frontend.

## Design Rules

- The active visual source is `design/`: especially `搜索导入.png`, `库.png`, `阅读.png`, `任务中心.png`, and `设置.png`.
- Keep the Doujin Archive Gallery system: warm paper background, black editorial headings, terracotta primary actions, top global bar, secondary nav, right inspectors, and bottom task dock.
- If a module is visually unfinished, prefer a clear boundary screen over a decorative fake dashboard.
- Do not add adult sample assets to the repository. Non-explicit line art or empty-state graphics are allowed.

## Documentation Rules

- Update `docs/PROJECT_STATUS.md` after every meaningful module stage.
- Update `docs/PROJECT_MAP.md` when adding APIs, services, routes, or important data paths.
- `PROJECT_STATUS.md` explains progress and next work. `PROJECT_MAP.md` explains where code lives and how interfaces flow.
