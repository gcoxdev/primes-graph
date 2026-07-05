const DEFAULT_N = 100;
const MIN_N = 2;
const MAX_N = 5000;
const BASE_CELL_SIZE = 14;
const HEADER_SIZE = 58;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const MAX_CANVAS_BACKING_SIZE = 8192;
const SIDEBAR_STORAGE_KEY = "primeInterferenceSidebarCollapsed";

const palette = {
  page: "#11100d",
  header: "#24231f",
  headerAlt: "#2f2d27",
  grid: "#3d392f",
  majorGrid: "#6b624f",
  text: "#f2ead7",
  muted: "#b8ad96",
  empty: "#242119",
  frequency: "#ffd84f",
  frequencyGlow: "rgba(255, 216, 79, 0.26)",
  prime: "#20b96d",
  primeGlow: "rgba(32, 185, 109, 0.32)",
  hoverBand: "rgba(242, 234, 215, 0.13)",
  hoverLine: "rgba(242, 234, 215, 0.62)",
  hoverIntersection: "rgba(236, 111, 67, 0.38)",
};

export function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function normalizeGridSize(value) {
  return Math.round(clampNumber(value, MIN_N, MAX_N));
}

export function getCanvasPixelRatio(logicalSize, devicePixelRatio = 1) {
  const cappedDeviceRatio = Math.min(devicePixelRatio || 1, 2);
  const sizeRatio = MAX_CANVAS_BACKING_SIZE / Math.max(1, logicalSize);
  return Math.max(0.05, Math.min(cappedDeviceRatio, sizeRatio));
}

export function getCanvasLayout(
  size,
  cellSize,
  headerSize,
  devicePixelRatio = 1,
  viewportWidth,
  viewportHeight,
) {
  const snappedCellSize = Math.max(1, Math.round(cellSize));
  const logicalSize = headerSize + size * snappedCellSize;
  const displayWidth = Math.max(1, Math.min(logicalSize, Math.floor(viewportWidth || logicalSize)));
  const displayHeight = Math.max(1, Math.min(logicalSize, Math.floor(viewportHeight || logicalSize)));
  const dpr =
    viewportWidth && viewportHeight
      ? Math.min(devicePixelRatio || 1, 2)
      : getCanvasPixelRatio(logicalSize, devicePixelRatio);

  return {
    cellSize: snappedCellSize,
    logicalSize,
    displayWidth,
    displayHeight,
    backingWidth: Math.ceil(displayWidth * dpr),
    backingHeight: Math.ceil(displayHeight * dpr),
    dpr,
  };
}

export function getVisibleGridBounds(
  size,
  cellSize,
  headerSize,
  scrollLeft,
  scrollTop,
  viewportWidth,
  viewportHeight,
) {
  const totalSize = headerSize + size * cellSize;
  const left = Math.max(0, Math.min(totalSize, scrollLeft));
  const top = Math.max(0, Math.min(totalSize, scrollTop));
  const right = Math.max(left, Math.min(totalSize, left + viewportWidth));
  const bottom = Math.max(top, Math.min(totalSize, top + viewportHeight));
  const firstColumn = Math.max(1, Math.min(size, Math.floor((left - headerSize) / cellSize) + 1));
  const lastColumn = Math.max(1, Math.min(size, Math.ceil((right - headerSize) / cellSize)));
  const firstRow = Math.max(1, Math.min(size, Math.floor((top - headerSize) / cellSize) + 1));
  const lastRow = Math.max(1, Math.min(size, Math.ceil((bottom - headerSize) / cellSize)));

  return {
    left,
    top,
    right,
    bottom,
    totalSize,
    firstRow,
    lastRow,
    firstColumn,
    lastColumn,
  };
}

export function getInterferenceRows(column) {
  const rows = [];
  for (let row = 1; row <= column; row += 1) {
    if (column % row === 0) rows.push(row);
  }
  return rows;
}

