// Cloud Functions entry point. Each module attaches its endpoints to `exports`.
Object.assign(exports, require('./src/scenes'));
Object.assign(exports, require('./src/users'));
Object.assign(exports, require('./src/projects'));
Object.assign(exports, require('./src/canon-sync'));
Object.assign(exports, require('./src/lemon'));
Object.assign(exports, require('./src/genesis'));
Object.assign(exports, require('./src/gamedev'));
Object.assign(exports, require('./src/mcp'));
Object.assign(exports, require('./src/cosmograph'));
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
const modelWatch = require('./src/model-watch'); // Claude versions: daily check + safe auto-switch (helpers stay internal)
exports.modelWatch = modelWatch.modelWatch;
exports.modelWatchRun = modelWatch.modelWatchRun;
const market = require('./src/market'); // Маркет: licence review (frozen world, AI review + AI lawyer), Stripe Connect buyout, transfer
exports.market = market.market;
exports.marketWebhook = market.marketWebhook;
exports.licenceReview = market.licenceReview;
exports.team = require('./src/team').team; // Друзі й команда світу (roles; firestore.rules enforce them)
const backup = require('./src/backup'); // daily GitHub backup of the world's text (paid per 30 days)
exports.backup = backup.backup;
exports.backupDaily = backup.backupDaily;
exports.integrations = require('./src/integrations').integrations; // 🔌 the author's own keys for 3D / image generation services (server only)
exports.aiCostDaily = require('./src/cost-watch').aiCostDaily; // daily API cost per user → admin_costs + alarms
