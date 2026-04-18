"""
========================================
JUST DO IT — backend/app.py
Smart Task Scheduling System
Backend : Python + Flask
Storage : Local JSON (localhost, no DB)

Install: pip install flask flask-cors
Run    : python app.py
========================================
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import json, os, itertools, time, hashlib

app = Flask(__name__)
CORS(app)

# ── File paths ────────────────────────────────────────────────
USERS_FILE  = "users_db.json"
TASKS_FILE  = "tasks_db.json"   # key = username

# ── Helpers ──────────────────────────────────────────────────
def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def load_users():   return load_json(USERS_FILE, {})
def save_users(u):  save_json(USERS_FILE, u)

def load_all_tasks(): return load_json(TASKS_FILE, {})
def save_all_tasks(d): save_json(TASKS_FILE, d)

def user_tasks(username):
    all_data = load_all_tasks()
    if username not in all_data:
        all_data[username] = {"tasks": _default_tasks(), "archive": _default_archive(), "categories": _default_cats()}
        save_all_tasks(all_data)
    return all_data[username]

def save_user_tasks(username, data):
    all_data = load_all_tasks()
    all_data[username] = data
    save_all_tasks(all_data)

def _default_tasks():
    return [
        {"id":"A101","summary":"Send welcome email",       "due":"2026-04-15","status":"Overdue",    "priority":"Low",   "category":"Personal","profit":10,"deadline":1},
        {"id":"A102","summary":"Send an invite to a friend","due":"2026-04-17","status":"In progress","priority":"Medium","category":"Academic","profit":20,"deadline":2},
        {"id":"B101","summary":"Share tutorial links",     "due":"2026-04-18","status":"In review",  "priority":"High",  "category":"Work",    "profit":30,"deadline":2},
        {"id":"C101","summary":"Take a selfie",            "due":"2026-04-19","status":"Done",       "priority":"Low",   "category":"Chores",  "profit":5, "deadline":3},
        {"id":"D101","summary":"Assignment CMSC 204",      "due":"2026-04-23","status":"To do",      "priority":"High",  "category":"Academic","profit":40,"deadline":4},
    ]

def _default_archive():
    return [
        {"id":"E101","summary":"Take a bath",   "due":"2026-04-30","status":"Done","priority":"Medium","category":"Personal"},
        {"id":"B102","summary":"Upload a photo","due":"2026-04-21","status":"Done","priority":"Low",   "category":"Work"},
    ]

def _default_cats():
    return ["Personal","Academic","Work","Chores"]


# ══════════════════════════════════════
#   AUTH ROUTES
# ══════════════════════════════════════

@app.route("/api/auth/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json()
    required = ["name","username","password"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"Missing field: {f}"}), 400

    users = load_users()
    if data["username"] in users:
        return jsonify({"error": "Username already taken"}), 409

    users[data["username"]] = {
        "name":     data["name"],
        "gender":   data.get("gender",""),
        "birthday": data.get("birthday",""),
        "username": data["username"],
        "password": hash_pw(data["password"]),
    }
    save_users(users)
    user_tasks(data["username"])   # initialize task store
    return jsonify({"message": "Account created", "username": data["username"]}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate a user."""
    data = request.get_json()
    users = load_users()
    user  = users.get(data.get("username",""))
    if not user or user["password"] != hash_pw(data.get("password","")):
        return jsonify({"error": "Invalid username or password"}), 401

    safe = {k:v for k,v in user.items() if k != "password"}
    return jsonify({"message": "Login successful", "user": safe})


@app.route("/api/auth/update", methods=["PUT"])
def update_profile():
    """Update user profile."""
    data     = request.get_json()
    username = data.get("username","")
    users    = load_users()
    if username not in users:
        return jsonify({"error": "User not found"}), 404

    user = users[username]
    user["name"]     = data.get("name", user["name"])
    user["gender"]   = data.get("gender", user.get("gender",""))
    user["birthday"] = data.get("birthday", user.get("birthday",""))
    if data.get("password"):
        user["password"] = hash_pw(data["password"])

    save_users(users)
    safe = {k:v for k,v in user.items() if k != "password"}
    return jsonify({"message": "Profile updated", "user": safe})


# ══════════════════════════════════════
#   TASK ROUTES
# ══════════════════════════════════════

