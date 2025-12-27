const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AnimeRepository {
    constructor() {
        this.dbPath = path.join(__dirname, '../animebot.db');
        this.db = new sqlite3.Database(this.dbPath);
        this._initialize();
    }

    _initialize() {
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS favourites (
                    user_id TEXT,
                    anime_id INTEGER,
                    anime_title TEXT,
                    PRIMARY KEY(user_id, anime_id)
                )
            `);

            this.db.run(`
                CREATE TABLE IF NOT EXISTS notifications (
                    user_id TEXT,
                    anime_id INTEGER,
                    notify INTEGER DEFAULT 0,
                    PRIMARY KEY(user_id, anime_id)
                )
            `);
        });
    }

    getUserFavourites(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT anime_id, anime_title FROM favourites WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    isFavourited(userId, animeId) {
        return new Promise((resolve) => {
            this.db.get(
                `SELECT 1 FROM favourites WHERE user_id = ? AND anime_id = ?`,
                [userId, animeId],
                (err, row) => resolve(!!row)
            );
        });
    }

    isNotifyEnabled(userId, animeId) {
        return new Promise((resolve) => {
            this.db.get(
                `SELECT notify FROM notifications WHERE user_id = ? AND anime_id = ?`,
                [userId, animeId],
                (err, row) => resolve(row?.notify === 1)
            );
        });
    }

    addFavourite(userId, animeId, animeTitle) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR IGNORE INTO favourites (user_id, anime_id, anime_title) VALUES (?, ?, ?)`,
                [userId, animeId, animeTitle],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes > 0);
                }
            );
        });
    }

    removeFavourite(userId, animeId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(
                    `DELETE FROM favourites WHERE user_id = ? AND anime_id = ?`,
                    [userId, animeId]
                );
                this.db.run(
                    `DELETE FROM notifications WHERE user_id = ? AND anime_id = ?`,
                    [userId, animeId],
                    function(err) {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        });
    }

    enableNotify(userId, animeId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO notifications (user_id, anime_id, notify) VALUES (?, ?, 1)`,
                [userId, animeId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    disableNotify(userId, animeId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO notifications (user_id, anime_id, notify) VALUES (?, ?, 0)`,
                [userId, animeId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    getEnabledNotifications() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT user_id, anime_id FROM notifications WHERE notify = 1`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
}

module.exports = new AnimeRepository();
