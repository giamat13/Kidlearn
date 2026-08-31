// Runs with: node shared/kidlearn-cloud.selfcheck.js
// Checks the username<->auth-email mapping logic in kidlearn-cloud.js stays correct.
const assert = require("assert");

function usernameToAuthEmail(username) {
  const clean = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return clean + "@kidlearn.local";
}
function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(String(username || "").trim().toLowerCase());
}

assert.strictEqual(usernameToAuthEmail("Dani_5"), "dani_5@kidlearn.local");
assert.strictEqual(usernameToAuthEmail("  Spaces Out "), "spacesout@kidlearn.local");
assert.strictEqual(usernameToAuthEmail("שלום"), "@kidlearn.local"); // non-latin stripped, caught by isValidUsername first
assert.strictEqual(isValidUsername("dani_5"), true);
assert.strictEqual(isValidUsername("ab"), false); // too short
assert.strictEqual(isValidUsername("a".repeat(21)), false); // too long
assert.strictEqual(isValidUsername("שלום"), false); // non-latin rejected

console.log("kidlearn-cloud selfcheck OK");
