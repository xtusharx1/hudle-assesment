import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultBookingDate } from "../src/booking-date.ts";
const date = "2026-11-13";
const slots = [
  { date, start_time: "06:00:00" },
  { date, start_time: "22:00:00" },
];
const at = (time: string) => Date.parse(`${date}T${time}+05:30`);
test("11:55 PM selects tomorrow after the last slot start", () => {
  assert.equal(defaultBookingDate(date, slots, at("23:55:00")), "2026-11-14");
});
test("keeps today while a later slot has not started", () => {
  assert.equal(defaultBookingDate(date, slots, at("21:59:59")), date);
});
test("advances at the last start, when that slot stops being bookable", () => {
  assert.equal(defaultBookingDate(date, slots, at("22:00:00")), "2026-11-14");
});
test("does not skip a future selected date or empty schedule", () => {
  assert.equal(
    defaultBookingDate("2026-11-14", [], at("23:55:00")),
    "2026-11-14",
  );
  assert.equal(defaultBookingDate(date, [], at("23:55:00")), date);
});
test("uses IST regardless of host timezone and handles month/year changes", () => {
  assert.equal(
    defaultBookingDate(
      "2026-12-31",
      [{ date: "2026-12-31", start_time: "22:00:00" }],
      Date.parse("2026-12-31T18:25:00Z"),
    ),
    "2027-01-01",
  );
});
test("rolls an untouched date forward after midnight", () => {
  assert.equal(
    defaultBookingDate(date, slots, Date.parse("2026-11-14T00:01:00+05:30")),
    "2026-11-14",
  );
});
