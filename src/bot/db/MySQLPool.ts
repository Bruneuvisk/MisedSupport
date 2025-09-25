import mysql from 'mysql2/promise';

export class MySQLPool {
  static pool: mysql.Pool | null = null;

  static async connect() {
    if (this.pool) return;
    this.pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DB,
      waitForConnections: true,
      connectionLimit: 10
    });
    // Simple ping
    const conn = await this.pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[MySQL] pool conectado');
  }
}
