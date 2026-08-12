import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBranchAssignment } from '../src/modules/staff/staff.controller.js';

test('empty branch values are treated as head office / no branch assignment', () => {
  assert.equal(normalizeBranchAssignment(''), null);
  assert.equal(normalizeBranchAssignment('   '), null);
  assert.equal(normalizeBranchAssignment(undefined), null);
  assert.equal(normalizeBranchAssignment('64c7d5cdd1d554e4b81d9d1a'), '64c7d5cdd1d554e4b81d9d1a');
});
