from datetime import datetime, timedelta
import hashlib
import os
import secrets
import sqlite3
from datetime import date, timedelta
from flask import Flask, jsonify, make_response, redirect, request, send_from_directory

DB_PATH = "server-community/database.db"

def hash_password(password, salt):
    return hashlib.scrypt(
        password=password.encode(),
        salt=salt,
        n=2**14, r=8, p=1,   # use IDENTICAL parameters at login
    ).hex()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DB_PATH = os.path.join(BASE_DIR, "database.db")
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web", "community"))

# app = Flask("community-server", static_folder=WEB_DIR, static_url_path="")

def open_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row   # rows behave like dicts
    return connection

def current_user(connection):
    token = request.cookies.get("session")
    if not token:
        return None
    row = connection.execute(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id "
    "WHERE s.token = ? AND s.expires_at > ?",
    (token, datetime.now().isoformat()),
    ).fetchone()
    if row is None:
        return None
    # user is valid -> this request counts as activity, extend
    connection.execute("UPDATE sessions SET expires_at = ? WHERE token = ?",
                       ((datetime.now() + timedelta(hours=1)).isoformat(), token))
    return row

def get_user_by_email(connection, email):
    row = connection.execute(
        "SELECT * FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    return row

def create_session(connection, token, user_id, hours):
    expires_at = (datetime.now() + timedelta(hours=hours)).isoformat()
    connection.execute(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token, user_id, expires_at, datetime.now().isoformat()),
    )
    connection.commit()

PROFILES = {
    "late_blight": {  # potato late blight: thrives in wet, humid conditions
        "humidity_high": 85,      # % humidity
        "humidity_medium": 70,    # % humidity
        "wind_threshold": 15,     # km/h, wind spreads spores further
        "radius_base_km": 3,
        "radius_high_km": 10,
    },
    "stripe_rust": {  # wheat stripe rust: wind-dispersed spores, needs some humidity
        "humidity_high": 80,
        "humidity_medium": 60,
        "wind_threshold": 20,    # stronger wind = spores travel much further
        "radius_base_km": 5,
        "radius_high_km": 25,
    },
    "unknown": {  # generic fallback when the disease is not identified
        "humidity_high": 90,
        "humidity_medium": 75,
        "wind_threshold": 25,
        "radius_base_km": 2,
        "radius_high_km": 8,
    },
}


def prediction_model(wind, humidity, disease_name):
    name = disease_name.lower().strip().replace(" ", "_")
    if name not in PROFILES:
        name = "unknown"

    p = PROFILES[name]
    model_used = "rule-based-threshold-v1-" + name.replace("_", "-")

    if humidity >= p["humidity_high"] and wind >= p["wind_threshold"]:
        risk = "high"
        radius = p["radius_high_km"]
    elif humidity >= p["humidity_medium"] and wind > 0:
        risk = "medium"
        radius = p["radius_base_km"]
    elif humidity >= p["humidity_medium"] or wind >= p["wind_threshold"]:
        risk = "low"
        radius = p["radius_base_km"] / 2
    else:
        risk = "none"
        radius = 0

    return risk, radius, model_used

app = Flask("server-community", static_folder="web", static_url_path="/web")

@app.route("/api/login", methods=["POST"])
def login():
    connection = open_db()
    data = request.get_json()            # {"name": "marie", "password": "..."}
    user = get_user_by_email(connection, data["email"])
    if user is None or not secrets.compare_digest(
        hash_password(data["password"], bytes.fromhex(user["password_salt"])),
        user["password_hash"],
    ):
        return jsonify({"error": "invalid name or password"}), 401

    token = secrets.token_hex(32)
    create_session(connection, token, user["id"], 1)

    connection.close()

    response = make_response(jsonify({"ok": True}))
    response.set_cookie(
        "session", token,
        httponly=True,     # JavaScript can't read it -> XSS can't steal it
        samesite="Lax",    # not sent along on cross-site requests -> CSRF protection
        max_age=14 * 24 * 3600,
    )
    return response

@app.route("/api/logout", methods=["POST"])
def logout():
    connection = open_db()
    data = request.get_json()            # {"name": "marie", "password": "..."}
    user = get_user_by_email(connection, data["email"])
    if user is None or not secrets.compare_digest(
        hash_password(data["password"], bytes.fromhex(user["password_salt"])),
        user["password_hash"],
    ):
        return jsonify({"error": "invalid name or password"}), 401

    token = secrets.token_hex(32)
    create_session(connection, token, user["id"], 1)

    connection.close()

    response = make_response(jsonify({"ok": True}))
    response.set_cookie(
        "session", token,
        httponly=True,     # JavaScript can't read it -> XSS can't steal it
        samesite="Lax",    # not sent along on cross-site requests -> CSRF protection
        max_age=14 * 24 * 3600,
    )
    return response

