import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env"), quiet: true });
import { DataSource } from "typeorm";
import { InitialSchema1760000000000 } from "./schema";
import { SeedBatches1760000000001 } from "./seed-batches";
export const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3308),
  username: process.env.DB_USER || "hudle",
  password: process.env.DB_PASSWORD || "hudle_local",
  database: process.env.DB_NAME || "hudle",
  timezone: "Z",
  dateStrings: true,
  migrations: [InitialSchema1760000000000, SeedBatches1760000000001],
  migrationsRun: true,
  synchronize: false,
  extra: { connectionLimit: 15 },
});
