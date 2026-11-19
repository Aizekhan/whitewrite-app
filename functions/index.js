// Cloud Functions entry point. Each module attaches its endpoints to `exports`.
// A ceiling on instances for every function (before any module defines one): a flood on the public endpoints
// (mcp, telemetryIngest, webhooks) or a runaway client can't scale the bill without bound. ~80 requests per instance.
require('firebase-functions/v2').setGlobalOptions({ maxInstances: 20 });
// a module's endpoints only: helpers its tests use (exports._gdd, _mcp, … — tests require the module itself) never become exports of the deploy
const endpoints = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('_')));
Object.assign(exports, endpoints(require('./src/scenes')));
Object.assign(exports, endpoints(require('./src/users')));
Object.assign(exports, endpoints(require('./src/projects')));
Object.assign(exports, endpoints(require('./src/canon-sync')));
Object.assign(exports, endpoints(require('./src/lemon')));
Object.assign(exports, endpoints(require('./src/genesis')));
Object.assign(exports, endpoints(require('./src/gamedev')));
Object.assign(exports, endpoints(require('./src/mcp')));
Object.assign(exports, endpoints(require('./src/agents'))); // 💬 Агенти: the author's posts and approvals, the Telegram webhook, the daily digest (v2.148)
Object.assign(exports, endpoints(require('./src/cosmograph')));
const narrative = require('./src/narrative'); // quests & dialogues: AI drafts (helpers stay internal)
exports.narrativeDraft = narrative.narrativeDraft;
exports.worldFolder = require('./src/world-folder').worldFolder; // «📂 Завантажити теку» of a world: AI sorts the notes into whitewrite.fill/1, the author applies
exports.kbAsk = require('./src/kb-help').kbAsk; // «Запитай Базу знань»: answers only from app/kb.js, free, perDay limit
const experience = require('./src/experience'); // helpers in experience._experience stay internal (mcp.js uses them)
exports.telemetryIngest = experience.telemetryIngest;
exports.experience = experience.experience;
const marketing = require('./src/marketing'); // Mini-Marketing: posts from approved log entries + scheduled publishing
exports.marketing = marketing.marketing;
exports.marketingPublisher = marketing.marketingPublisher;
const community = require('./src/community'); // Спільнота: public showcases, ♥, reports, the home page cards (hourly)
exports.community = community.community;
exports.communityRotate = community.communityRotate;
exports.styleCheck = require('./src/style').styleCheck; // the AI check of a picture against the game's visual style
exports.styleFromRefs = require('./src/style').styleFromRefs; // ✦ the overall style proposed from the reference pictures
exports.voice = require('./src/voice').voice; // 🎙 dialogue voice-over: Google Text-to-Speech (voices, preview, synthesize → Audio library)
exports.cardFill = require('./src/card-fill').cardFill; // 🎙 dictation → the open card's fields (a proposal) · ✦ variants for the 🧠 personality constructor
const modelWatch = require('./src/model-watch'); // Claude versions: daily check + safe auto-switch (helpers stay internal)
exports.modelWatch = modelWatch.modelWatch;
exports.modelWatchRun = modelWatch.modelWatchRun;
const market = require('./src/market'); // Маркет: licence review (frozen world, AI review + AI lawyer), moderation; the buyout — in development (no payment provider)
exports.market = market.market;
exports.licenceReview = market.licenceReview;
exports.team = require('./src/team').team; // Друзі й команда світу (roles; firestore.rules enforce them)
const backup = require('./src/backup'); // daily GitHub backup of the world's text (paid per 30 days)
exports.backup = backup.backup;
exports.backupDaily = backup.backupDaily;
exports.integrations = require('./src/integrations').integrations; // 🔌 the author's own keys for 3D / image generation services (server only)
exports.aiCostDaily = require('./src/cost-watch').aiCostDaily; // daily API cost per user → admin_costs + alarms
exports.reservationSweep = require('./src/cost-watch').reservationSweep; // returns tokens held by AI calls killed by a timeout
const cleanup = require('./src/cleanup'); // after a game / world / story is deleted: tokens, keys, showcases, Storage, leftovers
exports.gameDeleted = cleanup.gameDeleted;
exports.worldDeleted = cleanup.worldDeleted;
exports.projectDeleted = cleanup.projectDeleted; // a deleted story: its scenes and cover
const quota = require('./src/storage-quota'); // Storage quota of the plan: storageUsage/{w}, a file past it is deleted
exports.storageUploaded = quota.storageUploaded;
exports.storageRemoved = quota.storageRemoved;
