import test from "node:test";
import assert from "node:assert/strict";

import { createStaff, updateStaff } from "../src/modules/users/users.controller.js";
import User from "../src/modules/users/user.model.js";

const buildRes = () => {
  const response = {
    statusCode: null,
    body: null
  };

  return {
    response,
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(payload) {
      response.body = payload;
      return this;
    }
  };
};

test("create staff rejects privilege escalation beyond the actor's permissions", async () => {
  const original = User.findOne;
  const originalCreate = User.create;

  User.findOne = async () => null;
  User.create = async (data) => ({ ...data, _id: "new-staff" });

  try {
    const req = {
      user: {
        role: "owner",
        businessId: "business-1",
        permissions: {
          canInviteStaff: true,
          canManageSettings: false,
          canAccessPOS: true
        }
      },
      body: {
        name: "New Staff",
        email: "newstaff@example.com",
        password: "secret123",
        permissions: {
          canManageSettings: true,
          canAccessPOS: true
        }
      }
    };

    const res = buildRes();
    await createStaff(req, res);

    assert.equal(res.response.statusCode, 403);
    assert.match(res.response.body.message, /cannot grant permissions/i);
  } finally {
    User.findOne = original;
    User.create = originalCreate;
  }
});

test("update staff rejects privilege escalation beyond the actor's permissions", async () => {
  const originalFindById = User.findById;
  const originalSave = User.prototype.save;

  const existingUser = {
    business: { toString: () => "business-1" },
    permissions: {
      canViewProducts: true,
      canAccessPOS: true,
      canEditStaffPermissions: true
    },
    branch: null,
    save: async function () {
      return this;
    }
  };

  User.findById = async () => existingUser;
  User.prototype.save = async function () {
    return this;
  };

  try {
    const req = {
      user: {
        role: "owner",
        businessId: "business-1",
        permissions: {
          canEditStaffPermissions: true,
          canManageSettings: false,
          canAccessPOS: true
        }
      },
      params: { id: "staff-2" },
      body: {
        permissions: {
          canManageSettings: true,
          canEditStaffPermissions: true
        }
      }
    };

    const res = buildRes();
    await updateStaff(req, res);

    assert.equal(res.response.statusCode, 403);
    assert.match(res.response.body.message, /cannot grant permissions/i);
  } finally {
    User.findById = originalFindById;
    User.prototype.save = originalSave;
  }
});
