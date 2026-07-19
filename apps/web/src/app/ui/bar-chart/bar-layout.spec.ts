import { computeBarLayout } from "./bar-layout";

const data = [
  { label: "Mon", value: 1800 },
  { label: "Tue", value: 2400 },
  { label: "Wed", value: 1200 },
];

// AC-5 (002-ui-foundation)
describe("computeBarLayout", () => {
  it("fits all bars inside the viewport", () => {
    const { bars } = computeBarLayout(data, 300, 100);

    expect(bars).toHaveLength(3);
    for (const bar of bars) {
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(300);
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y + bar.height).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it("makes heights proportional to values", () => {
    const { bars } = computeBarLayout(data, 300, 100);

    const [mon, tue, wed] = bars;
    expect(tue?.height).toBe(100);
    expect(mon?.height).toBeCloseTo((1800 / 2400) * 100);
    expect(wed?.height).toBeCloseTo((1200 / 2400) * 100);
  });

  it("returns zero-height bars when all values are zero", () => {
    const { bars } = computeBarLayout(
      [
        { label: "a", value: 0 },
        { label: "b", value: 0 },
      ],
      100,
      50,
    );

    for (const bar of bars) {
      expect(bar.height).toBe(0);
      expect(bar.y).toBe(50);
    }
  });

  it("clamps negative values to zero height", () => {
    const { bars } = computeBarLayout(
      [
        { label: "deficit", value: -300 },
        { label: "surplus", value: 600 },
      ],
      100,
      50,
    );

    expect(bars[0]?.height).toBe(0);
    expect(bars[1]?.height).toBe(50);
  });

  it("returns an empty layout for empty data", () => {
    expect(computeBarLayout([], 100, 50)).toEqual({ bars: [], targetY: null });
  });

  it("scales bars against the target when the target exceeds all values", () => {
    const { bars, targetY } = computeBarLayout([{ label: "Mon", value: 1000 }], 100, 100, 2000);

    expect(bars[0]?.height).toBe(50);
    expect(targetY).toBe(0);
  });

  it("positions the target line proportionally", () => {
    const { targetY } = computeBarLayout(data, 300, 100, 1200);

    expect(targetY).toBeCloseTo(100 - (1200 / 2400) * 100);
  });
});
