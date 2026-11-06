# WhiteWrite ⇄ RPG Framework: telemetry & world-generation contract

For the agent working on RPG Framework (`D:\RPG-Framework`). The source of truth is the WhiteWrite MCP server — call the tools, this file only says where to look.

## World generation (spec part I)
- `get_world_generation_spec` — the game's approved «Генерація світу» section by kind (biomes, route / environment / gameplay modules, atmospheric scenarios, generation rules), with module contracts, rules, atmosphere, validators and design intent; plus the world sky (day length, suns, moons, calendar).
- `get_biome_profile {name}`, `get_module_contract {name}`, `get_environmental_profile`.
- Audit the framework first (exists / partly / missing / needs refactoring, with files and types), never duplicate a service or invent an API; differences from the spec → `submit_change_request`.

## Telemetry SDK (spec part II, §12)
- `get_telemetry_schema` returns the endpoint, auth, batching rules, the event envelope, standard + custom events, meaningful events, the id map (zone / level / mechanic ids = Bible card ids, with design intent), running A/B experiments (variant assignment) and active playtest surveys.
- Endpoint: `POST https://us-central1-whitewrite-app.cloudfunctions.net/telemetryIngest`, header `Authorization: Bearer wwi_…` (write-only, per game, made in the Game Bible → «Досвід гравців» → Підключення). Body `{ "events": [ ≤500 envelopes ] }` → `{ accepted, rejected: [{ i, reason }] }`.
- Envelope: `event_id` (UUID, dedupe), `event_name`, `schema_version`, `build_id`, `session_id`, `player_id` (pseudonymous salted hash), `timestamp` (Unix ms), optional `game_time`, `level_id`, `zone_id`, `entity_id`, `mechanic_id`, `quest_id`, `position [x,y,z]`, `context { platform, mode, cohort, variant }`, `properties` (≤20 primitives).
- Rules: opt-in consent + opt-out; local queue, batches every 30–60 s and on pause/SessionEnded, retry with backoff, never on the game thread; no per-frame events — movement is `PositionSample` ≤ 1 per 5 s; surveys answer with `SurveyAnswered { playtest, question, answer }`.
- **Done in RPG Framework 0.41.0** (2026-11-06): module `telemetry` — `TelemetryClient` / `TelemetryModule(endpoint, wwi_ key)` (consent in PlayerPrefs, batches ≤ 500 every 30 s and on pause / SessionEnded, worker thread, backoff on 0 / 408 / 429 / 5xx, rejected counted, `PositionSample` ≤ 1 per 5 s, `SurveyAnswered`); combat events via `Integration.ActionCombatTelemetry` (`combat_hit`, `combat_miss`, `combat_blocked`, `combat_parried`, `combat_dodged`, `combat_habit_learnt`, `combat_enemy_died`, `combat_summary`; `mechanic_id` = the mechanic card id). KI-25: in-memory queue, HttpClient — not WebGL. World generation (part I) is not done yet.

## Closing the loop
- Experience issues: `get_experience_issue {id?}`; tasks `EX.n` arrive through `get_next_task`.
- After a change: `submit_task_result`, then `submit_validation_result { issue_id, summary, outcome, evidence }`. The author confirms with metrics from a new playtest.
