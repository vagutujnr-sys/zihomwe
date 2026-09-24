import test from "node:test";
import assert from "node:assert/strict";
import {
  formatHandle,
  handleFromName,
  isValidHandle,
  orderedParticipantIds,
  sanitizeHandleInput,
} from "../src/lib/handles";

test("sanitizes and validates handles", () => {
  assert.equal(sanitizeHandleInput("@Lloyd_Gutu!"), "lloyd_gutu");
  assert.equal(isValidHandle("lloydgutu"), true);
  assert.equal(isValidHandle("ab"), false);
  assert.equal(formatHandle("lloydgutu"), "@lloydgutu");
});

test("builds handle candidates from names", () => {
  assert.equal(handleFromName("Lloyd Gutu"), "lloydgutu");
  assert.match(handleFromName("", "263785323166"), /^user\d+$/);
});

test("orders participant ids stably", () => {
  const [a, b] = orderedParticipantIds("b", "a");
  assert.deepEqual([a, b], ["a", "b"]);
});
