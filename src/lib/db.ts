import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // set in .env.local
});

export default pool;