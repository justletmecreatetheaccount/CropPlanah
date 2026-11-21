-- Communities the hub knows about, learned from first contact
CREATE TABLE IF NOT EXISTS communities (
    id         TEXT PRIMARY KEY,   -- the UUID from that community's config
    name       TEXT NOT NULL,
    lat        REAL NOT NULL,
    lon        REAL NOT NULL,
    last_seen  TEXT NOT NULL       -- last time we heard from it, drives "stale" markers
);

-- Outbreak reports pushed by communities, self-describing
CREATE TABLE IF NOT EXISTS outbreak_reports (
    id            INTEGER PRIMARY KEY,
    community_id  TEXT NOT NULL REFERENCES communities(id),
    crop          TEXT,
    pathogen      TEXT NOT NULL,
    lat           REAL,
    lon           REAL,
    reported_at   TEXT NOT NULL
);

-- Marketplace listings, same self-describing style
CREATE TABLE IF not EXISTs market_listings (
    id            INTEGER PRIMARY KEY,
    community_id  TEXT NOT NULL REFERENCES communities(id),
    crop          TEXT NOT NULL,
    kg            REAL NOT NULL,
    kcal_per_kg   REAL NOT NULL,
    expires_at    TEXT NOT NULL,   -- food rots in transit, ledger lesson applies here too
    listed_at     TEXT NOT NULL
);
