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
    hover: getHoverSelection(0, 0, DEFAULT_N),
    highlightPrimeColumns: false,
    model,
    primeCount: model.primeCount,
  };
}

function resizeCanvas(canvas, state) {
  const logicalSize = state.headerSize + state.size * state.cellSize;
  state.dpr = getCanvasPixelRatio(logicalSize, window.devicePixelRatio);
  canvas.width = Math.ceil(logicalSize * state.dpr);
  canvas.height = Math.ceil(logicalSize * state.dpr);
  canvas.style.width = `${logicalSize}px`;
  canvas.style.height = `${logicalSize}px`;
}

function drawHeaders(ctx, state) {
  const { size, cellSize, headerSize } = state;
  const totalSize = headerSize + size * cellSize;

  ctx.fillStyle = palette.header;
  ctx.fillRect(0, 0, totalSize, headerSize);
  ctx.fillRect(0, 0, headerSize, totalSize);

  ctx.fillStyle = palette.headerAlt;
  ctx.fillRect(0, 0, headerSize, headerSize);

  if (state.hover.active) {
    const hoverX = headerSize + (state.hover.column - 1) * cellSize;
    const hoverY = headerSize + (state.hover.row - 1) * cellSize;

    ctx.fillStyle = palette.hoverBand;
    ctx.fillRect(hoverX, 0, cellSize, headerSize);
    ctx.fillRect(0, hoverY, headerSize, cellSize);
  }

  ctx.strokeStyle = palette.majorGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headerSize, 0);
  ctx.lineTo(headerSize, totalSize);
  ctx.moveTo(0, headerSize);
  ctx.lineTo(totalSize, headerSize);
  ctx.stroke();

  const showEvery = cellSize >= 22 ? 1 : cellSize >= 12 ? 5 : 10;
  ctx.fillStyle = palette.text;
  ctx.font = `${Math.max(9, Math.min(12, cellSize * 0.72))}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let index = 1; index <= size; index += 1) {
    if (index !== 1 && index % showEvery !== 0 && index !== size) continue;
    const offset = headerSize + (index - 0.5) * cellSize;
    ctx.fillText(String(index), offset, headerSize / 2);
    ctx.fillText(String(index), headerSize / 2, offset);
  }
}

function drawHoverGuides(ctx, state) {
  if (!state.hover.active) return;

  const { size, cellSize, headerSize } = state;
  const gridSize = size * cellSize;
  const x = headerSize + (state.hover.column - 1) * cellSize;
  const y = headerSize + (state.hover.row - 1) * cellSize;

  ctx.fillStyle = palette.hoverBand;
  ctx.fillRect(headerSize, y, gridSize, cellSize);
  ctx.fillRect(x, headerSize, cellSize, gridSize);

  ctx.fillStyle = palette.hoverIntersection;
  ctx.fillRect(x, y, cellSize, cellSize);

  ctx.strokeStyle = palette.hoverLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2));
}

function drawCellMark(ctx, x, y, cellSize, glowColor, markColor) {
  ctx.fillStyle = glowColor;
  ctx.fillRect(x, y, cellSize, cellSize);

  const inset = Math.max(1, cellSize * 0.18);
  ctx.fillStyle = markColor;
  ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
}

function drawGrid(ctx, state) {
  const { size, cellSize, headerSize } = state;
  const totalSize = headerSize + size * cellSize;
  const gridSize = size * cellSize;
  const model = state.model && state.model.size === size ? state.model : buildInterferenceModel(size);
  state.model = model;
  state.primeCount = model.primeCount;

  ctx.fillStyle = palette.page;
  ctx.fillRect(0, 0, totalSize, totalSize);

  ctx.fillStyle = palette.empty;
  ctx.fillRect(headerSize, headerSize, gridSize, gridSize);

  for (let row = 1; row <= size; row += 1) {
    for (let column = row; column <= size; column += row) {
      const x = headerSize + (column - 1) * cellSize;
      const y = headerSize + (row - 1) * cellSize;
      drawCellMark(ctx, x, y, cellSize, palette.frequencyGlow, palette.frequency);
    }
  }

  for (let column = 2; column <= size; column += 1) {
    if (!model.primeColumns[column]) continue;

    const x = headerSize + (column - 1) * cellSize;
    if (state.highlightPrimeColumns) {
      for (let row = 1; row <= column; row += 1) {
        const y = headerSize + (row - 1) * cellSize;
        drawCellMark(ctx, x, y, cellSize, palette.primeGlow, palette.prime);
      }
    } else {
      drawCellMark(ctx, x, headerSize, cellSize, palette.primeGlow, palette.prime);
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

  drawHoverGuides(ctx, state);

  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let index = 0; index <= size; index += 1) {
    const offset = headerSize + index * cellSize;
    ctx.moveTo(headerSize, offset);
    ctx.lineTo(totalSize, offset);
    ctx.moveTo(offset, headerSize);
    ctx.lineTo(offset, totalSize);
  }

  ctx.stroke();
  drawHeaders(ctx, state);
}

function render(canvas, state) {
  state.cellSize = BASE_CELL_SIZE * state.zoom;
  resizeCanvas(canvas, state);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
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

function getCellFromPointer(event, canvas, state) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left - state.headerSize;
  const y = event.clientY - rect.top - state.headerSize;
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
  const controls = document.querySelector("#controls");
  const sizeInput = document.querySelector("#sizeInput");
  const primeColumnInput = document.querySelector("#primeColumnInput");
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
    render(canvas, state);
    updateStats();
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
    const { row, column } = getCellFromPointer(event, canvas, state);
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

  applySidebarState();
  redraw();
}

if (typeof document !== "undefined") {
  init();
}
