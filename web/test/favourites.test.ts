import test from "node:test";
import assert from "node:assert/strict";
import { favouriteIds } from "../src/favourites.ts";

test("corrupt or non-array favourites storage is safe", () => {
  for (const value of [null, "broken", "null", "{}", '"123"', "7", "true"])
    assert.deepEqual(favouriteIds(value), []);
});
test("favourites contain unique, positive safe integer venue IDs only", () => {
  assert.deepEqual(
    favouriteIds('[1,2,1,"2",null,{},0,-1,1.5,9007199254740992]'),
    [1, 2],
  );
});
