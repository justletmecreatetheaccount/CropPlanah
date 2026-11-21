import hashlib
import os
import secrets
import sqlite3
from datetime import date, timedelta
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web", "community"))

app = Flask("community-server", static_folder=WEB_DIR, static_url_path="")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def hash_demo_password(password, salt):
    return hashlib.scrypt(
        password=password.encode(),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
    ).hex()


def infer_main_nutrient(crop_row):
    if crop_row["lipid_g_per_100g"] >= 15:
        return "Fats"
    if crop_row["protein_g_per_100g"] >= 12:
        return "Protein"
    if crop_row["kcal_per_kg"] < 500:
        return "Vitamins"
    return "Carbs"


def get_or_create_user(conn, name):
    clean_name = name.strip()
    row = conn.execute(
        "SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND active = 1",
        (clean_name,),
    ).fetchone()
    if row:
        return row["id"]

    # Auto-create a standard community member for demo convenience
    salt = secrets.token_bytes(16)
    cur = conn.execute(
        """
        INSERT INTO users (
            name, password_hash, password_salt,
            kcal_per_day, glucid_g_per_day, protein_g_per_day, lipid_g_per_day,
            is_admin, active, created_at
        ) VALUES (?, ?, ?, 2200, 250, 60, 70, 0, 1, ?)
        """,
        (clean_name, hash_demo_password("demo1234", salt), salt.hex(), date.today().isoformat()),
    )
    return cur.lastrowid


def get_or_create_crop(conn, crop_name, kg=1.0, calories=0, protein=0, fats=0, carbs=0):
    clean_name = crop_name.strip().lower()
    row = conn.execute(
        "SELECT * FROM crops WHERE LOWER(name) = ?",
        (clean_name,),
    ).fetchone()
    if row:
        return row

    safe_kg = kg if kg and kg > 0 else 1.0
    kcal_per_kg = round(calories / safe_kg, 1) if calories else 500.0
    carbs_100g = round(carbs / (safe_kg * 10), 2) if carbs else 10.0
    protein_100g = round(protein / (safe_kg * 10), 2) if protein else 2.0
    fats_100g = round(fats / (safe_kg * 10), 2) if fats else 0.5

    cur = conn.execute(
        """
        INSERT INTO crops (
            name, kcal_per_kg, glucid_g_per_100g,
            protein_g_per_100g, lipid_g_per_100g,
            effort_coefficient, shelf_life_days
        ) VALUES (?, ?, ?, ?, ?, 1.5, 30)
        """,
        (clean_name, kcal_per_kg, carbs_100g, protein_100g, fats_100g),
    )
    return conn.execute("SELECT * FROM crops WHERE id = ?", (cur.lastrowid,)).fetchone()


def parse_month(iso_date_str, fallback=1):
    try:
        return int(iso_date_str.split("-")[1])
    except Exception:
        return fallback


# =========================================
# PAGES
# =========================================
@app.route("/")
def main_page():
    return send_from_directory(WEB_DIR, "index.html")


@app.route("/region")
def region_page():
    conn = get_db()
    rows = conn.execute("SELECT name FROM users WHERE active = 1").fetchall()
    conn.close()
    return jsonify([row["name"] for row in rows])


