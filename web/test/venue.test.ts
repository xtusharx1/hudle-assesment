import test from "node:test";
import assert from "node:assert/strict";
import { venueAmenities } from "../src/lib/venue.ts";

test("missing or malformed amenities stay empty", () => {
  for (const value of [
    undefined,
    null,
    "null",
    "{}",
    {},
    "broken",
    '"Parking"',
  ]) {
    assert.deepEqual(venueAmenities(value), []);
  }
});
test("only supplied amenities are displayed", () => {
  assert.deepEqual(venueAmenities('["Water",null,1,"", "Parking"]'), [
    "Water",
    "Parking",
  ]);
  assert.deepEqual(venueAmenities(["Showers"]), ["Showers"]);
});
