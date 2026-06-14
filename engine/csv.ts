// Minimal, correct CSV parser. The transactional files contain quoted fields
// with embedded commas (e.g. accessorial detail "Liftgate, Inside Delivery"
// and Denise's notes). We keep this dependency-free so the core path has no
// external runtime calls.

/** Tokenize CSV text into rows of string cells. Handles quotes, escaped
 *  quotes (""), embedded commas/newlines, CRLF, and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      // handle CRLF and lone CR
      pushRow();
      if (text[i + 1] === "\n") i++;
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // flush trailing field/row if any content remains
  if (field.length > 0 || row.length > 0) pushRow();

  // drop fully-empty trailing rows (e.g. file ends with newline)
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Parse CSV with a header row into objects keyed by trimmed header names. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (cells[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}
