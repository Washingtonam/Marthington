import test from "node:test";
import assert from "node:assert/strict";

import { canAccessBranch, resolveOperationalBranchId } from "../src/utils/branchAccess.js";

const requestFor = (overrides = {}) => ({
  user: {
    role: "staff",
    branchId: "branch-a",
    permissions: {
      canViewBranchInventory: true,
      canManageBranchInventory: true,
      ...overrides.permissions
    },
    ...overrides.user
  }
});

test("staff can view and manage their assigned branch", () => {
  const req = requestFor();

  assert.equal(canAccessBranch(req.user, "branch-a", "view"), true);
  assert.equal(canAccessBranch(req.user, "branch-a", "manage"), true);
});

test("staff cannot access another branch without explicit cross-branch permissions", () => {
  const req = requestFor();

  assert.equal(canAccessBranch(req.user, "branch-b", "view"), false);
  assert.equal(canAccessBranch(req.user, "branch-b", "manage"), false);
});

test("cross-branch permissions are independent for viewing and managing", () => {
  const viewOnlyRequest = requestFor({
    permissions: { canViewAllBranchInventory: true }
  });
  const manageRequest = requestFor({
    permissions: { canManageAllBranchInventory: true }
  });

  assert.equal(canAccessBranch(viewOnlyRequest.user, "branch-b", "view"), true);
  assert.equal(canAccessBranch(viewOnlyRequest.user, "branch-b", "manage"), false);
  assert.equal(canAccessBranch(manageRequest.user, "branch-b", "manage"), true);
});

test("owners retain access to every branch", () => {
  const req = requestFor({ user: { role: "owner", branchId: "branch-a" } });

  assert.equal(canAccessBranch(req.user, "branch-b", "view"), true);
  assert.equal(canAccessBranch(req.user, "branch-b", "manage"), true);
});

test("unassigned staff cannot fall back to head-office operations", () => {
  const req = requestFor({ user: { branchId: null } });

  assert.equal(resolveOperationalBranchId({ user: req.user }), undefined);
  assert.equal(resolveOperationalBranchId({ user: req.user, requestedBranchId: "headOffice" }), undefined);
});

test("assigned staff operations stay on their branch", () => {
  const req = requestFor();

  assert.equal(resolveOperationalBranchId({ user: req.user }), "branch-a");
  assert.equal(resolveOperationalBranchId({ user: req.user, requestedBranchId: "branch-b" }), undefined);
});