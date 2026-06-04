# WhiteWrite — стартовий пакет (greenfield)

Розпакуй цю теку в `E:\WhiteWrite`. Усередині:

```
WhiteWrite-start/
├── CLAUDE.md          ← памʼять проекту (інваріанти, roadmap, статус)
├── handoff/           ← мозок: схема, плани, контракти, готовий код
│   ├── README.md, SESSION_DIGEST.md
│   ├── BACKEND_PLAN.md       (план бекенду — greenfield)
│   ├── CANON_SCHEMA.md       (модель даних canon)
│   ├── AI_CONTRACTS.md       (контракти AI-генерації)
│   ├── EDIT_TO_CANON.md      (інлайн-редагування)
│   ├── LANDING_PROJECTS.md, UI_PORT_PLAN.md
│   ├── CLAUDE_invariants.md  (НЕ порушувати)
│   ├── deriveMemory.ts, extractCanonPrompt.ts  (готовий код)
└── prototype/         ← візуальний еталон (портувати 1:1)
    ├── White.html              (шел — точка входу)
    ├── WhiteWrite.html         (Книга)
    ├── WhiteWrite WorldTree.html (Всесвіт)
    ├── WhiteWrite Workspace.html (Режисер)
    ├── *.jsx, *.js             (логіка прототипу)
    └── assets/                 (картинки, шрифти, відео, заглушки ph-*)
```

## Перше повідомлення для нового Claude Code (скопіюй дослівно):

---
Greenfield-проєкт **WhiteWrite**. Старого коду немає. Контекст — у `handoff/`, візуальний еталон — у `prototype/` (HTML-прототип, портувати 1:1, але це НЕ фінальний стек).

Прочитай у порядку: `CLAUDE.md` → `handoff/SESSION_DIGEST.md` → `handoff/BACKEND_PLAN.md` → `handoff/CANON_SCHEMA.md` → `handoff/AI_CONTRACTS.md` → `handoff/EDIT_TO_CANON.md` → `handoff/CLAUDE_invariants.md`.

Зроби по кроках, питаючи перед великим обсягом коду:
1. `git init` + remote (мій новий repo) + перший коміт.
2. Vite + React + TS + React Router.
3. Firebase init (Auth + Firestore) — скажи, коли треба мій конфіг.
4. Типи `Canon*` + `deriveMemory.ts` у `src/shared`.
5. Лендінг (екран мага) із `prototype/assets/StartBack.jpg`, портни 1:1 з `prototype/WhiteWrite.html`.

Інваріанти: **Canon = джерело правди, Memory = View**. Без оплати, без міграції. Фронт — з прототипу; бекенд — чисто під canon.
---

Розпакував — і запускай Claude Code в `E:\WhiteWrite`.
