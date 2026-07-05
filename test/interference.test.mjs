import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInterferenceModel,
  classifyCell,
  getCanvasPixelRatio,
  getFrequencyLayers,
  getHorizontalRayCell,
  getHoverSelection,
  getInterferenceRows,
  getSidebarToggleState,
  isPrimeByInterference,
  normalizeGridSize,
  shouldDrawDiagonalRayCell,
  shouldDrawDiagonalRayRoot,
  shouldDrawHorizontalRayCell,
  shouldDrawRayRoot,
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

test("filters frequency ray roots to primes when requested", () => {
  const model = buildInterferenceModel(12);

  assert.equal(shouldDrawRayRoot(1, model, true), true);
  assert.equal(shouldDrawRayRoot(2, model, true), true);
  assert.equal(shouldDrawRayRoot(3, model, true), true);
  assert.equal(shouldDrawRayRoot(4, model, true), false);
  assert.equal(shouldDrawRayRoot(9, model, true), false);
  assert.equal(shouldDrawRayRoot(9, model, false), true);
});

test("filters diagonal ray roots to one and primes", () => {
  const model = buildInterferenceModel(12);

  assert.equal(shouldDrawDiagonalRayRoot(1, model), true);
  assert.equal(shouldDrawDiagonalRayRoot(2, model), true);
  assert.equal(shouldDrawDiagonalRayRoot(3, model), true);
  assert.equal(shouldDrawDiagonalRayRoot(4, model), false);
  assert.equal(shouldDrawDiagonalRayRoot(9, model), false);
});

test("applies row and diagonal prime-root filters together", () => {
  const model = buildInterferenceModel(30);

  assert.equal(
    shouldDrawDiagonalRayCell(5, 4, model, {
      primeRootsOnly: true,
    }),
    false,
  );
  assert.equal(
    shouldDrawDiagonalRayCell(5, 7, model, {
      primeRootsOnly: true,
    }),
    true,
  );
  assert.equal(
    shouldDrawDiagonalRayCell(4, 7, model, {
      primeRootsOnly: true,
    }),
    false,
  );
});

test("keeps the row-one horizontal ray in diagonal ray mode", () => {
  assert.deepEqual(getHorizontalRayCell(4), { row: 1, column: 4 });
});

test("filters row-one horizontal ray to primes when both prime-root modes are enabled", () => {
  const model = buildInterferenceModel(12);

  assert.equal(
    shouldDrawHorizontalRayCell(1, model, {
      primeRootsOnly: true,
      diagonalPrimeRays: true,
    }),
    true,
  );
  assert.equal(
    shouldDrawHorizontalRayCell(7, model, {
      primeRootsOnly: true,
      diagonalPrimeRays: true,
    }),
    true,
  );
  assert.equal(
    shouldDrawHorizontalRayCell(8, model, {
      primeRootsOnly: true,
      diagonalPrimeRays: true,
    }),
    false,
  );
  assert.equal(
    shouldDrawHorizontalRayCell(8, model, {
      primeRootsOnly: false,
      diagonalPrimeRays: true,
    }),
    true,
  );
});

test("combines prime-root rows and diagonal ray layers", () => {
  assert.deepEqual(
    getFrequencyLayers({
      primeRootsOnly: false,
      diagonalPrimeRays: false,
    }),
    {
      diagonalPrimeRays: false,
      rowFrequencyHits: true,
    },
  );
  assert.deepEqual(
    getFrequencyLayers({
      primeRootsOnly: false,
      diagonalPrimeRays: true,
    }),
    {
      diagonalPrimeRays: true,
      rowFrequencyHits: false,
    },
  );
  assert.deepEqual(
    getFrequencyLayers({
      primeRootsOnly: true,
      diagonalPrimeRays: true,
    }),
    {
      diagonalPrimeRays: true,
      rowFrequencyHits: false,
    },
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