export function buildInterferenceModel(size) {
  const primeColumns = new Uint8Array(size + 1);
  let primeCount = 0;

  if (size >= 2) {
    primeColumns.fill(1, 2);
  }

  for (let factor = 2; factor * factor <= size; factor += 1) {
    if (!primeColumns[factor]) continue;

    for (let multiple = factor * factor; multiple <= size; multiple += factor) {
      primeColumns[multiple] = 0;
    }
  }

  for (let column = 2; column <= size; column += 1) {
    if (primeColumns[column]) primeCount += 1;
  }

  return { size, primeColumns, primeCount };
}

export function isPrimeByInterference(column) {
  if (column < 2) return false;
  const interferenceRows = getInterferenceRows(column);
  return (
    interferenceRows.length === 2 &&
    interferenceRows[0] === 1 &&
    interferenceRows[1] === column
  );
}

export function classifyCell(row, column, options = {}) {
  const isPrimeColumn = isPrimeByInterference(column);
  if (options.highlightPrimeColumns && isPrimeColumn && row <= column) return "prime";
  if ((row === 1 || row === column) && isPrimeColumn) return "prime";
  if (column % row === 0) return "frequency";
  return "empty";
}

export function getSidebarToggleState(collapsed) {
  return collapsed
    ? {
        className: "sidebar-collapsed",
        expanded: false,
        label: "Expand controls",
        symbol: ">",
      }
    : {
        className: "",
        expanded: true,
        label: "Collapse controls",
        symbol: "<",
      };
}

export function getHoverSelection(row, column, size) {
  if (row < 1 || column < 1 || row > size || column > size) {
    return { active: false, row: 0, column: 0 };
  }

  return { active: true, row, column };
}

export function shouldDrawRayRoot(row, model, primeRootsOnly) {
  if (!primeRootsOnly) return true;
  if (row === 1) return true;
  return Boolean(model.primeColumns[row]);
}

export function shouldDrawDiagonalRayRoot(root, model) {
  if (root === 1) return true;
  return Boolean(model.primeColumns[root]);
}

export function shouldDrawDiagonalRayCell(root, row, model, options = {}) {
  return shouldDrawDiagonalRayRoot(root, model) && shouldDrawRayRoot(row, model, options.primeRootsOnly);
}

export function getHorizontalRayCell(column) {
  return { row: 1, column };
}

export function shouldDrawHorizontalRayCell(column, model, options = {}) {
  if (!options.primeRootsOnly || !options.diagonalPrimeRays) return true;
  if (column === 1) return true;
  return Boolean(model.primeColumns[column]);
}

export function getFrequencyLayers(options = {}) {
  const diagonalPrimeRays = Boolean(options.diagonalPrimeRays);

  return {
    diagonalPrimeRays,
    rowFrequencyHits: !diagonalPrimeRays,
  };
}

function countPrimeSignals(size) {
  return buildInterferenceModel(size).primeCount;
}

function createState() {
  const model = buildInterferenceModel(DEFAULT_N);

  return {
    size: DEFAULT_N,
    zoom: 1,
    cellSize: BASE_CELL_SIZE,
    headerSize: HEADER_SIZE,
    dpr: 1,
    scrollLeft: 0,
    scrollTop: 0,
    viewportWidth: 1,
    viewportHeight: 1,
    hover: getHoverSelection(0, 0, DEFAULT_N),
    highlightPrimeColumns: false,
    primeRootsOnly: false,
    diagonalPrimeRays: false,
    model,
    primeCount: model.primeCount,
  };
}

function resizeCanvas(canvas, stage, wrap, state) {
  const layout = getCanvasLayout(
    state.size,
    state.cellSize,
    state.headerSize,
    window.devicePixelRatio,
    wrap.clientWidth,
    wrap.clientHeight,
  );
  state.cellSize = layout.cellSize;
  state.dpr = layout.dpr;
  state.viewportWidth = layout.displayWidth;
  state.viewportHeight = layout.displayHeight;

  stage.style.width = `${layout.logicalSize}px`;
  stage.style.height = `${layout.logicalSize}px`;
  state.scrollLeft = wrap.scrollLeft;
  state.scrollTop = wrap.scrollTop;

  if (canvas.width !== layout.backingWidth) canvas.width = layout.backingWidth;
  if (canvas.height !== layout.backingHeight) canvas.height = layout.backingHeight;
  canvas.style.width = `${layout.displayWidth}px`;
  canvas.style.height = `${layout.displayHeight}px`;
}

