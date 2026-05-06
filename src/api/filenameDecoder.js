const PATTERN = /^(U\d+)-(\d{10})-([0-9A-Za-z]{8})-([AD])-([0-9a-f]{4})\.enc$/;

export function parseFilename(filename) {
  const m = PATTERN.exec(filename);
  if (!m) return null;
  const ts = m[2];
  const year = 2000 + parseInt(ts.slice(0, 2), 10);
  const month = parseInt(ts.slice(2, 4), 10) - 1;
  const day = parseInt(ts.slice(4, 6), 10);
  const hour = parseInt(ts.slice(6, 8), 10);
  const min = parseInt(ts.slice(8, 10), 10);
  return {
    userId: m[1],
    timestamp: new Date(Date.UTC(year, month, day, hour, min)),
    pathId: m[3],
    flag: m[4],
    shortHash: m[5],
    raw: filename,
  };
}

export function parseAll(filenames) {
  return filenames
    .map(parseFilename)
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}
