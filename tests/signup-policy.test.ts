import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOwnerSignup } from "../src/lib/signup-policy.ts";

const owner = "owner@example.com";

test("只有擁有者 email 能註冊；沒設定 OWNER_EMAIL 一律拒絕", () => {
  assert.equal(checkOwnerSignup({ email: " Owner@Example.com ", ownerEmail: owner, signupCode: undefined, providedCode: null }), null);
  assert.notEqual(checkOwnerSignup({ email: "x@example.com", ownerEmail: owner, signupCode: undefined, providedCode: null }), null);
  assert.notEqual(checkOwnerSignup({ email: owner, ownerEmail: undefined, signupCode: undefined, providedCode: null }), null);
});

test("設了註冊碼：只知道 email 搶不到帳號，碼對才放行", () => {
  assert.equal(checkOwnerSignup({ email: owner, ownerEmail: owner, signupCode: "s3cret", providedCode: null }), "註冊碼不正確");
  assert.equal(checkOwnerSignup({ email: owner, ownerEmail: owner, signupCode: "s3cret", providedCode: "s3cre" }), "註冊碼不正確");
  assert.equal(checkOwnerSignup({ email: owner, ownerEmail: owner, signupCode: "s3cret", providedCode: "s3cret" }), null);
  // 碼對但 email 不是擁有者，仍然拒絕。
  assert.notEqual(checkOwnerSignup({ email: "x@example.com", ownerEmail: owner, signupCode: "s3cret", providedCode: "s3cret" }), null);
});
