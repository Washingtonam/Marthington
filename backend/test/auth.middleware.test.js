import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import http from "node:http";

import app from "../src/app.js";
import protect from "../src/middlewares/auth.middleware.js";
import User from "../src/modules/users/user.model.js";
import Business from "../src/modules/businesses/business.model.js";

const makeRequest = (options) => new Promise((resolve, reject) => {
  const req = http.request(options, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve({
      statusCode: res.statusCode,
      headers: res.headers,
      body: Buffer.concat(chunks).toString()
    }));
  });

  req.on("error", reject);
  req.end();
});

test("allows the production frontend origin and preflight headers", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    const getRes = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/health",
      method: "GET",
      headers: {
        Origin: "https://bms.marthington.com.ng",
        Authorization: "Bearer test-token"
      }
    });

    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.headers["access-control-allow-origin"], "https://bms.marthington.com.ng");
    assert.equal(getRes.headers["access-control-allow-headers"], undefined);

    const optionsRes = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/sales",
      method: "OPTIONS",
      headers: {
        Origin: "https://bms.marthington.com.ng",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization, content-type, x-business-id"
      }
    });

    assert.equal(optionsRes.statusCode, 204);
    assert.equal(optionsRes.headers["access-control-allow-origin"], "https://bms.marthington.com.ng");
    assert.match((optionsRes.headers["access-control-allow-headers"] || ""), /authorization/i);
    assert.match((optionsRes.headers["access-control-allow-methods"] || ""), /GET/i);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test("protect allows affiliate users without a linked business", async () => {
  process.env.JWT_SECRET = "test-secret";

  const originalFindById = User.findById;
  const originalBusinessFindById = Business.findById;

  const token = jwt.sign({ id: "user-1" }, process.env.JWT_SECRET);

  User.findById = () => ({
    populate: async () => ({
      _id: "user-1",
      email: "affiliate@example.com",
      name: "Affiliate User",
      role: "affiliate",
      isActive: true,
      permissions: {},
      business: null
    })
  });

  Business.findById = async () => null;

  const req = {
    headers: {
      authorization: `Bearer ${token}`
    }
  };

  let statusCode;
  let responseBody;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return {
        json(body) {
          responseBody = body;
        }
      };
    },
    json(body) {
      responseBody = body;
    }
  };

  try {
    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(statusCode, undefined);
    assert.equal(responseBody, undefined);
    assert.equal(req.user.businessId, null);
  } finally {
    User.findById = originalFindById;
    Business.findById = originalBusinessFindById;
  }
});
