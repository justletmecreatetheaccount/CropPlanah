-- Crop Planner, community server schema
-- Run at every startup: CREATE TABLE IF NOT EXISTS everywhere, safe to repeat.

CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY,
    name             TEXT UNIQUE NOT NULL,
    password_hash    TEXT NOT NULL,
    password_salt    TEXT NOT NULL,
    kcal_per_day     REAL NOT NULL,        -- this person's daily calorie demand
    glucid_g_per_day REAL NOT NULL,      -- glucid demand, grams
    protein_g_per_day REAL NOT NULL,      -- protein demand, grams
    lipid_g_per_day  REAL NOT NULL,      -- lipid demand, grams
    is_admin         INTEGER NOT NULL DEFAULT 0,
    active           INTEGER NOT NULL DEFAULT 1,  -- soft delete, never hard-delete a user
    created_at       TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,          -- random hex from secrets.token_hex
    user_id     INTEGER NOT NULL REFERENCES users(id),
    expires_at  TEXT NOT NULL,
    created_at  TEXT
);

-- Static reference data. This is also the table your self-sufficiency
-- math JOINs against: kcal = kg * crops.kcal_per_kg
CREATE TABLE IF NOT EXISTS crops (
    id               INTEGER PRIMARY KEY,
    name             TEXT UNIQUE NOT NULL,
    kcal_per_kg      REAL NOT NULL,
    glucid_g_per_100g REAL NOT NULL,
    protein_g_per_100g REAL NOT NULL,
    lipid_g_per_100g REAL NOT NULL,
    effort_coefficient REAL NOT NULL,
    shelf_life_days  INTEGER NOT NULL      -- drives the "lifetime of calories"
);

CREATE TABLE IF NOT EXISTS asked_crops (
    id               INTEGER PRIMARY KEY,
    crop_id      INTEGER NOT NULL REFERENCES crops(id),
    rarity_coefficient REAL NOT NULL
);

-- Calorie ledger: one row per harvest contribution, attributed to one person.
-- Stock = rows with status 'available' and expires_at in the future.
CREATE TABLE IF NOT EXISTS harvests (
    id           INTEGER PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    crop_id      INTEGER NOT NULL REFERENCES crops(id),
    kg           REAL NOT NULL,
    harvested_at TEXT NOT NULL,            -- ISO date, set by the app
    expires_at   TEXT NOT NULL,            -- harvested_at + shelf_life_days
    status       TEXT NOT NULL DEFAULT 'available',  -- available / expired / consumed
    plan_id      INTEGER REFERENCES plans(id)         -- NULL = unplanned harvest
);

-- Future calorie entries: what we intend to grow and expect to harvest.
-- Fulfilled plans point back at harvests, so next season's forecast
-- uses your community's real yields.
CREATE TABLE IF NOT EXISTS plans (
    id                    INTEGER PRIMARY KEY,
    crop_id               INTEGER NOT NULL REFERENCES crops(id),
    area_m2               REAL NOT NULL,
    expected_kg           REAL NOT NULL,
    expected_harvest_date TEXT NOT NULL,
    created_by            INTEGER NOT NULL REFERENCES users(id),
    status                TEXT NOT NULL DEFAULT 'planned',  -- planned / planted / fulfilled / failed
    created_at            TEXT
);

-- Task scheduler: who is doing what, when. Visible to the whole community.
CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),   -- assigned to one person
    plan_id         INTEGER REFERENCES plans(id),           -- NULL = general task
    event_type      TEXT NOT NULL,                         -- plant / water / check / harvest / other
    scheduled_date  TEXT NOT NULL,
    note            TEXT,
    done            INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT
);

-- Locally reported diseases. Two-step: filed by anyone, confirmed by
-- someone else before it counts toward alerts. Disclosed controls
-- whether it is projected to the regional server.
CREATE TABLE IF NOT EXISTS outbreak_reports (
    id           INTEGER PRIMARY KEY,
    crop_id      INTEGER REFERENCES crops(id),   -- NULL = generalized report
    pathogen     TEXT NOT NULL,                  -- from a fixed demo list, not freeform
    lat          REAL,
    lon          REAL,
    reported_by  INTEGER NOT NULL REFERENCES users(id),
    reported_at  TEXT NOT NULL,
    confirmed_by INTEGER REFERENCES users(id),   -- NULL = not yet confirmed
    disclosed    INTEGER NOT NULL DEFAULT 1      -- 1 = share with region server
);
