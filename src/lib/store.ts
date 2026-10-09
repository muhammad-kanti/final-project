import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");

export function dataFile(fileName: string): string {
  return path.join(DATA_DIR, fileName);
}

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = dataFile(fileName);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch {
    await writeJson(fileName, fallback);
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    await writeJson(fileName, fallback);
    return fallback;
  }
}

export async function writeJson(fileName: string, value: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = dataFile(fileName);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmp, file);
}

const locks = new Map<string, Promise<unknown>>();

/**
 * Serializes read-modify-write cycles per file so concurrent requests cannot
 * clobber each other's changes.
 */
export function updateJson<T>(
  fileName: string,
  fallback: T,
  mutate: (store: T) => void | Promise<void>
): Promise<T> {
  const prev = locks.get(fileName) ?? Promise.resolve();
  const next = prev.then(
    async () => {
      const store = await readJson<T>(fileName, fallback);
      await mutate(store);
      await writeJson(fileName, store);
      return store;
    },
    async () => {
      const store = await readJson<T>(fileName, fallback);
      await mutate(store);
      await writeJson(fileName, store);
      return store;
    }
  );
  locks.set(
    fileName,
    next.catch(() => undefined)
  );
  return next;
}