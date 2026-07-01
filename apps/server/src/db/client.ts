// Single shared Drizzle + pg client instance.
// Import `db` from here — never create a second pool.

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;

export const pool = new Pool({ connectionString });
export const db   = drizzle(pool, { schema });
