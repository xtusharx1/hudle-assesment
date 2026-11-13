import { MigrationInterface, QueryRunner } from "typeorm";
export class SeedBatches1760000000001 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      "CREATE TABLE seed_batches (batch_key VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
  }
  async down(q: QueryRunner) {
    await q.query("DROP TABLE seed_batches");
  }
}
