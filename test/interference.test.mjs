import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInterferenceModel,
  classifyCell,
  getCanvasPixelRatio,
  getHoverSelection,
  getInterferenceRows,
  getSidebarToggleState,
  isPrimeByInterference,
  normalizeGridSize,
} from "../src/app.js";

test("marks frequency hits when the column is divisible by the row", () => {
  assert.equal(classifyCell(3, 9), "frequency");
  assert.equal(classifyCell(4, 9), "empty");
});

test("detects primes only from first and self interference rows", () => {
  assert.deepEqual(getInterferenceRows(7), [1, 7]);
  assert.equal(isPrimeByInterference(7), true);
});

test("builds an interference model with divisor counts and prime columns", () => {
  const model = buildInterferenceModel(12);

  assert.equal(model.size, 12);
  assert.equal(model.primeCount, 5);
  assert.deepEqual(
    Array.from(model.primeColumns.entries())
      .filter(([, isPrime]) => isPrime)
      .map(([column]) => column),
    [2, 3, 5, 7, 11],
  );
});

test("rejects composites when extra interference rows exist", () => {
  assert.deepEqual(getInterferenceRows(12), [1, 2, 3, 4, 6, 12]);
  assert.equal(isPrimeByInterference(12), false);
});

test("classifies first-row and self cells in a prime column as prime", () => {
  assert.equal(classifyCell(1, 7), "prime");
  assert.equal(classifyCell(7, 7), "prime");
  assert.equal(classifyCell(2, 7), "empty");
  assert.equal(classifyCell(1, 8), "frequency");
});

test("optionally highlights the full prime column from row 1 through the prime", () => {
  assert.equal(classifyCell(2, 7, { highlightPrimeColumns: true }), "prime");
  assert.equal(classifyCell(6, 7, { highlightPrimeColumns: true }), "prime");
  assert.equal(classifyCell(8, 7, { highlightPrimeColumns: true }), "empty");
  assert.equal(classifyCell(2, 8, { highlightPrimeColumns: true }), "frequency");
});

test("describes sidebar toggle state for collapsed and expanded layouts", () => {
  assert.deepEqual(getSidebarToggleState(false), {
    className: "",
    expanded: true,
    label: "Collapse controls",
    symbol: "<",
  });

  assert.deepEqual(getSidebarToggleState(true), {
    className: "sidebar-collapsed",
    expanded: false,
    label: "Expand controls",
    symbol: ">",
  });
});

test("returns hover selection only for cells inside the grid", () => {
  assert.deepEqual(getHoverSelection(6, 11, 100), {
    active: true,
    row: 6,
    column: 11,
  });

  assert.deepEqual(getHoverSelection(0, 11, 100), {
    active: false,
    row: 0,
    column: 0,
  });

  assert.deepEqual(getHoverSelection(6, 101, 100), {
    active: false,
    row: 0,
    column: 0,
  });
});

test("normalizes grid size input for form-driven updates", () => {
  assert.equal(normalizeGridSize("37.7"), 38);
  assert.equal(normalizeGridSize("1"), 2);
  assert.equal(normalizeGridSize("900"), 900);
  assert.equal(normalizeGridSize("1200"), 1200);
  assert.equal(normalizeGridSize("6000"), 5000);
  assert.equal(normalizeGridSize("not a number"), 2);
});

test("caps canvas pixel ratio for very large logical canvases", () => {
  assert.equal(getCanvasPixelRatio(1000, 2), 2);
  assert.equal(getCanvasPixelRatio(20000, 2), 0.4096);
});
