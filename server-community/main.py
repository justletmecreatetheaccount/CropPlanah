from dbus.decorators import method
from datetime import datetime, timedelta
import hashlib
import os
import secrets
import sqlite3

from flask import Flask, jsonify, make_response, redirect, request, send_from_directory

DB_PATH = "server-community/database.db"

def hash_password(password, salt):
    return hashlib.scrypt(
        password=password.encode(),
        salt=salt,
        n=2**14, r=8, p=1,   # use IDENTICAL parameters at login
    ).hex()

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

@app.route('/')
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
    return send_from_directory("web/community/", "index.html")

@app.route('/region')
def region_page():
    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row  # rows accessible by column name

    rows = connection.execute("SELECT name FROM users").fetchall()
    names = [row["name"] for row in rows]

    connection.close()
    return names
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

app.run()

