import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Loads .env for local development. In Cloud Run there is no .env file and the
// values arrive as real environment variables, which dotenv leaves alone.
dotenv.config();

const {
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_DIALECT,
} = process.env;

// Cloud SQL through the Auth Proxy is addressed by a Unix socket path
// (/cloudsql/project:region:instance); anything else is a normal host or IP.
// Choosing by shape lets the same image run locally over TCP and on Cloud Run
// over the socket. Passing an IP as socketPath fails with connect ENOENT.
const isSocketPath = Boolean(DB_HOST) && DB_HOST.startsWith('/');

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  dialect: DB_DIALECT || 'mysql',
  ...(isSocketPath
    ? { dialectOptions: { socketPath: DB_HOST } }
    : { host: DB_HOST, port: Number(DB_PORT) || 3306 }),
  logging: false,
  // Reusing connections keeps Cloud SQL from paying to set up a new one per
  // request, which is a meaningful part of the bill at this request volume.
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database Connected Successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
  }
}

testConnection();

export default sequelize;
