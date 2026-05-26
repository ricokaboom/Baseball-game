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
rooms = {}


def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
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
            conn = sqlite3.connect(DB_NAME)
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

        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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

    rooms[room_code] = {
        "player1_id": session["user_id"],
        "player1_name": session["username"],
        "player2_id": None,
        "player2_name": None
    }

    return redirect(url_for("game", room_code=room_code))


@app.route("/join_room", methods=["POST"])
def join_room_route():
    if "user_id" not in session:
        return redirect(url_for("login"))

    room_code = request.form["room_code"].upper()

    if room_code not in rooms:
        flash("Room not found.")
        return redirect(url_for("menu"))

    rooms[room_code]["player2_id"] = session["user_id"]
    rooms[room_code]["player2_name"] = session["username"]

    return redirect(url_for("game", room_code=room_code))


@app.route("/game/<room_code>")
def game(room_code):
    if "user_id" not in session:
        return redirect(url_for("login"))

    if room_code not in rooms:
        flash("Room not found.")
        return redirect(url_for("menu"))

    room = rooms[room_code]

    return render_template(
        "index.html",
        username=session["username"],
        room_code=room_code,
        room=room
    )


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@socketio.on("join_game_room")
def handle_join_game_room(data):
    room = data["room"]
    join_room(room)
    emit("player_joined", {"message": "Player joined room"}, room=room)


@socketio.on("pitch")
def handle_pitch(data):
    emit("receive_pitch", data, room=data["room"])


@socketio.on("swing")
def handle_swing(data):
    emit("receive_swing", data, room=data["room"])


@socketio.on("run_press")
def handle_run_press(data):
    emit("receive_run_press", room=data["room"])


if __name__ == "__main__":
    init_db()
    socketio.run(app, debug=True)