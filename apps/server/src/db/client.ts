// Single shared Drizzle + postgres.js client instance.
// Import `db` from here — never create a second pool.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// postgres.js manages the connection pool internally
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });
