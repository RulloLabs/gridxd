import { describe, it, expect } from "vitest";
import { detectRegionsFromImageData } from "../workers/regionDetector.worker";

function image(width: number, height: number, background = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = background;
    data[i + 1] = background;
    data[i + 2] = background;
    data[i + 3] = 255;
  }
  return data;
}

function rect(data: Uint8ClampedArray, width: number, x0: number, y0: number, x1: number, y1: number, value = 40) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
}

describe("Region Detector", () => {
  it("detects one visible region without expanding it to the canvas", () => {
    const width = 100;
    const height = 100;
    const data = image(width, height);
    rect(data, width, 20, 25, 49, 54, 128);

    const regions = detectRegionsFromImageData(data, width, height);

    expect(regions).toHaveLength(1);
    expect(regions[0].minX).toBeLessThanOrEqual(20);
    expect(regions[0].minY).toBeLessThanOrEqual(25);
    expect(regions[0].maxX).toBeGreaterThanOrEqual(49);
    expect(regions[0].maxY).toBeGreaterThanOrEqual(54);
    expect(regions[0].maxX - regions[0].minX).toBeLessThan(60);
    expect(regions[0].maxY - regions[0].minY).toBeLessThan(60);
  });

  it("keeps separated icons as separate regions", () => {
    const width = 220;
    const height = 120;
    const data = image(width, height);
    rect(data, width, 20, 35, 49, 64, 30);
    rect(data, width, 90, 35, 119, 64, 60);
    rect(data, width, 160, 35, 189, 64, 90);

    const regions = detectRegionsFromImageData(data, width, height);

    expect(regions).toHaveLength(3);
    expect(regions.map((r) => r.minX)).toEqual([20, 90, 160]);
  });

  it("does not fabricate a grid on an empty image", () => {
    const data = image(200, 200, 255);
    expect(detectRegionsFromImageData(data, 200, 200)).toEqual([]);
  });
});
