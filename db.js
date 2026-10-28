require('dotenv').config();
const mysql = require('mysql2/promise');

// Initialize the MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'umanarayani',
  waitForConnections: true,
  connectionLimit: process.env.DB_CONNECTION_LIMIT ? Number(process.env.DB_CONNECTION_LIMIT) : 10,
  maxIdle: process.env.DB_MAX_IDLE ? Number(process.env.DB_MAX_IDLE) : 10,
  idleTimeout: 60000, // close idle connections after 60s
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/**
 * Helper to test the connection pool on startup
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(' Connected to MySQL database via connection pool.');
    connection.release();
    return true;
  } catch (error) {
    const detail = error.code ? `${error.code}${error.message ? `: ${error.message}` : ''}` : error.message || 'Connection error';
    console.warn(`⚠️  MySQL connection pool check failed (${detail})`);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.warn(`   Database '${process.env.DB_NAME || 'umanarayani'}' does not exist. Create it with: CREATE DATABASE ${process.env.DB_NAME || 'umanarayani'};`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.warn('   Access denied: Verify DB_USER and DB_PASSWORD in your .env file.');
    } else {
      console.warn('   Ensure MySQL is running and your credentials in .env are correct.');
    }
    return false;
  }
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params),
  testConnection,
};