function drawHeaders(ctx, state, bounds) {
  const { size, cellSize, headerSize } = state;
  const totalSize = headerSize + size * cellSize;
  const headerRight = Math.min(totalSize, bounds.right);
  const headerBottom = Math.min(totalSize, bounds.bottom);

  ctx.fillStyle = palette.header;
  if (bounds.top < headerSize) {
    ctx.fillRect(bounds.left, 0, headerRight - bounds.left, headerSize);
  }
  if (bounds.left < headerSize) {
    ctx.fillRect(0, bounds.top, headerSize, headerBottom - bounds.top);
  }

  ctx.fillStyle = palette.headerAlt;
  if (bounds.left < headerSize && bounds.top < headerSize) {
    ctx.fillRect(0, 0, headerSize, headerSize);
  }

  if (state.hover.active) {
    const hoverX = headerSize + (state.hover.column - 1) * cellSize;
    const hoverY = headerSize + (state.hover.row - 1) * cellSize;

    ctx.fillStyle = palette.hoverBand;
    if (bounds.top < headerSize && hoverX + cellSize >= bounds.left && hoverX <= bounds.right) {
      ctx.fillRect(hoverX, 0, cellSize, headerSize);
    }
    if (bounds.left < headerSize && hoverY + cellSize >= bounds.top && hoverY <= bounds.bottom) {
      ctx.fillRect(0, hoverY, headerSize, cellSize);
    }
  }

  ctx.strokeStyle = palette.majorGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (headerSize >= bounds.left && headerSize <= bounds.right) {
    ctx.moveTo(headerSize, bounds.top);
    ctx.lineTo(headerSize, bounds.bottom);
  }
  if (headerSize >= bounds.top && headerSize <= bounds.bottom) {
    ctx.moveTo(bounds.left, headerSize);
    ctx.lineTo(bounds.right, headerSize);
  }
  ctx.stroke();

  const showEvery = cellSize >= 22 ? 1 : cellSize >= 12 ? 5 : 10;
  ctx.fillStyle = palette.text;
  ctx.font = `${Math.max(9, Math.min(12, cellSize * 0.72))}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const firstVisibleIndex = Math.min(bounds.firstRow, bounds.firstColumn);
  const lastVisibleIndex = Math.max(bounds.lastRow, bounds.lastColumn);
  for (let index = firstVisibleIndex; index <= lastVisibleIndex; index += 1) {
    if (index !== 1 && index % showEvery !== 0 && index !== size) continue;
    const offset = headerSize + (index - 0.5) * cellSize;
    if (bounds.top < headerSize && offset >= bounds.left && offset <= bounds.right) {
      ctx.fillText(String(index), offset, headerSize / 2);
    }
    if (bounds.left < headerSize && offset >= bounds.top && offset <= bounds.bottom) {
      ctx.fillText(String(index), headerSize / 2, offset);
    }
  }
}

function drawHoverGuides(ctx, state, bounds) {
  if (!state.hover.active) return;

  const { size, cellSize, headerSize } = state;
  const gridSize = size * cellSize;
  const x = headerSize + (state.hover.column - 1) * cellSize;
  const y = headerSize + (state.hover.row - 1) * cellSize;

  ctx.fillStyle = palette.hoverBand;
  if (y + cellSize >= bounds.top && y <= bounds.bottom) {
    const bandLeft = Math.max(headerSize, bounds.left);
    const bandRight = Math.min(gridSize + headerSize, bounds.right);
    ctx.fillRect(bandLeft, y, bandRight - bandLeft, cellSize);
  }
  if (x + cellSize >= bounds.left && x <= bounds.right) {
    const bandTop = Math.max(headerSize, bounds.top);
    const bandBottom = Math.min(gridSize + headerSize, bounds.bottom);
    ctx.fillRect(x, bandTop, cellSize, bandBottom - bandTop);
  }

  ctx.fillStyle = palette.hoverIntersection;
  if (x + cellSize >= bounds.left && x <= bounds.right && y + cellSize >= bounds.top && y <= bounds.bottom) {
    ctx.fillRect(x, y, cellSize, cellSize);
  }

  ctx.strokeStyle = palette.hoverLine;
  ctx.lineWidth = 2;
  if (x + cellSize >= bounds.left && x <= bounds.right && y + cellSize >= bounds.top && y <= bounds.bottom) {
    ctx.strokeRect(x + 1, y + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2));
  }
}

function drawCellMark(ctx, x, y, cellSize, glowColor, markColor) {
  ctx.fillStyle = glowColor;
  ctx.fillRect(x, y, cellSize, cellSize);

  const inset = Math.max(1, cellSize * 0.18);
  ctx.fillStyle = markColor;
  ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
}

function drawRowFrequencyHits(ctx, state, model, bounds) {
  const { size, cellSize, headerSize } = state;

  for (let row = bounds.firstRow; row <= bounds.lastRow; row += 1) {
    if (!shouldDrawRayRoot(row, model, state.primeRootsOnly)) continue;

    const firstMultiple = Math.max(row, Math.ceil(bounds.firstColumn / row) * row);
    for (let column = firstMultiple; column <= Math.min(size, bounds.lastColumn); column += row) {
      const x = headerSize + (column - 1) * cellSize;
      const y = headerSize + (row - 1) * cellSize;
      drawCellMark(ctx, x, y, cellSize, palette.frequencyGlow, palette.frequency);
    }
  }
}

function drawDiagonalPrimeRays(ctx, state, model, bounds) {
  const { size, cellSize, headerSize } = state;

  if (bounds.firstRow <= 1 && bounds.lastRow >= 1) {
    for (let column = bounds.firstColumn; column <= bounds.lastColumn; column += 1) {
      if (!shouldDrawHorizontalRayCell(column, model, state)) continue;

      const cell = getHorizontalRayCell(column);
      const x = headerSize + (cell.column - 1) * cellSize;
      const y = headerSize + (cell.row - 1) * cellSize;
      drawCellMark(ctx, x, y, cellSize, palette.frequencyGlow, palette.frequency);
    }
  }

  for (let root = 1; root <= size; root += 1) {
    if (!shouldDrawDiagonalRayRoot(root, model)) continue;

    const firstStep = Math.max(bounds.firstRow, Math.ceil(bounds.firstColumn / root));
    const lastStep = Math.min(bounds.lastRow, Math.floor(bounds.lastColumn / root), size);
    for (let step = firstStep; step <= lastStep; step += 1) {
      const column = step * root;
      const row = step;
      if (!shouldDrawDiagonalRayCell(root, row, model, state)) continue;

      const x = headerSize + (column - 1) * cellSize;
      const y = headerSize + (row - 1) * cellSize;
      drawCellMark(ctx, x, y, cellSize, palette.frequencyGlow, palette.frequency);
    }
  }
}

function drawGrid(ctx, state) {
  const { size, cellSize, headerSize } = state;
  const totalSize = headerSize + size * cellSize;
  const gridSize = size * cellSize;
  const bounds = getVisibleGridBounds(
    size,
    cellSize,
    headerSize,
    state.scrollLeft,
    state.scrollTop,
    state.viewportWidth,
    state.viewportHeight,
  );
  const model = state.model && state.model.size === size ? state.model : buildInterferenceModel(size);
  state.model = model;
  state.primeCount = model.primeCount;

  ctx.fillStyle = palette.page;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);

  ctx.fillStyle = palette.empty;
  const visibleGridLeft = Math.max(headerSize, bounds.left);
  const visibleGridTop = Math.max(headerSize, bounds.top);
  const visibleGridRight = Math.min(totalSize, bounds.right);
  const visibleGridBottom = Math.min(totalSize, bounds.bottom);
  if (visibleGridRight > visibleGridLeft && visibleGridBottom > visibleGridTop) {
    ctx.fillRect(
      visibleGridLeft,
      visibleGridTop,
      visibleGridRight - visibleGridLeft,
      visibleGridBottom - visibleGridTop,
    );
  }

  const layers = getFrequencyLayers(state);
  if (layers.rowFrequencyHits) {
    drawRowFrequencyHits(ctx, state, model, bounds);
  }

  if (layers.diagonalPrimeRays) {
    drawDiagonalPrimeRays(ctx, state, model, bounds);
  }

  for (let column = Math.max(2, bounds.firstColumn); column <= bounds.lastColumn; column += 1) {
    if (!model.primeColumns[column]) continue;

    const x = headerSize + (column - 1) * cellSize;
    if (state.highlightPrimeColumns) {
      for (let row = bounds.firstRow; row <= Math.min(column, bounds.lastRow); row += 1) {
        const y = headerSize + (row - 1) * cellSize;
        drawCellMark(ctx, x, y, cellSize, palette.primeGlow, palette.prime);
      }
    } else {
      if (bounds.firstRow <= 1 && bounds.lastRow >= 1) {
        drawCellMark(ctx, x, headerSize, cellSize, palette.primeGlow, palette.prime);
      }
      if (column >= bounds.firstRow && column <= bounds.lastRow) {
        drawCellMark(
          ctx,
          x,
          headerSize + (column - 1) * cellSize,
          cellSize,
          palette.primeGlow,
          palette.prime,
        );
      }
    }
  }

  drawHoverGuides(ctx, state, bounds);

  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();

  const firstVerticalLine = Math.max(0, Math.floor((bounds.left - headerSize) / cellSize));
  const lastVerticalLine = Math.min(size, Math.ceil((bounds.right - headerSize) / cellSize));
  for (let index = firstVerticalLine; index <= lastVerticalLine; index += 1) {
    const offset = headerSize + index * cellSize;
    ctx.moveTo(offset, visibleGridTop);
    ctx.lineTo(offset, visibleGridBottom);
  }

  const firstHorizontalLine = Math.max(0, Math.floor((bounds.top - headerSize) / cellSize));
  const lastHorizontalLine = Math.min(size, Math.ceil((bounds.bottom - headerSize) / cellSize));
  for (let index = firstHorizontalLine; index <= lastHorizontalLine; index += 1) {
    const offset = headerSize + index * cellSize;
    ctx.moveTo(visibleGridLeft, offset);
    ctx.lineTo(visibleGridRight, offset);
  }

  ctx.stroke();
  drawHeaders(ctx, state, bounds);
}

function render(canvas, stage, wrap, state) {
  state.cellSize = BASE_CELL_SIZE * state.zoom;
  resizeCanvas(canvas, stage, wrap, state);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, state.viewportWidth, state.viewportHeight);
  ctx.translate(-state.scrollLeft, -state.scrollTop);
  drawGrid(ctx, state);
}

function describeCell(row, column, options = {}) {
  if (row < 1 || column < 1) return "Move over the grid to inspect a cell.";
  const type = classifyCell(row, column, options);

  if (type === "prime") {
    return `row ${row}, column ${column}: prime signal; only rows 1 and ${column} interfere.`;
  }

  if (type === "frequency") {
    return `row ${row}, column ${column}: frequency hit; ${column} is divisible by ${row}.`;
  }

  return `row ${row}, column ${column}: no signal from this row.`;
}

function getCellFromPointer(event, canvas, wrap, state) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left + wrap.scrollLeft - state.headerSize;
  const y = event.clientY - rect.top + wrap.scrollTop - state.headerSize;
  const column = Math.floor(x / state.cellSize) + 1;
  const row = Math.floor(y / state.cellSize) + 1;

  if (row < 1 || column < 1 || row > state.size || column > state.size) {
    return { row: 0, column: 0 };
  }

  return { row, column };
}

function init() {
  const shell = document.querySelector("#appShell");
  const sidebarToggle = document.querySelector("#sidebarToggle");
  const canvas = document.querySelector("#interferenceCanvas");
  const wrap = document.querySelector("#canvasWrap");
  const stage = document.querySelector("#canvasStage");
  const controls = document.querySelector("#controls");
  const sizeInput = document.querySelector("#sizeInput");
  const primeColumnInput = document.querySelector("#primeColumnInput");
  const primeRayInput = document.querySelector("#primeRayInput");
  const diagonalPrimeRayInput = document.querySelector("#diagonalPrimeRayInput");
  const zoomInput = document.querySelector("#zoomInput");
  const zoomOut = document.querySelector("#zoomOut");
  const zoomIn = document.querySelector("#zoomIn");
  const resetView = document.querySelector("#resetView");
  const zoomOutput = document.querySelector("#zoomOutput");
  const columnCount = document.querySelector("#columnCount");
  const primeCount = document.querySelector("#primeCount");
  const cellPitch = document.querySelector("#cellPitch");
  const inspect = document.querySelector("#inspect");
  const state = createState();
  let sidebarCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";

  const applySidebarState = () => {
    const toggleState = getSidebarToggleState(sidebarCollapsed);
    shell.classList.toggle("sidebar-collapsed", Boolean(toggleState.className));
    sidebarToggle.setAttribute("aria-expanded", String(toggleState.expanded));
    sidebarToggle.setAttribute("aria-label", toggleState.label);
    sidebarToggle.title = toggleState.label;
    sidebarToggle.querySelector("span").textContent = toggleState.symbol;
  };

  const updateStats = () => {
    zoomOutput.value = `${Math.round(state.zoom * 100)}%`;
    columnCount.textContent = String(state.size);
    primeCount.textContent = String(state.primeCount);
    cellPitch.textContent = `${Math.round(state.cellSize)} px`;
  };

  const redraw = () => {
    render(canvas, stage, wrap, state);
    updateStats();
  };

  let scrollFrame = 0;
  const redrawFromScroll = () => {
    scrollFrame = 0;
    render(canvas, stage, wrap, state);
  };

  const scheduleScrollRedraw = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(redrawFromScroll);
  };

  const updateSizeFromInput = () => {
    state.size = normalizeGridSize(sizeInput.value);
    sizeInput.value = String(state.size);
    state.hover = getHoverSelection(state.hover.row, state.hover.column, state.size);
    state.model = buildInterferenceModel(state.size);
    state.primeCount = state.model.primeCount;
    redraw();
  };

  controls.addEventListener("submit", (event) => {
    event.preventDefault();
    updateSizeFromInput();
  });

  sizeInput.addEventListener("change", () => {
    updateSizeFromInput();
  });

  primeColumnInput.addEventListener("change", () => {
    state.highlightPrimeColumns = primeColumnInput.checked;
    redraw();
  });

  primeRayInput.addEventListener("change", () => {
    state.primeRootsOnly = primeRayInput.checked;
    redraw();
  });

  diagonalPrimeRayInput.addEventListener("change", () => {
    state.diagonalPrimeRays = diagonalPrimeRayInput.checked;
    redraw();
  });

  zoomInput.addEventListener("input", () => {
    state.zoom = clampNumber(zoomInput.value, MIN_ZOOM, MAX_ZOOM);
    redraw();
  });

  zoomOut.addEventListener("click", () => {
    state.zoom = clampNumber(state.zoom - 0.15, MIN_ZOOM, MAX_ZOOM);
    zoomInput.value = String(state.zoom);
    redraw();
  });

  zoomIn.addEventListener("click", () => {
    state.zoom = clampNumber(state.zoom + 0.15, MIN_ZOOM, MAX_ZOOM);
    zoomInput.value = String(state.zoom);
    redraw();
  });

  resetView.addEventListener("click", () => {
    state.zoom = 1;
    zoomInput.value = "1";
    wrap.scrollTo({ left: 0, top: 0 });
    redraw();
  });

  sidebarToggle.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    applySidebarState();
    redraw();
  });

  canvas.addEventListener("pointermove", (event) => {
    const { row, column } = getCellFromPointer(event, canvas, wrap, state);
    inspect.textContent = describeCell(row, column, {
      highlightPrimeColumns: state.highlightPrimeColumns,
    });

    if (row !== state.hover.row || column !== state.hover.column) {
      state.hover = getHoverSelection(row, column, state.size);
      redraw();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (!state.hover.active) return;
    state.hover = getHoverSelection(0, 0, state.size);
    inspect.textContent = "Move over the grid to inspect a cell.";
    redraw();
  });

  wrap.addEventListener("scroll", () => {
    scheduleScrollRedraw();
  });

  applySidebarState();
  redraw();
}

if (typeof document !== "undefined") {
  init();
}
