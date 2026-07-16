const session = require("express-session");

// A small SQLite-backed store keeps admin sessions across process restarts and
// avoids express-session's production-unsafe in-memory default.  It shares the
// application's existing SQLite database, so there is no extra service to run.
class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.getSession = db.prepare(
      "SELECT sess FROM sessions WHERE sid = ? AND expires_at > ?"
    );
    this.setSession = db.prepare(`
      INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at
    `);
    this.deleteSession = db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.clearExpired = db.prepare("DELETE FROM sessions WHERE expires_at <= ?");
  }

  get(sid, callback) {
    try {
      const row = this.getSession.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const expiresAt = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 12 * 60 * 60 * 1000;
      this.setSession.run(sid, JSON.stringify(sess), expiresAt);
      this.clearExpired.run(Date.now());
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.deleteSession.run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }
}

module.exports = SqliteSessionStore;
