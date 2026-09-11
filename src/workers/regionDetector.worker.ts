/**
 * GridXD — Web Worker for robust visual-region detection.
 *
 * The detector intentionally returns [] when confidence is low. The UI can
 * then keep the manual-selection path instead of exporting a fabricated grid.
 */

export interface RegionRaw {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WorkerRegion extends RegionRaw {
  id: string;
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(r: number, g: number, b: number, br: number, bg: number, bb: number) {
  return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
}

function sampleBackground(data: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  const points: Array<[number, number]> = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ];
  const samples = points.map(([x, y]) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as [number, number, number];
  });
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return [
    median(samples.map((s) => s[0])),
    median(samples.map((s) => s[1])),
    median(samples.map((s) => s[2])),
  ];
}

function buildForegroundMask(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const [br, bg, bb] = sampleBackground(data, width, height);
  const bgLum = luminance(br, bg, bb);
  const tolerance = 34;

  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    if (data[p + 3] <= 10) continue;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const distance = colorDistance(r, g, b, br, bg, bb);
    const lumDelta = Math.abs(luminance(r, g, b) - bgLum);
    if (distance >= tolerance || lumDelta >= 24) mask[i] = 1;
  }
  return mask;
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

function connectedComponents(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: Array<RegionRaw & { pixels: number }> = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;

      let head = 0;
      let tail = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let pixels = 0;
      queue[tail++] = start;
      visited[start] = 1;

      while (head < tail) {
        const current = queue[head++];
        const cx = current % width;
        const cy = Math.floor(current / width);
        pixels++;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (!mask[next] || visited[next]) continue;
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }
      components.push({ minX, minY, maxX, maxY, pixels });
    }
  }
  return components;
}

function area(r: RegionRaw) {
  return Math.max(1, r.maxX - r.minX + 1) * Math.max(1, r.maxY - r.minY + 1);
}

function intersectionArea(a: RegionRaw, b: RegionRaw) {
  const w = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) + 1);
  const h = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) + 1);
  return w * h;
}

function contains(a: RegionRaw, b: RegionRaw) {
  return a.minX <= b.minX && a.minY <= b.minY && a.maxX >= b.maxX && a.maxY >= b.maxY;
}

function normalizeComponents(components: Array<RegionRaw & { pixels: number }>, width: number, height: number) {
  const imageArea = width * height;
  const minPixels = Math.max(8, Math.round(imageArea * 0.000025));
  const minDimension = Math.max(2, Math.round(Math.min(width, height) * 0.008));

  const candidates = components
    .filter((c) => {
      const w = c.maxX - c.minX + 1;
      const h = c.maxY - c.minY + 1;
      return c.pixels >= minPixels && (w >= minDimension || h >= minDimension) && area(c) < imageArea * 0.8;
    })
    .map(({ pixels: _pixels, ...r }) => r);

  candidates.sort((a, b) => area(b) - area(a));
  const filtered: RegionRaw[] = [];
  for (const candidate of candidates) {
    if (filtered.some((existing) => contains(existing, candidate))) continue;
    filtered.push(candidate);
  }
  return filtered;
}

