// bun test runs every suite in one process; setCustomSQLite must run before ANY
// Database is constructed, so it lives in this preload (registered in bunfig.toml).
import { initCustomSqlite } from './src/memory/recall/vecRuntime';

initCustomSqlite();

// Bun auto-loads .env, which carries real API keys on dev machines. Unit tests
// must never hit the network ambiently — suites that test embedding opt back in
// with a fake client.
Bun.env['LUNA_MEMORY_EMBEDDING'] = '0';
