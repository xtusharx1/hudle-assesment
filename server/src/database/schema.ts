import { MigrationInterface, QueryRunner } from "typeorm";
export class InitialSchema1760000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE venues (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(150) NOT NULL,
        sport VARCHAR(40) NOT NULL,
        location VARCHAR(100) NOT NULL,
        address VARCHAR(300) NOT NULL,
        description TEXT,
        image_url VARCHAR(1000),
        price_per_hour INT NOT NULL,
        rating DECIMAL(2,1) DEFAULT 4.8,
        amenities JSON,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK(price_per_hour >= 0)
      )`,
    );
    await q.query(
      `CREATE TABLE slots (
        id INT PRIMARY KEY AUTO_INCREMENT,
        venue_id INT NOT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        price INT NOT NULL,
        is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE RESTRICT,
        UNIQUE KEY unique_slot(venue_id,date,start_time),
        INDEX venue_date(venue_id,date),
        CHECK(end_time > start_time),
        CHECK(price >= 0)
      )`,
    );
    await q.query(
      `CREATE TABLE bookings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        reference VARCHAR(20) NOT NULL UNIQUE,
        access_hash CHAR(64) NOT NULL,
        slot_id INT NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(10) NOT NULL,
        customer_email VARCHAR(254),
        status ENUM('CONFIRMED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
        amount INT NOT NULL,
        active_slot_id INT GENERATED ALWAYS AS (IF(status='CONFIRMED',slot_id,NULL)) STORED,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cancelled_at DATETIME NULL,
        FOREIGN KEY(slot_id) REFERENCES slots(id) ON DELETE RESTRICT,
        UNIQUE KEY one_active_booking_per_slot(active_slot_id),
        CHECK(amount >= 0)
      )`,
    );
  }
  async down(q: QueryRunner) {
    await q.query("DROP TABLE bookings");
    await q.query("DROP TABLE slots");
    await q.query("DROP TABLE venues");
  }
}
