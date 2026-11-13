import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, readResponse } from "../src/http.ts";
test("a proxy HTML 502 produces a useful error instead of a JSON parse exception", async () => {
  await assert.rejects(
    () =>
      readResponse(new Response("<html>Bad gateway</html>", { status: 502 })),
    (e: any) =>
      e instanceof ApiError &&
      e.status === 502 &&
      e.message.includes("temporarily unavailable"),
  );
});
test("validation arrays and null error bodies are safe and readable", async () => {
  await assert.rejects(
    () =>
      readResponse(
        new Response(
          JSON.stringify({
            error: { message: ["Invalid email", "Invalid phone"] },
          }),
          { status: 400 },
        ),
      ),
    { message: "Invalid email. Invalid phone" },
  );
  await assert.rejects(
    () => readResponse(new Response("null", { status: 500 })),
    { message: "Something went wrong" },
  );
});
test("successful JSON stays intact", async () => {
  assert.deepEqual(await readResponse(new Response('{"status":"ok"}')), {
    status: "ok",
  });
});
