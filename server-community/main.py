import sqlite3

from flask import Flask

DB_PATH = "../server-community/database.db"

app = Flask("community-server")


@app.route('/')
def main_page():
    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row  # rows accessible by column name

    rows = connection.execute("SELECT name FROM users").fetchall()
    names = [row["name"] for row in rows]

    connection.close()
    return names

@app.route('/region')
def region_page():
    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row  # rows accessible by column name

    rows = connection.execute("SELECT name FROM users").fetchall()
    names = [row["name"] for row in rows]

    connection.close()
    return names

app.run()
