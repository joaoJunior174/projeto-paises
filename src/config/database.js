require('dotenv').config();
const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'paises',
};

/**
 * Adaptador PostgreSQL para o servidor local.
 */
class Database {
  constructor() {
    this.driver = 'pg';
    this.pg = new Pool(config);
    this.ready = Promise.resolve();
  }

  async query(sql, params = []) {
    let index = 0;
    const pgSql = sql.replace(/\?/g, () => {
      index += 1;
      return `$${index}`;
    });
    const result = await this.pg.query(pgSql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    let index = 0;
    const pgSql = sql.replace(/\?/g, () => {
      index += 1;
      return `$${index}`;
    });
    const result = await this.pg.query(pgSql, params);
    return { changes: result.rowCount || 0, rows: result.rows };
  }

  async exec(sql) {
    await this.pg.query(sql);
  }

  async transaction(fn) {
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');
      const trx = {
        query: async (sql, params = []) => {
          let index = 0;
          const pgSql = sql.replace(/\?/g, () => {
            index += 1;
            return `$${index}`;
          });
          const result = await client.query(pgSql, params);
          return result.rows;
        },
        run: async (sql, params = []) => {
          let index = 0;
          const pgSql = sql.replace(/\?/g, () => {
            index += 1;
            return `$${index}`;
          });
          const result = await client.query(pgSql, params);
          return { changes: result.rowCount || 0, rows: result.rows };
        },
      };
      const result = await fn(trx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  getConnectionInfo() {
    return `${config.user}@${config.host}:${config.port}/${config.database}`;
  }
}

const db = new Database();

module.exports = db;
