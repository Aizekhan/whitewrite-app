// Cloud Functions entry point. Each module attaches its endpoints to `exports`.
Object.assign(exports, require('./src/scenes'));
Object.assign(exports, require('./src/users'));
Object.assign(exports, require('./src/stripe'));
Object.assign(exports, require('./src/canon-sync'));
Object.assign(exports, require('./src/economy-admin'));
Object.assign(exports, require('./src/lemon'));
Object.assign(exports, require('./src/genesis'));
Object.assign(exports, require('./src/gamedev'));
Object.assign(exports, require('./src/mcp'));