@app.route("/api/signup", methods=["POST"])
def signin():
    connection = open_db()
    data = request.get_json()            # {"name": "marie", "password": "..."}
    password_salt = secrets.token_bytes(16)
    password_hash = hash_password(data["password"], password_salt)

    kcal = int(data["kcal_per_day"])
    glucid = round(kcal * 0.50 / 4)   # 4 kcal per g of carbs
    protein = round(kcal * 0.20 / 4)  # 4 kcal per g of protein
    lipid = round(kcal * 0.30 / 9)    # 9 kcal per g of fat
    connection.execute(
        "INSERT INTO users (name, email, password_hash, password_salt, kcal_per_day, glucid_g_per_day, protein_g_per_day, lipid_g_per_day, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            data["name"],
            data["email"],
            password_hash,
            password_salt.hex(),
            kcal,
            glucid,
            protein,
            lipid,
            datetime.now().isoformat(),
        ),
    )
    connection.commit()

    user = get_user_by_email(connection, data["email"])
    if user is None or not secrets.compare_digest(
        hash_password(data["password"], bytes.fromhex(user["password_salt"])),
        user["password_hash"],
    ):
        return jsonify({"error": "invalid name or password"}), 401

    token = secrets.token_hex(32)
    create_session(connection, token, user["id"], 1)

    connection.close()

    response = make_response(jsonify({"ok": True}))
    response.set_cookie(
        "session", token,
        httponly=True,     # JavaScript can't read it -> XSS can't steal it
        samesite="Lax",    # not sent along on cross-site requests -> CSRF protection
        max_age=14 * 24 * 3600,
    )
    return response

@app.route("/api/disease_reports", methods=["POST"])
def api_get_disease_reports():
    pass

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
    connection = open_db()
    user = current_user(connection)
    connection.close()
    if user :
        return redirect("/community")
    else:
        return redirect("/login")
    # connection = sqlite3.connect(DB_PATH)

    # connection.row_factory = sqlite3.Row  # rows accessible by column name

    # rows = connection.execute("SELECT session FROM users").fetchall()
    # names = [row["name"] for row in rows]

    # connection.close()
    # return names


@app.route('/login')
def login_page():
    return send_from_directory("web/login", "index.html")

@app.route('/community')
def community_page():
    connection = open_db()
    user = current_user(connection)
    connection.close()
    if user :
        return send_from_directory("web/community/", "index.html")
    else:
        return redirect("/login")
    # return send_from_directory(WEB_DIR, "index.html")


@app.route("/region")
def region_page():
    connection = open_db()
    user = current_user(connection)
    connection.close()
    if user :
        return send_from_directory("web/regional/", "index.html")
    else:
        return redirect("/login")
    
#
# OMEGA DEBUG
# 
SECRET_COLUMNS = {"password_hash", "password_salt", "token"}
@app.route("/db")
def db_dump():
    connection = open_db()
    table_names = [
        "users", "sessions", "crops", "asked_crops",
        "harvests", "plans", "events", "outbreak_reports",
    ]
    sections = []

    for table in table_names:
        try:
            rows = connection.execute(f"SELECT * FROM {table}").fetchall()
        except sqlite3.OperationalError:
            continue  # table not created yet
        if not rows:
            continue

        columns = rows[0].keys()
        html = [
            f"<h2>{table} ({len(rows)})</h2>",
            "<table border='1' cellpadding='4' cellspacing='0'>",
            "<tr>" + "".join(f"<th>{c}</th>" for c in columns) + "</tr>",
        ]
        for row in rows:
            html.append("<tr>")
            for column in columns:
                value = row[column]
                if column in SECRET_COLUMNS and value:
                    value = "***"
                elif value is None:
                    value = "NULL"
                html.append(f"<td>{value}</td>")
            html.append("</tr>")
        html.append("</table>")
        sections.append("\n".join(html))

    connection.close()

    body = "<h1>Database dump</h1>"
    if sections:
        body += "\n".join(sections)
    else:
        body += "<p>Every table is empty (or missing).</p>"
    return body

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
