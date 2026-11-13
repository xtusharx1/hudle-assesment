import test from "node:test";
import assert from "node:assert/strict";
import { money, bookingDate, dateLabel, validDate } from "../src/format.ts";
test("all rupee amounts retain their actual paise without rounding", () => {
  assert.equal(money(17250), "₹172.50");
  assert.equal(money(50125), "₹501.25");
  assert.equal(money(65000), "₹650");
  assert.equal(money(0), "₹0");
  assert.equal(money(1), "₹0.01");
});
test("booking links accept only real dates in the visible fourteen-day window", () => {
  for (const d of [
    "2026-99-99",
    "2026-02-30",
    "2026-11-13",
    "2026-11-28",
    "9999-01-01",
    "bad",
    null,
  ])
    assert.equal(bookingDate(d, "2026-11-14"), "2026-11-14");
  assert.equal(bookingDate("2026-11-27", "2026-11-14"), "2026-11-27");
});
test("date labels use venue IST even when host timezone differs", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.match(dateLabel("2026-11-14"), /14/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
  assert.equal(dateLabel("2026-99-99"), "Choose a valid date");
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
});
