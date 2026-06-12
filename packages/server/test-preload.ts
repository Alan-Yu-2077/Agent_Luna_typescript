// bun test runs every suite in one process; setCustomSQLite must run before ANY
// Database is constructed, so it lives in this preload (registered in bunfig.toml).
import { initCustomSqlite } from './src/memory/recall/vecRuntime';

initCustomSqlite();
