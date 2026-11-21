"""
Regional server: (re)create the hub database from scratch.
Destroys any existing data. Demo/dev use.
"""
import os
import sqlite3
from datetime import datetime, timedelta

DB_PATH = "../server-regional/database.db"
SCHEMA_PATH = "schema.sql"

# --- start from a clean slate ---
try:
    os.remove(DB_PATH)  # fails if a stale -wal/-shm exists, see comment below
except FileNotFoundError:
    pass

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

connection = sqlite3.connect(DB_PATH)  # creates the file
connection.execute("PRAGMA foreign_keys = ON")
connection.row_factory = sqlite3.Row

with open(SCHEMA_PATH) as f:
    connection.executescript(f.read())

connection.commit()
print("Regional database ready at", DB_PATH)

now = datetime.now().isoformat(timespec="seconds")
days_ago = lambda n: (datetime.now() - timedelta(days=n)).isoformat(timespec="seconds")
days_ahead = lambda n: (datetime.now() + timedelta(days=n)).isoformat(timespec="seconds")

# --- two communities, as if they had already announced themselves ---
communities = [
    # (uuid, name, lat, lon, last_seen)
    ("11111111-1111-1111-1111-111111111111", "Villeneuve", 50.712, 4.321, days_ago(0)),
    ("22222222-2222-2222-2222-222222222222", "Ferme du Bois", 50.698, 4.415, days_ago(2)),
]
connection.executemany(
    "INSERT INTO communities (id, name, lat, lon, last_seen) VALUES (?, ?, ?, ?, ?)",
    communities,
)

# --- some pushed outbreak reports ---
outbreaks = [
    # (community, crop, pathogen, lat, lon, reported_at, ingested_at)
    ("11111111-1111-1111-1111-111111111111", "potato", "late_blight", 50.710, 4.318, days_ago(3)),
    ("22222222-2222-2222-2222-222222222222", "tomato", "powdery_mildew", 50.702, 4.412, days_ago(1)),
]
connection.executemany(
    "INSERT INTO outbreak_reports (community_id, crop, pathogen, "
    "lat, lon, reported_at) VALUES (?, ?, ?, ?, ?, ?)",
    outbreaks,
)

# --- some marketplace listings ---
listings = [
    # (community, crop, kg, kcal_per_kg, expires_at, listed_at)
    ("11111111-1111-1111-1111-111111111111", "apple", 30.0, 520, days_ahead(40), days_ago(1)),
    ("22222222-2222-2222-2222-222222222222", "dry beans", 8.0, 3410, days_ahead(200), days_ago(2)),
]
connection.executemany(
    "INSERT INTO market_listings (community_id, crop, kg, kcal_per_kg, "
    "expires_at, listed_at) VALUES (?, ?, ?, ?, ?, ?)",
    [(c[0], c[1], c[2], c[3], c[4], c[5]) for c in listings],
)

connection.commit()

connection.close()
