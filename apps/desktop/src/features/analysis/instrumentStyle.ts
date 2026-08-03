const instrumentColors = [
  "#d8f53d",
  "#f06c48",
  "#a873e8",
  "#4ac69a",
  "#4a9fe0",
  "#e1b85b",
  "#ef79ad",
  "#72c7d4",
];

export function getInstrumentColor(name: string) {
  const hash = [...name].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0);
  return instrumentColors[hash % instrumentColors.length];
}

export function formatActiveDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
