import { MigrationInterface, QueryRunner } from "typeorm";
export class UserAccounts1760000000002 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        phone VARCHAR(10) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await q.query(
      `CREATE TABLE auth_sessions (
        id CHAR(36) PRIMARY KEY,
        user_id INT NOT NULL,
        refresh_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX(user_id)
      )`,
    );
    await q.query(
      `ALTER TABLE bookings
        MODIFY access_hash CHAR(64) NULL,
        ADD user_id INT NULL,
        ADD CONSTRAINT booking_user FOREIGN KEY(user_id) REFERENCES users(id),
        ADD INDEX(user_id)`,
    );
  }
  async down(q: QueryRunner) {
    await q.query(
      "ALTER TABLE bookings DROP FOREIGN KEY booking_user, DROP COLUMN user_id",
    );
    await q.query("DROP TABLE auth_sessions");
    await q.query("DROP TABLE users");
  }
}
