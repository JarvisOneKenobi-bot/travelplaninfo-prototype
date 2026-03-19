import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "tpi.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

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
  `);

  return _db;
}
