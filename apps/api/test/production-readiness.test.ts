import assert from "node:assert/strict";
import { after, test } from "node:test";

import request from "supertest";

import { app } from "../src/app.js";
import { database } from "../src/database.js";

after(async () => { await database.$disconnect(); });

test("health y readiness exponen estado operativo y request id", async () => {
  const health = await request(app).get("/api/health").set("x-request-id", "health-check-123");
  assert.equal(health.status, 200);
  assert.equal(health.headers["x-request-id"], "health-check-123");
  assert.equal(health.body.service, "infinityshop-api");
  assert.equal(typeof health.body.uptimeSeconds, "number");

  const ready = await request(app).get("/api/ready");
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: "ready", database: "ok" });
  assert.match(ready.headers["x-request-id"] ?? "", /^[0-9a-f-]{36}$/);
});

test("rechaza mutaciones originadas fuera de la web configurada", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .set("origin", "https://sitio-malicioso.example")
    .send({});
  assert.equal(response.status, 403);
  assert.equal(response.body.message, "Origen no permitido");
});
