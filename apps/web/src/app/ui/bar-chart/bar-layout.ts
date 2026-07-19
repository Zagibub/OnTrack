export interface BarDatum {
  label: string;
  value: number;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: number;
}

export interface BarLayout {
  bars: BarRect[];
  /** y coordinate for a horizontal target line, or null if no target given */
  targetY: number | null;
}

const GAP_RATIO = 0.25;

/**
 * Lays out vertical bars in a width×height viewport. Bar heights are proportional
 * to values relative to max(values, target). Negative values clamp to zero height.
 */
export function computeBarLayout(
  data: BarDatum[],
  width: number,
  height: number,
  target: number | null = null,
): BarLayout {
  if (data.length === 0) {
    return { bars: [], targetY: null };
  }

  const max = Math.max(...data.map((d) => d.value), target ?? 0);
  const slot = width / data.length;
  const barWidth = slot * (1 - GAP_RATIO);

  const scale = (value: number): number => {
    if (max <= 0) return 0;
    return (Math.max(value, 0) / max) * height;
  };

  const bars = data.map((d, i) => {
    const barHeight = scale(d.value);
    return {
      x: i * slot + (slot - barWidth) / 2,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
      label: d.label,
      value: d.value,
    };
  });

  const targetY = target !== null && max > 0 ? height - scale(target) : null;

  return { bars, targetY };
}