# =========================================
# API: USERS (COMMUNITY NEEDS)
# =========================================
@app.route("/api/users", methods=["GET"])
def api_get_users():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT id, name, kcal_per_day, protein_g_per_day, lipid_g_per_day, glucid_g_per_day
        FROM users
        WHERE active = 1
        ORDER BY id ASC
        """
    ).fetchall()
    conn.close()

    return jsonify([
        {
            "id": r["id"],
            "name": r["name"],
            "requiredCalories": r["kcal_per_day"],
            "requiredProtein": r["protein_g_per_day"],
            "requiredFats": r["lipid_g_per_day"],
            "requiredCarbs": r["glucid_g_per_day"],
        }
        for r in rows
    ])


# =========================================
# API: CROPS (REFERENCE NUTRITION TABLE)
# =========================================
@app.route("/api/crops", methods=["GET"])
def api_get_crops():
    conn = get_db()
    rows = conn.execute("SELECT * FROM crops ORDER BY name ASC").fetchall()
    conn.close()

    return jsonify([
        {
            "id": r["id"],
            "name": r["name"],
            "category": infer_main_nutrient(r),
            "kcalPerKg": r["kcal_per_kg"],
            "proteinPerKg": round(r["protein_g_per_100g"] * 10, 1),
            "fatsPerKg": round(r["lipid_g_per_100g"] * 10, 1),
            "carbsPerKg": round(r["glucid_g_per_100g"] * 10, 1),
            "shelfLifeDays": r["shelf_life_days"],
        }
        for r in rows
    ])


# =========================================
# API: HARVESTS (SHARED STOCKS)
# =========================================
@app.route("/api/harvests", methods=["GET"])
def api_get_harvests():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT
            h.id, h.kg, h.harvested_at, h.expires_at, h.status, h.plan_id,
            u.name AS author,
            c.name AS crop_name,
            c.kcal_per_kg, c.protein_g_per_100g, c.lipid_g_per_100g, c.glucid_g_per_100g,
            c.shelf_life_days
        FROM harvests h
        JOIN users u ON u.id = h.user_id
        JOIN crops c ON c.id = h.crop_id
        WHERE h.status = 'available' AND h.expires_at >= date('now')
        ORDER BY h.id DESC
        """
    ).fetchall()
    conn.close()

    today = date.today()
    items = []
    for r in rows:
        kg = r["kg"]
        try:
            days_left = (date.fromisoformat(r["expires_at"]) - today).days
            expiry_label = f"{max(0, days_left)}d left"
        except Exception:
            expiry_label = r["expires_at"]

        items.append({
            "id": r["id"],
            "title": f"{kg:g} kg of {r['crop_name'].capitalize()}",
            "crop": r["crop_name"],
            "category": infer_main_nutrient(r),
            "author": r["author"],
            "distance": expiry_label,
            "kg": kg,
            "harvestedAt": r["harvested_at"],
            "expiresAt": r["expires_at"],
            "calories": round(kg * r["kcal_per_kg"]),
            "protein": round(kg * 10 * r["protein_g_per_100g"]),
            "fats": round(kg * 10 * r["lipid_g_per_100g"]),
            "carbs": round(kg * 10 * r["glucid_g_per_100g"]),
            "calendarId": r["plan_id"],
        })

    return jsonify(items)


@app.route("/api/harvests", methods=["POST"])
def api_create_harvest():
    data = request.get_json(force=True)

    author = (data.get("author") or "").strip()
    crop_name = (data.get("crop") or "").strip()
    kg = float(data.get("kg") or 0)

    if not author or not crop_name or kg <= 0:
        return jsonify({"error": "Missing required fields (author, crop, kg)."}), 400

    plan_id = data.get("calendarId")
    if plan_id in ("", None):
        plan_id = None
    else:
        plan_id = int(plan_id)

    conn = get_db()
    try:
        user_id = get_or_create_user(conn, author)
        crop = get_or_create_crop(
            conn,
            crop_name,
            kg=kg,
            calories=float(data.get("calories") or 0),
            protein=float(data.get("protein") or 0),
            fats=float(data.get("fats") or 0),
            carbs=float(data.get("carbs") or 0),
        )

        today = date.today()
        harvested_at = today.isoformat()
        expires_at = (today + timedelta(days=crop["shelf_life_days"])).isoformat()

        cur = conn.execute(
            """
            INSERT INTO harvests (user_id, crop_id, kg, harvested_at, expires_at, status, plan_id)
            VALUES (?, ?, ?, ?, ?, 'available', ?)
            """,
            (user_id, crop["id"], kg, harvested_at, expires_at, plan_id),
        )

        if plan_id is not None:
            conn.execute(
                "UPDATE plans SET status = 'fulfilled' WHERE id = ?",
                (plan_id,),
            )

        conn.commit()
        new_id = cur.lastrowid
    finally:
        conn.close()

    return jsonify({"id": new_id, "status": "created"}), 201


