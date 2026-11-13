import { MigrationInterface, QueryRunner } from "typeorm";

export class NullableVenueRating1760000000003 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query("ALTER TABLE venues ALTER COLUMN rating SET DEFAULT NULL");
  }
  async down(q: QueryRunner) {
    await q.query("ALTER TABLE venues ALTER COLUMN rating SET DEFAULT 4.8");
  }
}
