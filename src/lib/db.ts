import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "tpi.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT,
      password_hash TEXT,
      provider      TEXT NOT NULL DEFAULT 'credentials',
      guest_token   TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      destination        TEXT NOT NULL,
      start_date         TEXT,
      end_date           TEXT,
      budget             TEXT,
      travelers_adults   INTEGER NOT NULL DEFAULT 1,
      travelers_children INTEGER NOT NULL DEFAULT 0,
      rooms              INTEGER NOT NULL DEFAULT 1,
      interests          TEXT NOT NULL DEFAULT '[]',
      status             TEXT NOT NULL DEFAULT 'planning',
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trip_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id           INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day_number        INTEGER NOT NULL DEFAULT 1,
      category          TEXT NOT NULL DEFAULT 'note',
      title             TEXT NOT NULL,
      description       TEXT,
      affiliate_program TEXT,
      affiliate_url     TEXT,
      price_estimate    TEXT,
      booked            INTEGER NOT NULL DEFAULT 0,
      sort_order        INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
      source        TEXT
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      prefs      TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id         TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
      content    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_memory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      source     TEXT DEFAULT 'atlas',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id);
  `);

  // Migration: geocoding_cache table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS geocoding_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT UNIQUE NOT NULL,
      latitude REAL, longitude REAL, place_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_geocoding_cache_query ON geocoding_cache(query);
  `);

  // Migration: map feature columns on trip_items
  const mapMigrations = [
    "ALTER TABLE trip_items ADD COLUMN latitude REAL",
    "ALTER TABLE trip_items ADD COLUMN longitude REAL",
    "ALTER TABLE trip_items ADD COLUMN place_id TEXT",
    "ALTER TABLE trip_items ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 0",
  ];
  for (const sql of mapMigrations) {
    try {
      _db.exec(sql);
    } catch (e: unknown) {
      if (!(e instanceof Error) || !e.message.includes("duplicate column")) throw e;
    }
  }

  // Data migration: normalize 'car' category to 'car_rental'
  _db.exec("UPDATE trip_items SET category = 'car_rental' WHERE category = 'car'");

  // Migration: add guest_token column to existing DBs
  const userCols = _db.pragma("table_info(users)") as { name: string }[];
  if (!userCols.some((c) => c.name === "guest_token")) {
    _db.exec("ALTER TABLE users ADD COLUMN guest_token TEXT");
  }
  _db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_guest_token ON users(guest_token) WHERE guest_token IS NOT NULL");

  // Migration: add flexible date + origin fields to trips
  const tripCols = _db.pragma("table_info(trips)") as { name: string }[];
  if (!tripCols.some((c) => c.name === "flexible_window")) {
    _db.exec("ALTER TABLE trips ADD COLUMN flexible_window TEXT");
    _db.exec("ALTER TABLE trips ADD COLUMN trip_length TEXT");
  }
  if (!tripCols.some((c) => c.name === "origin")) {
    _db.exec("ALTER TABLE trips ADD COLUMN origin TEXT");
    _db.exec("ALTER TABLE trips ADD COLUMN nearby_airports TEXT");
  }

  return _db;
}
