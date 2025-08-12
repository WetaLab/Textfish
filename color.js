function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

function rgbToHex(r, g, b) {
  const toHex = c => ("0" + Math.round(c).toString(16)).slice(-2);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const ELO_COLOR_STOPS = [
  { elo: 100, hex: "#6c040d" },
  { elo: 300, hex: "#fa412d" },
  { elo: 500, hex: "#ff7769" },
  { elo: 700, hex: "#ffa459" },
  { elo: 900, hex: "#f7c631" },
  { elo: 1100, hex: "#95b776" },
  { elo: 1400, hex: "#81b64c" },
  { elo: 1600, hex: "#749bbf" },
  { elo: 1800, hex: "#26c2a3" },
  { elo: 2000, hex: "#e273e7" },
  { elo: 2200, hex: "#722f2c" }
].map(stop => ({ ...stop, color: hexToRgb(stop.hex) }));

export function getEloColor(elo) {
  const minElo = ELO_COLOR_STOPS[0].elo;
  const maxElo = ELO_COLOR_STOPS[ELO_COLOR_STOPS.length - 1].elo;
  const clampedElo = Math.max(minElo, Math.min(elo, maxElo));
  const endStopIndex = ELO_COLOR_STOPS.findIndex(s => s.elo >= clampedElo);

  if (endStopIndex === 0) return ELO_COLOR_STOPS[0].hex;

  const startStop = ELO_COLOR_STOPS[endStopIndex - 1];
  const endStop = ELO_COLOR_STOPS[endStopIndex];
  const eloRange = endStop.elo - startStop.elo;
  const progress = eloRange === 0 ? 1 : (clampedElo - startStop.elo) / eloRange;

  const r = startStop.color.r + (endStop.color.r - startStop.color.r) * progress;
  const g = startStop.color.g + (endStop.color.g - startStop.color.g) * progress;
  const b = startStop.color.b + (endStop.color.b - startStop.color.b) * progress;

  return rgbToHex(r, g, b);
}
