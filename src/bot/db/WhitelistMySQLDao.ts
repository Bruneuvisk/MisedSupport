import { MySQLPool } from './MySQLPool.js';

export type WLStatus = 'approved' | 'denied' | 'pending';

export class WhitelistMySQLDao {
  static async initDDL() {
    const ddl = `
CREATE TABLE IF NOT EXISTS whitelist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discord_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  age INT NOT NULL,
  game_id VARCHAR(64) NOT NULL,
  status ENUM('approved','denied','pending') NOT NULL DEFAULT 'pending',
  approved_by BIGINT NULL,
  approved_at INT NULL,
  created_at INT NOT NULL,
  updated_at INT NOT NULL,
  UNIQUE KEY uniq_discord (discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
    if (!MySQLPool.pool) await MySQLPool.connect();
    const pool = MySQLPool.pool!;
    await pool.query(ddl);
  }

  static async upsertPending(discordId: string, name: string, age: number, gameId: string) {
    if (!MySQLPool.pool) await MySQLPool.connect();
    const pool = MySQLPool.pool!;
    const now = Math.floor(Date.now() / 1000);
    await pool.query(
      `INSERT INTO whitelist (discord_id,name,age,game_id,status,created_at,updated_at)
       VALUES (?,?,?,?, 'pending', ?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), age=VALUES(age), game_id=VALUES(game_id), updated_at=VALUES(updated_at)`,
      [discordId, name, age, gameId, now, now]
    );
  }

  static async setStatus(discordId: string, status: WLStatus, approvedBy?: string) {
    if (!MySQLPool.pool) await MySQLPool.connect();
    const pool = MySQLPool.pool!;
    const now = Math.floor(Date.now() / 1000);
    if (status === 'approved' || status === 'denied') {
      await pool.query(
        `UPDATE whitelist SET status=?, approved_by=?, approved_at=?, updated_at=? WHERE discord_id=?`,
        [status, approvedBy ?? null, now, now, discordId]
      );
    } else {
      await pool.query(`UPDATE whitelist SET status=?, updated_at=? WHERE discord_id=?`, [status, now, discordId]);
    }
  }
}
