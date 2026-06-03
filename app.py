from flask import Flask, render_template, request, redirect, session, url_for, flash
from flask_socketio import SocketIO, join_room, emit
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import random
import string

app = Flask(__name__)
app.secret_key = "change-this-secret-key"

socketio = SocketIO(app, cors_allowed_origins="*")

DB_NAME = "users.db"


def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            room_code TEXT PRIMARY KEY,
            player1_id INTEGER,
            player1_name TEXT,
            player2_id INTEGER,
            player2_name TEXT
        )
    """)

    conn.commit()
    conn.close()


@app.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("menu"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        email = request.form["email"]
        password = request.form["password"]

        password_hash = generate_password_hash(password)

        try:
            conn = get_db()
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (username, email, password_hash)
            )

            conn.commit()
            conn.close()

            flash("Account created. Please login.")
            return redirect(url_for("login"))

        except sqlite3.IntegrityError:
            flash("Username or email already exists.")

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("menu"))

        flash("Wrong username or password.")

    return render_template("login.html")


@app.route("/menu")
def menu():
    if "user_id" not in session:
        return redirect(url_for("login"))

    return render_template("menu.html", username=session["username"])


@app.route("/create_room")
def create_room():
    if "user_id" not in session:
        return redirect(url_for("login"))

    room_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO rooms (room_code, player1_id, player1_name, player2_id, player2_name)
        VALUES (?, ?, ?, ?, ?)
    """, (
        room_code,
        session["user_id"],
        session["username"],
        None,
        None
    ))

    conn.commit()
    conn.close()

    return redirect(url_for("game", room_code=room_code))


@app.route("/join_room", methods=["POST"])
def join_room_route():
    if "user_id" not in session:
        return redirect(url_for("login"))

    room_code = request.form["room_code"].upper()

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rooms WHERE room_code = ?", (room_code,))
    room = cursor.fetchone()

    if not room:
        conn.close()
        flash("Room not found.")
        return redirect(url_for("menu"))

    if room["player2_id"] is not None:
        conn.close()
        flash("Room is already full.")
        return redirect(url_for("menu"))

    cursor.execute("""
        UPDATE rooms
        SET player2_id = ?, player2_name = ?
        WHERE room_code = ?
    """, (
        session["user_id"],
        session["username"],
        room_code
    ))

    conn.commit()
    conn.close()

    return redirect(url_for("game", room_code=room_code))


@app.route("/game/<room_code>")
def game(room_code):
    if "user_id" not in session:
        return redirect(url_for("login"))

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rooms WHERE room_code = ?", (room_code,))
    room = cursor.fetchone()
    conn.close()

    if not room:
        flash("Room not found.")
        return redirect(url_for("menu"))

    game_ready = room["player1_id"] is not None and room["player2_id"] is not None

    return render_template(
        "index.html",
        username=session["username"],
        room_code=room_code,
        room=room,
        game_ready=game_ready
    )


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@socketio.on("join_game_room")
def handle_join_game_room(data):
    room_code = data["room"]

    join_room(room_code)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rooms WHERE room_code = ?", (room_code,))
    room = cursor.fetchone()
    conn.close()

    if room:
        game_ready = room["player1_id"] is not None and room["player2_id"] is not None

        emit("room_updated", {
            "player1_name": room["player1_name"],
            "player2_name": room["player2_name"],
            "game_ready": game_ready
        }, room=room_code)


@socketio.on("pitch")
def handle_pitch(data):
    room_code = data["room"]

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rooms WHERE room_code = ?", (room_code,))
    room = cursor.fetchone()
    conn.close()

    if not room:
        return

    if room["player1_id"] is None or room["player2_id"] is None:
        emit("waiting_for_player", {"message": "Wait for second player."})
        return

    emit("receive_pitch", data, room=room_code)


@socketio.on("swing")
def handle_swing(data):
    emit("receive_swing", data, room=data["room"])


@socketio.on("run_press")
def handle_run_press(data):
    emit("receive_run_press", room=data["room"])


@socketio.on("leave_game_room")
def handle_leave_game_room(data):
    room_code = data["room"]

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rooms WHERE room_code = ?", (room_code,))
    room = cursor.fetchone()

    if not room:
        conn.close()
        return

    emit("player_left_game", {}, room=room_code)

    cursor.execute("DELETE FROM rooms WHERE room_code = ?", (room_code,))

    conn.commit()
    conn.close()

@socketio.on("role_change")
def handle_role_change(data):
    emit("receive_role_change", data, room=data["room"], include_self=False)

if __name__ == "__main__":
    init_db()
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)