def require_user():
    """Get username from header X-Username."""
    return request.headers.get("X-Username","")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    username = require_user()
    if not username:
        return jsonify({"error": "X-Username header required"}), 401
    data = user_tasks(username)
    return jsonify(data)


@app.route("/api/tasks", methods=["POST"])
def add_task():
    username = require_user()
    if not username: return jsonify({"error": "Unauthorized"}), 401
    body = request.get_json()
    for f in ["id","summary","due","priority"]:
        if not body.get(f):
            return jsonify({"error": f"Missing: {f}"}), 400

    data = user_tasks(username)
    if any(t["id"]==body["id"] for t in data["tasks"]):
        return jsonify({"error": "Task ID already exists"}), 409

    task = {
        "id":       body["id"],
        "summary":  body["summary"],
        "due":      body["due"],
        "status":   body.get("status","To do"),
        "priority": body["priority"],
        "category": body.get("category",""),
        "profit":   int(body.get("profit",10)),
        "deadline": int(body.get("deadline",1)),
    }
    data["tasks"].append(task)
    save_user_tasks(username, data)
    return jsonify({"message":"Task added","task":task}), 201


@app.route("/api/tasks/<task_id>", methods=["PUT"])
def update_task(task_id):
    username = require_user()
    if not username: return jsonify({"error": "Unauthorized"}), 401
    data = user_tasks(username)
    task = next((t for t in data["tasks"] if t["id"]==task_id), None)
    if not task: return jsonify({"error":"Task not found"}), 404

    body = request.get_json()
    for k in ["summary","due","status","priority","category","profit","deadline"]:
        if k in body: task[k] = body[k]

    save_user_tasks(username, data)
    return jsonify({"message":"Updated","task":task})


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    username = require_user()
    if not username: return jsonify({"error":"Unauthorized"}), 401
    data = user_tasks(username)
    before = len(data["tasks"])
    data["tasks"] = [t for t in data["tasks"] if t["id"]!=task_id]
    if len(data["tasks"])==before:
        return jsonify({"error":"Task not found"}), 404
    save_user_tasks(username, data)
    return jsonify({"message":"Deleted"})


@app.route("/api/tasks/<task_id>/archive", methods=["POST"])
def archive_task(task_id):
    username = require_user()
    if not username: return jsonify({"error":"Unauthorized"}), 401
    data = user_tasks(username)
    task = next((t for t in data["tasks"] if t["id"]==task_id), None)
    if not task: return jsonify({"error":"Task not found"}), 404
    data["tasks"].remove(task)
    data["archive"].append(task)
    save_user_tasks(username, data)
    return jsonify({"message":"Archived","task":task})


@app.route("/api/archive/<task_id>/restore", methods=["POST"])
def restore_task(task_id):
    username = require_user()
    if not username: return jsonify({"error":"Unauthorized"}), 401
    data = user_tasks(username)
    task = next((t for t in data["archive"] if t["id"]==task_id), None)
    if not task: return jsonify({"error":"Not found in archive"}), 404
    data["archive"].remove(task)
    data["tasks"].append(task)
    save_user_tasks(username, data)
    return jsonify({"message":"Restored","task":task})


# ══════════════════════════════════════
#   CATEGORIES
# ══════════════════════════════════════

@app.route("/api/categories", methods=["GET"])
def get_categories():
    username = require_user()
    if not username: return jsonify({"error":"Unauthorized"}), 401
    return jsonify({"categories": user_tasks(username).get("categories", _default_cats())})


@app.route("/api/categories", methods=["POST"])
def add_category():
    username = require_user()
    if not username: return jsonify({"error":"Unauthorized"}), 401
    name = (request.get_json() or {}).get("name","").strip()
    if not name: return jsonify({"error":"Category name required"}), 400
    data = user_tasks(username)
    cats = data.get("categories", _default_cats())
    if name not in cats:
        cats.append(name)
        data["categories"] = cats
        save_user_tasks(username, data)
    return jsonify({"message":"OK","categories":cats})


# ══════════════════════════════════════
#   SCHEDULING ALGORITHMS
# ══════════════════════════════════════

