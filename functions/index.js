// Cloud Functions entry point. Each module attaches its endpoints to `exports`.
Object.assign(exports, require('./src/scenes'));
Object.assign(exports, require('./src/users'));
Object.assign(exports, require('./src/projects'));
Object.assign(exports, require('./src/stripe'));
Object.assign(exports, require('./src/canon-sync'));
Object.assign(exports, require('./src/economy-admin'));
Object.assign(exports, require('./src/lemon'));
Object.assign(exports, require('./src/genesis'));
Object.assign(exports, require('./src/gamedev'));
Object.assign(exports, require('./src/mcp'));
Object.assign(exports, require('./src/cosmograph'));
const experience = require('./src/experience'); // helpers in experience._experience stay internal (mcp.js uses them)
exports.telemetryIngest = experience.telemetryIngest;
exports.experience = experience.experience;
const modelWatch = require('./src/model-watch'); // Claude versions: daily check + safe auto-switch (helpers stay internal)
exports.modelWatch = modelWatch.modelWatch;
exports.modelWatchRun = modelWatch.modelWatchRun;
