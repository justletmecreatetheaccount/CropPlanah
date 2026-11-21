import hashlib
import os
import secrets
import sqlite3
from datetime import date, timedelta

PASSWORD = "demo1234"  # demo only

def hash_password(password, salt):
    return hashlib.scrypt(
        password=password.encode(),
        salt=salt,
        n=2**14, r=8, p=1,   # use IDENTICAL parameters at login
    ).hex()


DB_PATH = "../server-community/database.db"

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

connection = sqlite3.connect(DB_PATH)
with open("schema.sql") as f:
    connection.executescript(f.read())
connection.close()
print("Database ready")
connection = sqlite3.connect(DB_PATH)
connection.execute("PRAGMA foreign_keys = ON")
connection.row_factory = sqlite3.Row

with open("schema.sql") as f:
    connection.executescript(f.read())

# --- one user: marie, admin, demanding 2200 kcal/day ---
salt = secrets.token_bytes(16)
connection.execute(
    "INSERT INTO users (name, email, password_hash, password_salt, plot_size, "
    "kcal_per_day, glucid_g_per_day, protein_g_per_day, lipid_g_per_day, "
    "is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ("marie", "marie@wizard.mail", hash_password(PASSWORD, salt), salt.hex(), 10,
     2200, 250, 60, 70, 1, date.today().isoformat()),
)

# --- crops (verify my values against USDA FoodData Central) ---
crops = [
    # name, kcal/kg, glucid g/100g, protein, lipid, effort_coeff, shelf_life_days
    ("potato",     770, 17.5, 2.0, 0.1, 1.0, 150),
    ("tomato",     180,  3.9, 0.9, 0.2, 1.5,  10),
    ("carrot",     410, 10.0, 0.9, 0.2, 1.2,  30),
    ("dry beans", 3410, 63.0, 21.0, 1.5, 3.0, 300),
    ("apple",      520, 14.0, 0.3, 0.2, 1.5,  60),
    ("garlic",    1490, 33.0, 6.4, 0.5, 1.8, 180),
]
for c in crops:
    connection.execute(
        "INSERT INTO crops (name, kcal_per_kg, glucid_g_per_100g, "
        "protein_g_per_100g, lipid_g_per_100g, effort_coefficient, shelf_life_days) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)", c,
    )

# --- asked_crops: what we'd like in a trade (marketplace side) ---
asked = [
    ("potato", 0.3),   # we grow plenty, low rarity, barely worth asking
    ("garlic", 0.9),   # we want it badly, high desirability
]
for name, rarity in asked:
    crop = connection.execute(
        "SELECT id FROM crops WHERE name = ?", (name,)).fetchone()
    connection.execute(
        "INSERT INTO asked_crops (crop_id, rarity_coefficient) VALUES (?, ?)",
        (crop["id"], rarity),
    )

# --- ledger: one potato harvest, 12 kg, available, expires per shelf life ---
connection.execute(
    "INSERT INTO harvests (user_id, crop_id, kg, harvested_at, expires_at, status) "
    "VALUES (?, ?, ?, ?, ?, 'available')",
    (1, 1, 12.0, date.today().isoformat(),
     (date.today() + timedelta(days=150)).isoformat()),
)

# --- a plan: 4 m² of tomato, 15 kg expected in 60 days ---
tomato = connection.execute(
    "SELECT id FROM crops WHERE name = 'tomato'").fetchone()["id"]
connection.execute(
    "INSERT INTO plans (crop_id, area_m2, expected_kg, expected_harvest_date, "
    "created_by, status, created_at) VALUES (?, ?, ?, ?, ?, 'planned', ?)",
    (tomato, 4.0, 15.0, (date.today() + timedelta(days=60)).isoformat(),
     1, date.today().isoformat()),
)

# --- scheduler: water it in 3 days ---
connection.execute(
    "INSERT INTO events (user_id, plan_id, event_type, scheduled_date, note, done) "
    "VALUES (?, ?, 'water', ?, 'first watering', 0)",
    (1, 1, (date.today() + timedelta(days=3)).isoformat()),
)

connection.commit()
connection.close()
print("Database ready, login: marie / demo1234")