# =========================================
# API: PLANS (ALMANAC)
# =========================================
@app.route("/api/plans", methods=["GET"])
def api_get_plans():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT
            p.id, p.area_m2, p.expected_kg, p.expected_harvest_date, p.status, p.created_at,
            u.name AS member,
            c.name AS crop_name,
            c.kcal_per_kg, c.protein_g_per_100g, c.lipid_g_per_100g, c.glucid_g_per_100g,
            COALESCE(
                (SELECT e.scheduled_date FROM events e
                 WHERE e.plan_id = p.id AND e.event_type = 'plant'
                 ORDER BY e.id ASC LIMIT 1),
                p.created_at
            ) AS sow_date,
            (SELECT SUM(h.kg) FROM harvests h WHERE h.plan_id = p.id) AS harvested_kg
        FROM plans p
        JOIN users u ON u.id = p.created_by
        JOIN crops c ON c.id = p.crop_id
        WHERE p.status != 'failed'
        ORDER BY p.id DESC
        """
    ).fetchall()
    conn.close()

    today_month = date.today().month
    return jsonify([
        {
            "id": r["id"],
            "member": r["member"],
            "crop": r["crop_name"].capitalize(),
            "rawCrop": r["crop_name"],
            "nutrient": infer_main_nutrient(r),
            "areaM2": r["area_m2"],
            "estimatedKg": r["expected_kg"],
            "sowMonth": parse_month(r["sow_date"], fallback=today_month),
            "harvestMonth": parse_month(r["expected_harvest_date"], fallback=today_month),
            "harvested": r["status"] == "fulfilled",
            "harvestedKg": r["harvested_kg"],
        }
        for r in rows
    ])


@app.route("/api/plans", methods=["POST"])
def api_create_plan():
    data = request.get_json(force=True)

    member = (data.get("member") or "").strip()
    crop_name = (data.get("crop") or "").strip()
    expected_kg = float(data.get("estimatedKg") or 0)
    sow_month = int(data.get("sowMonth") or date.today().month)
    harvest_month = int(data.get("harvestMonth") or sow_month)

    if not member or not crop_name or expected_kg <= 0:
        return jsonify({"error": "Missing required fields (member, crop, estimatedKg)."}), 400

    year = date.today().year
    sow_date = date(year, sow_month, 1).isoformat()
    harvest_year = year + 1 if harvest_month < sow_month else year
    harvest_date = date(harvest_year, harvest_month, 15).isoformat()
    area_m2 = float(data.get("areaM2") or max(1.0, round(expected_kg / 3.0, 1)))

    conn = get_db()
    try:
        user_id = get_or_create_user(conn, member)
        crop = get_or_create_crop(conn, crop_name)

        cur = conn.execute(
            """
            INSERT INTO plans (
                crop_id, area_m2, expected_kg, expected_harvest_date,
                created_by, status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'planned', ?)
            """,
            (crop["id"], area_m2, expected_kg, harvest_date, user_id, sow_date),
        )
        plan_id = cur.lastrowid

        # Record the planting date in events to stay aligned with the scheduler
        conn.execute(
            """
            INSERT INTO events (user_id, plan_id, event_type, scheduled_date, note, done, created_at)
            VALUES (?, ?, 'plant', ?, ?, 0, ?)
            """,
            (user_id, plan_id, sow_date, f"Sow {crop['name']}", date.today().isoformat()),
        )

        conn.commit()
    finally:
        conn.close()

    return jsonify({"id": plan_id, "status": "created"}), 201


if __name__ == "__main__":
    app.run(debug=True, port=5000)