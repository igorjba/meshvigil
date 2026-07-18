import { expect, test } from "@playwright/test";

test("health endpoint reports ok and self-tests the DLMS codec", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.service).toBe("meshvigil");
  expect(body.checks.dlmsCodec.ok).toBe(true);
});

test("snapshot endpoint degrades cleanly without Upstash configured", async ({ request }) => {
  const res = await request.get("/api/snapshot?id=1-0");
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Either persistence is disabled, or (if configured) it returns not-found handling.
  expect(body).toHaveProperty("configured");
});
