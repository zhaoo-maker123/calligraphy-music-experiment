import { buildCsv } from "./csv-exporter.js";
import { createStrokeImageId } from "./stroke-image-store.js";

const encoder = new TextEncoder();

function createCrcTable() {
  return Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    return crc >>> 0;
  });
}

const CRC_TABLE = createCrcTable();

export function crc32(bytes) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDate(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function record(length, write) {
  const buffer = new ArrayBuffer(length);
  write(new DataView(buffer));
  return new Uint8Array(buffer);
}

function joinBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

async function entryBytes(data) {
  if (typeof data === "string") return encoder.encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await data.arrayBuffer());
}

export async function buildZip(entries, modifiedAt = new Date()) {
  const localParts = [];
  const centralParts = [];
  const dos = zipDate(modifiedAt);
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name.replaceAll("\\", "/"));
    const data = await entryBytes(entry.data);
    const checksum = crc32(data);
    const localHeader = record(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, dos.time, true);
      view.setUint16(12, dos.date, true);
      view.setUint32(14, checksum, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      view.setUint16(28, 0, true);
    });
    localParts.push(localHeader, name, data);

    const centralHeader = record(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, dos.time, true);
      view.setUint16(14, dos.date, true);
      view.setUint32(16, checksum, true);
      view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true);
      view.setUint16(28, name.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, localOffset, true);
    });
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = joinBytes(centralParts);
  const endRecord = record(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralDirectory.length, true);
    view.setUint32(16, localOffset, true);
    view.setUint16(20, 0, true);
  });

  return new Blob([...localParts, centralDirectory, endRecord], { type: "application/zip" });
}

export function createStrokeArchivePath(image) {
  const section = String(image.sectionOrder).padStart(2, "0");
  const question = String(image.questionOrder).padStart(2, "0");
  const stroke = String(image.strokeNumber).padStart(3, "0");
  return `strokes/section-${section}/question-${question}/stroke-${stroke}.png`;
}

export function createZipFilename(session, now = new Date()) {
  const date = now.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortId = session.sessionId.split("-")[0];
  return `calligraphy_${date}_${shortId}_${session.status}.zip`;
}

export async function createExperimentZip(session, tasks, images, now = new Date()) {
  const imageById = new Map(images.map((image) => [image.id, image]));
  const orderedImages = [];

  tasks.forEach((task) => {
    if (task.kind !== "trace" && task.kind !== "audio-trace") return;
    const response = session.responses[task.id];
    response?.strokes.forEach((stroke) => {
      const id = createStrokeImageId(session.sessionId, task.id, stroke.strokeNumber);
      const image = imageById.get(id);
      if (!image) throw new Error(`Missing stroke image: ${task.id}/${stroke.strokeNumber}`);
      orderedImages.push(image);
    });
  });

  const csv = `\ufeff${buildCsv(session, tasks, now)}`;
  const entries = [
    { name: "responses.csv", data: csv },
    ...orderedImages.map((image) => ({
      name: createStrokeArchivePath(image),
      data: image.blob,
    })),
  ];
  return {
    blob: await buildZip(entries, now),
    filename: createZipFilename(session, now),
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