@app.route("/api/schedule/greedy", methods=["POST"])
def schedule_greedy():
    """Greedy job-sequencing with deadlines."""
    username  = require_user()
    task_list = (request.get_json() or {}).get("tasks") or user_tasks(username)["tasks"]

    t0      = time.perf_counter()
    sorted_ = sorted(task_list, key=lambda t: t["profit"], reverse=True)
    max_d   = max((t["deadline"] for t in task_list), default=0)
    slots   = [None]*(max_d+1)
    sched   = []

    for task in sorted_:
        for d in range(task["deadline"],0,-1):
            if slots[d] is None:
                slots[d]=task; sched.append(task); break

    return jsonify({
        "algorithm":    "Greedy",
        "scheduled":    sched,
        "total_profit": sum(t["profit"] for t in sched),
        "count":        len(sched),
        "time_ms":      round((time.perf_counter()-t0)*1000,4),
    })


@app.route("/api/schedule/brute-force", methods=["POST"])
def schedule_brute_force():
    """Brute-force: enumerate all feasible subsets."""
    username  = require_user()
    task_list = (request.get_json() or {}).get("tasks") or user_tasks(username)["tasks"]

    if len(task_list) > 20:
        return jsonify({"error":"Too many tasks for brute-force (max 20)"}), 400

    t0, best_profit, best_sub = time.perf_counter(), 0, []

    for r in range(len(task_list)+1):
        for sub in itertools.combinations(task_list, r):
            sub = list(sub)
            if _feasible(sub):
                p = sum(t["profit"] for t in sub)
                if p > best_profit:
                    best_profit, best_sub = p, sub

    return jsonify({
        "algorithm":    "Brute-Force",
        "scheduled":    best_sub,
        "total_profit": best_profit,
        "count":        len(best_sub),
        "time_ms":      round((time.perf_counter()-t0)*1000,4),
    })


@app.route("/api/schedule/compare", methods=["GET"])
def compare():
    """Side-by-side greedy vs brute-force."""
    username  = require_user()
    task_list = user_tasks(username)["tasks"]

    # Greedy
    t0 = time.perf_counter()
    sorted_ = sorted(task_list, key=lambda t: t["profit"], reverse=True)
    max_d = max((t["deadline"] for t in task_list), default=0)
    slots = [None]*(max_d+1); g_sched=[]
    for task in sorted_:
        for d in range(task["deadline"],0,-1):
            if slots[d] is None: slots[d]=task; g_sched.append(task); break
    g_time = round((time.perf_counter()-t0)*1000,4)

    # Brute-force
    t1=time.perf_counter(); b_sub=[]; b_profit=0
    for r in range(len(task_list)+1):
        for sub in itertools.combinations(task_list,r):
            sub=list(sub)
            if _feasible(sub):
                p=sum(t["profit"] for t in sub)
                if p>b_profit: b_profit,b_sub=p,sub
    b_time=round((time.perf_counter()-t1)*1000,4)

    g_profit=sum(t["profit"] for t in g_sched)
    return jsonify({
        "greedy":      {"ids":[t["id"] for t in g_sched],"total_profit":g_profit,"time_ms":g_time},
        "brute_force": {"ids":[t["id"] for t in b_sub],  "total_profit":b_profit,"time_ms":b_time},
        "optimal":     g_profit==b_profit,
    })


def _feasible(subset):
    if not subset: return True
    sorted_s = sorted(subset, key=lambda t: t["deadline"])
    max_d    = max(t["deadline"] for t in subset)
    slots    = [False]*(max_d+1)
    for t in sorted_s:
        placed=False
        for d in range(t["deadline"],0,-1):
            if not slots[d]: slots[d]=True; placed=True; break
        if not placed: return False
    return True


@app.route("/api/stats", methods=["GET"])
def stats():
    username  = require_user()
    task_list = user_tasks(username)["tasks"]
    return jsonify({
        "total":      len(task_list),
        "done":       sum(1 for t in task_list if t["status"]=="Done"),
        "inprogress": sum(1 for t in task_list if t["status"]=="In progress"),
        "inreview":   sum(1 for t in task_list if t["status"]=="In review"),
        "todo":       sum(1 for t in task_list if t["status"]=="To do"),
        "overdue":    sum(1 for t in task_list if t["status"]=="Overdue"),
    })


@app.route("/api/health")
def health(): return jsonify({"status":"ok","app":"Just Do It"})


if __name__=="__main__":
    print("="*44)
    print("  JUST DO IT — Backend  http://localhost:5000")
    print("="*44)
    app.run(debug=True, port=5000)
