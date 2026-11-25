import os, sqlite3
from datetime import date
from functools import wraps
from flask import Flask, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder="static", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "dev-change-me")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")
DB = os.environ.get("DB_PATH", "solotrip.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, pw TEXT, age INT, style TEXT, interests TEXT, budget INT, bio TEXT);
CREATE TABLE IF NOT EXISTS trips(id INTEGER PRIMARY KEY, user_id INT, dest TEXT, start_date TEXT, end_date TEXT, budget INT, interests TEXT, activities TEXT, seeking INT);
CREATE TABLE IF NOT EXISTS swipes(from_id INT, to_id INT, action TEXT, UNIQUE(from_id,to_id));
CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, a INT, b INT);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, match_id INT, sender INT, body TEXT, ts DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS blocks(blocker INT, blocked INT, UNIQUE(blocker,blocked));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, reporter INT, reported INT, reason TEXT);
CREATE TABLE IF NOT EXISTS groups(id INTEGER PRIMARY KEY, name TEXT, dest TEXT, start_date TEXT, end_date TEXT, owner INT);
CREATE TABLE IF NOT EXISTS group_members(group_id INT, user_id INT, UNIQUE(group_id,user_id));
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, user_id INT, msg TEXT, seen INT DEFAULT 0, ts DEFAULT CURRENT_TIMESTAMP);
"""

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(_):
    d = g.pop("db", None)
    if d: d.close()

def q(sql, args=(), one=False):
    rows = db().execute(sql, args).fetchall()
    db().commit()
    return (rows[0] if rows else None) if one else rows

def run(sql, args=()):
    cur = db().execute(sql, args)
    db().commit()
    return cur.lastrowid

def note(uid, msg):
    run("INSERT INTO notes(user_id,msg) VALUES(?,?)", (uid, msg))

def auth(f):
    @wraps(f)
    def w(*a, **k):
        if "uid" not in session:
            return jsonify(error="Login required"), 401
        return f(*a, **k)
    return w

def err(m, c=400):
    return jsonify(error=m), c

def valid_date(s):
    try: date.fromisoformat(s); return True
    except Exception: return False

def blocked_ids(me):
    ids = {r[0] for r in q("SELECT blocked FROM blocks WHERE blocker=?", (me,))}
    return ids | {r[0] for r in q("SELECT blocker FROM blocks WHERE blocked=?", (me,))}

def tags(s):
    return {x.strip().lower() for x in (s or "").split(",") if x.strip()}

# ---------- 1. Account ----------
@app.post("/api/register")
def register():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()[:60]
    email = (d.get("email") or "").strip().lower()
    pw = d.get("password") or ""
    if not name or "@" not in email or len(pw) < 8:
        return err("Enter your name, a valid email and a password of 8+ characters")
    if q("SELECT 1 FROM users WHERE email=?", (email,), True):
        return err("Email already registered", 409)
    session["uid"] = run("INSERT INTO users(name,email,pw) VALUES(?,?,?)", (name, email, generate_password_hash(pw)))
    return jsonify(ok=True)

@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    u = q("SELECT * FROM users WHERE email=?", ((d.get("email") or "").strip().lower(),), True)
    if not u or not check_password_hash(u["pw"], d.get("password") or ""):
        return err("Wrong email or password", 401)
    session["uid"] = u["id"]
    return jsonify(ok=True)

@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)

# ---------- 2. Profile ----------
@app.get("/api/me")
@auth
def me():
    u = dict(q("SELECT * FROM users WHERE id=?", (session["uid"],), True))
    u.pop("pw")
    return jsonify(u)

@app.put("/api/profile")
@auth
def profile():
    d = request.get_json(silent=True) or {}
    try:
        age = int(d["age"]) if d.get("age") else None
        budget = int(d["budget"]) if d.get("budget") else None
    except ValueError:
        return err("Age and budget must be numbers")
    q("UPDATE users SET name=?,age=?,style=?,interests=?,budget=?,bio=? WHERE id=?",
      ((d.get("name") or "").strip()[:60], age, (d.get("style") or "")[:40],
       (d.get("interests") or "")[:200], budget, (d.get("bio") or "")[:500], session["uid"]))
    return jsonify(ok=True)

# ---------- 3. Trips ----------
@app.post("/api/trips")
@auth
def add_trip():
    d = request.get_json(silent=True) or {}
    dest = (d.get("dest") or "").strip()[:80]
    s, e = d.get("start_date") or "", d.get("end_date") or ""
    if not dest or not valid_date(s) or not valid_date(e) or e < s:
        return err("Enter a destination and valid dates")
    try:
        budget = int(d["budget"]) if d.get("budget") else None
        seeking = int(d["seeking"]) if d.get("seeking") else 1
    except ValueError:
        return err("Budget and travelers must be numbers")
    run("INSERT INTO trips(user_id,dest,start_date,end_date,budget,interests,activities,seeking) VALUES(?,?,?,?,?,?,?,?)",
        (session["uid"], dest, s, e, budget, (d.get("interests") or "")[:200], (d.get("activities") or "")[:200], seeking))
    return jsonify(ok=True)

@app.get("/api/trips")
@auth
def my_trips():
    return jsonify([dict(r) for r in q("SELECT * FROM trips WHERE user_id=? ORDER BY start_date", (session["uid"],))])

# ---------- 4+11. Discovery, matching algorithm, filters ----------
def overlap_days(a1, a2, b1, b2):
    lo, hi = max(a1, b1), min(a2, b2)
    return (date.fromisoformat(hi) - date.fromisoformat(lo)).days + 1 if lo <= hi else 0

@app.get("/api/discover")
@auth
def discover():
    me, a = session["uid"], request.args
    def num(k):
        try: return int(a[k])
        except (KeyError, ValueError): return None
    bmax, amin, amax = num("budget_max"), num("age_min"), num("age_max")
    hidden = blocked_ids(me) | {me} | {r[0] for r in q("SELECT to_id FROM swipes WHERE from_id=?", (me,))}
    mine = q("SELECT * FROM trips WHERE user_id=?", (me,))
    best = {}
    rows = q("SELECT t.*, u.name, u.age, u.style FROM trips t JOIN users u ON u.id=t.user_id")
    for t in rows:
        if t["user_id"] in hidden: continue
        if a.get("dest") and a["dest"].lower() not in t["dest"].lower(): continue
        if bmax is not None and t["budget"] and t["budget"] > bmax: continue
        if amin is not None and (t["age"] or 0) < amin: continue
        if amax is not None and (t["age"] or 999) > amax: continue
        if a.get("style") and a["style"].lower() != (t["style"] or "").lower(): continue
        if a.get("interest") and a["interest"].lower() not in (t["interests"] or "").lower(): continue
        for m in mine:
            if m["dest"].lower() != t["dest"].lower(): continue
            days = overlap_days(m["start_date"], m["end_date"], t["start_date"], t["end_date"])
            if not days: continue
            score = 40 + min(days, 10) * 2                                   # destination + date overlap
            score += min(len(tags(m["interests"]) & tags(t["interests"])) * 6, 24)   # shared interests
            if m["budget"] and t["budget"]:
                score += round(10 * (1 - min(1, abs(m["budget"] - t["budget"]) / max(m["budget"], t["budget"]))))
            me_style = q("SELECT style FROM users WHERE id=?", (me,), True)["style"]
            if me_style and me_style == t["style"]: score += 6                 # travel style
            score = min(score, 100)
            if t["user_id"] not in best or score > best[t["user_id"]]["score"]:
                best[t["user_id"]] = dict(id=t["user_id"], name=t["name"].split()[0], age=t["age"], style=t["style"],
                    interests=t["interests"], dest=t["dest"], start_date=t["start_date"], end_date=t["end_date"],
                    budget=t["budget"], score=score)
    return jsonify(sorted(best.values(), key=lambda x: -x["score"]))

# ---------- 5+6. Like / Skip, mutual match ----------
@app.post("/api/swipe")
@auth
def swipe():
    d = request.get_json(silent=True) or {}
    me, to, act = session["uid"], d.get("to_id"), d.get("action")
    if act not in ("like", "skip") or not isinstance(to, int) or to == me:
        return err("Bad request")
    if to in blocked_ids(me):
        return err("Unavailable", 403)
    q("INSERT OR REPLACE INTO swipes VALUES(?,?,?)", (me, to, act))
    matched = False
    if act == "like":
        if q("SELECT 1 FROM swipes WHERE from_id=? AND to_id=? AND action='like'", (to, me), True):
            matched = True
            if not q("SELECT 1 FROM matches WHERE (a=? AND b=?) OR (a=? AND b=?)", (me, to, to, me), True):
                run("INSERT INTO matches(a,b) VALUES(?,?)", (me, to))
                note(me, "New match"); note(to, "New match")
        else:
            note(to, "Someone liked your trip")
    return jsonify(matched=matched)

# ---------- 7. Chat (matched users only) ----------
@app.get("/api/matches")
@auth
def matches():
    me = session["uid"]; bl = blocked_ids(me)
    rows = q("SELECT m.id, u.id AS uid, u.name FROM matches m JOIN users u ON u.id = CASE WHEN m.a=? THEN m.b ELSE m.a END WHERE m.a=? OR m.b=?", (me, me, me))
    return jsonify([dict(id=r["id"], uid=r["uid"], name=r["name"].split()[0]) for r in rows if r["uid"] not in bl])

def my_match(mid):
    me = session["uid"]
    m = q("SELECT * FROM matches WHERE id=? AND (a=? OR b=?)", (mid, me, me), True)
    if not m: return None
    other = m["b"] if m["a"] == me else m["a"]
    return None if other in blocked_ids(me) else other

@app.get("/api/messages/<int:mid>")
@auth
def get_messages(mid):
    if my_match(mid) is None: return err("Not found", 404)
    rows = q("SELECT sender, body, ts FROM messages WHERE match_id=? ORDER BY id", (mid,))
    return jsonify([dict(mine=r["sender"] == session["uid"], body=r["body"], ts=r["ts"]) for r in rows])

@app.post("/api/messages/<int:mid>")
@auth
def send_message(mid):
    other = my_match(mid)
    body = ((request.get_json(silent=True) or {}).get("body") or "").strip()[:1000]
    if other is None: return err("Not found", 404)
    if not body: return err("Empty message")
    run("INSERT INTO messages(match_id,sender,body) VALUES(?,?,?)", (mid, session["uid"], body))
    note(other, "New message")
    return jsonify(ok=True)

# ---------- 8. Safety ----------
@app.post("/api/block")
@auth
def block():
    uid = (request.get_json(silent=True) or {}).get("user_id")
    if not isinstance(uid, int) or uid == session["uid"]: return err("Bad request")
    q("INSERT OR IGNORE INTO blocks VALUES(?,?)", (session["uid"], uid))
    return jsonify(ok=True)

@app.post("/api/report")
@auth
def report():
    d = request.get_json(silent=True) or {}
    if not isinstance(d.get("user_id"), int): return err("Bad request")
    run("INSERT INTO reports(reporter,reported,reason) VALUES(?,?,?)", (session["uid"], d["user_id"], (d.get("reason") or "")[:500]))
    return jsonify(ok=True)

# ---------- 9. Groups ----------
@app.post("/api/groups")
@auth
def make_group():
    d = request.get_json(silent=True) or {}
    s, e = d.get("start_date") or "", d.get("end_date") or ""
    if not (d.get("name") or "").strip() or not (d.get("dest") or "").strip() or not valid_date(s) or not valid_date(e) or e < s:
        return err("Enter a group name, destination and valid dates")
    gid = run("INSERT INTO groups(name,dest,start_date,end_date,owner) VALUES(?,?,?,?,?)",
              (d["name"].strip()[:60], d["dest"].strip()[:80], s, e, session["uid"]))
    q("INSERT INTO group_members VALUES(?,?)", (gid, session["uid"]))
    return jsonify(ok=True)

@app.get("/api/groups")
@auth
def groups():
    me, out = session["uid"], []
    for gr in q("SELECT * FROM groups ORDER BY start_date"):
        mem = q("SELECT u.id, u.name FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=?", (gr["id"],))
        out.append(dict(dict(gr), members=[m["name"].split()[0] for m in mem], joined=any(m["id"] == me for m in mem), full=len(mem) >= 6))
    return jsonify(out)

@app.post("/api/groups/<int:gid>/join")
@auth
def join_group(gid):
    gr = q("SELECT * FROM groups WHERE id=?", (gid,), True)
    if not gr: return err("Not found", 404)
    if q("SELECT COUNT(*) c FROM group_members WHERE group_id=?", (gid,), True)["c"] >= 6: return err("Group is full")
    if gr["owner"] in blocked_ids(session["uid"]): return err("Unavailable", 403)
    q("INSERT OR IGNORE INTO group_members VALUES(?,?)", (gid, session["uid"]))
    note(gr["owner"], "Someone joined your trip group")
    return jsonify(ok=True)

# ---------- 10. Notifications ----------
@app.get("/api/notes")
@auth
def notes():
    return jsonify([dict(r) for r in q("SELECT msg, seen, ts FROM notes WHERE user_id=? ORDER BY id DESC LIMIT 50", (session["uid"],))])

@app.post("/api/notes/read")
@auth
def notes_read():
    q("UPDATE notes SET seen=1 WHERE user_id=?", (session["uid"],))
    return jsonify(ok=True)

@app.get("/")
def home():
    return app.send_static_file("index.html")

with app.app_context():
    db().executescript(SCHEMA)

if __name__ == "__main__":
    app.run(debug=True)