function splitLargeRegion(region: RegionRaw, mask: Uint8Array, width: number, height: number) {
  const imageArea = width * height;
  if (area(region) < imageArea * 0.2 || Math.max(region.maxX - region.minX, region.maxY - region.minY) < 160) return [region];

  const rw = region.maxX - region.minX + 1;
  const rh = region.maxY - region.minY + 1;
  const columns = new Array(rw).fill(0) as number[];
  const rows = new Array(rh).fill(0) as number[];

  for (let y = region.minY; y <= region.maxY; y++) {
    for (let x = region.minX; x <= region.maxX; x++) {
      if (!mask[y * width + x]) continue;
      columns[x - region.minX]++;
      rows[y - region.minY]++;
    }
  }

  const findCuts = (values: number[], thresholdRatio: number) => {
    const threshold = Math.max(1, Math.floor(Math.max(...values) * thresholdRatio));
    const cuts: number[] = [];
    let runStart = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i] <= threshold) {
        if (runStart < 0) runStart = i;
      } else if (runStart >= 0) {
        if (i - runStart >= 2) cuts.push(runStart, i - 1);
        runStart = -1;
      }
    }
    if (runStart >= 0 && values.length - runStart >= 2) cuts.push(runStart, values.length - 1);
    return cuts;
  };

  const xCuts = findCuts(columns, 0.018);
  const yCuts = findCuts(rows, 0.018);
  if (!xCuts.length && !yCuts.length) return [region];

  const xSegments = [-1, ...xCuts, rw];
  const ySegments = [-1, ...yCuts, rh];
  const pieces: RegionRaw[] = [];

  for (let yi = 0; yi < ySegments.length - 1; yi += 2) {
    const y0 = ySegments[yi] + 1;
    const y1 = ySegments[yi + 1] - 1;
    if (y0 > y1) continue;
    for (let xi = 0; xi < xSegments.length - 1; xi += 2) {
      const x0 = xSegments[xi] + 1;
      const x1 = xSegments[xi + 1] - 1;
      if (x0 > x1) continue;
      const piece = { minX: region.minX + x0, minY: region.minY + y0, maxX: region.minX + x1, maxY: region.minY + y1 };
      if (area(piece) >= area(region) * 0.01) pieces.push(piece);
    }
  }
  return pieces.length >= 2 ? pieces : [region];
}

function mergeTinyFragments(regions: RegionRaw[], width: number, height: number) {
  const maxGap = Math.max(1, Math.round(Math.min(width, height) * 0.006));
  const result = [...regions];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const dx = Math.max(a.minX - b.maxX - 1, b.minX - a.maxX - 1, 0);
        const dy = Math.max(a.minY - b.maxY - 1, b.minY - a.maxY - 1, 0);
        const alignedX = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) + 1;
        const alignedY = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) + 1;
        if (Math.max(dx, dy) <= maxGap && (alignedX > Math.min(a.maxY - a.minY + 1, b.maxY - b.minY + 1) * 0.3 || alignedY > Math.min(a.maxX - a.minX + 1, b.maxX - b.minX + 1) * 0.3)) {
          result[i] = { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
          result.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return result;
}

export function detectRegionsFromImageData(data: Uint8ClampedArray, width: number, height: number): WorkerRegion[] {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return [];

  const rawMask = buildForegroundMask(data, width, height);
  const radius = Math.min(2, Math.max(0, Math.floor(Math.min(width, height) / 1400)));
  const mask = dilateMask(rawMask, width, height, radius);
  const components = connectedComponents(mask, width, height);
  let regions = normalizeComponents(components, width, height);
  regions = regions.flatMap((region) => splitLargeRegion(region, mask, width, height));
  regions = mergeTinyFragments(regions, width, height);

  const imageArea = width * height;
  const unique: RegionRaw[] = [];
  for (const candidate of regions.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX))) {
    if (area(candidate) < imageArea * 0.00005 || area(candidate) > imageArea * 0.94) continue;
    const duplicate = unique.some((existing) => intersectionArea(existing, candidate) / Math.min(area(existing), area(candidate)) > 0.84);
    if (!duplicate) unique.push(candidate);
  }

  return unique.slice(0, 48).map((r, i) => ({
    id: `region-${i + 1}`,
    ...r,
  }));
}

self.onmessage = (e: MessageEvent<{ imageData: ImageData; width: number; height: number }>) => {
  const { imageData, width, height } = e.data;
  try {
    const regions = detectRegionsFromImageData(imageData.data, width, height);
    self.postMessage({ regions, error: null });
  } catch (err) {
    self.postMessage({ regions: [], error: err instanceof Error ? err.message : String(err) });
  }
};
