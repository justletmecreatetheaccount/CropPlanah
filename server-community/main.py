import hashlib
import os
import secrets
import sqlite3

from flask import Flask, jsonify, make_response, request, send_from_directory

DB_PATH = "../server-community/database.db"

app = Flask("community-server", static_folder="web", static_url_path="/web")


# @app.route("/api/login", methods=["POST"])
# def login():
#     data = request.get_json()            # {"name": "marie", "password": "..."}
#     user = get_user_by_name(connection, data["name"])
#     if user is None or not secrets.compare_digest(
#         hash_password(data["password"], bytes.fromhex(user["password_salt"])),
#         user["password_hash"],
#     ):
#         return jsonify({"error": "invalid name or password"}), 401

#     token = secrets.token_hex(32)
#     create_session(connection, token, user["id"], days=14)

#     response = make_response(jsonify({"ok": True}))
#     response.set_cookie(
#         "session", token,
#         httponly=True,     # JavaScript can't read it -> XSS can't steal it
#         samesite="Lax",    # not sent along on cross-site requests -> CSRF protection
#         max_age=14 * 24 * 3600,
#     )
#     return response

# @app.route("/api/harvests", methods=["GET"])
# def list_harvests():
#     token = request.cookies.get("session")     # None if not logged in
#     if not token:
#         return jsonify({"error": "not logged in"}), 401
#     session_row = get_session(connection, token)   # SELECT ... WHERE token = ?
#     if session_row is None or session_row["expires_at"] < now_iso():
#         return jsonify({"error": "not logged in"}), 401
#     user_id = session_row["user_id"]
#     # ...now build the actual response, knowing who is asking@app.route('/')

def main_page():
    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row  # rows accessible by column name

    rows = connection.execute("SELECT name FROM users").fetchall()
    names = [row["name"] for row in rows]

    connection.close()
    return names


@app.route('/login')
def login_page():
    return send_from_directory("web/login", "index.html")

@app.route('/region')
def region_page():
    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row  # rows accessible by column name

    rows = connection.execute("SELECT name FROM users").fetchall()
    names = [row["name"] for row in rows]

    connection.close()
    return names

app.run()


def hash_password(password, salt):
    return hashlib.scrypt(
        password=password.encode(),
        salt=salt,
        n=2**14, r=8, p=1,   # use IDENTICAL parameters at login
    ).hex()
