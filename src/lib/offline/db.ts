"use client";

import type { QueuedScan, ScanManifest } from "@/modules/scan/types";

/**
 * IndexedDB for the gate. Three stores, no dependency:
 *
 * - `manifests` — one offline package per event (hashes only, no personal data).
 * - `queue`     — scans made while offline, waiting for the network.
 * - `admissions`— codes this device has already let in. Separate from `queue`
 *                 because the queue empties on sync, and the device must still
 *                 refuse the same code afterwards. This is the local "used" list.
 * - `meta`      — the device id, generated once and reused.
 */

const DB_NAME = "parkspot-scan";
const DB_VERSION = 1;

const STORE_MANIFESTS = "manifests";
const STORE_QUEUE = "queue";
const STORE_ADMISSIONS = "admissions";
const STORE_META = "meta";

export type LocalAdmission = {
  codeHash: string;
  eventId: string;
  scannedAt: string;
};

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let handle: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable — offline scanning cannot work here."));
  }

  handle ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_MANIFESTS)) {
        db.createObjectStore(STORE_MANIFESTS, { keyPath: "eventId" });
      }

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queue = db.createObjectStore(STORE_QUEUE, { keyPath: "id", autoIncrement: true });
        queue.createIndex("by-event", "eventId");
      }

      if (!db.objectStoreNames.contains(STORE_ADMISSIONS)) {
        const admissions = db.createObjectStore(STORE_ADMISSIONS, { keyPath: "codeHash" });
        admissions.createIndex("by-event", "eventId");
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return handle;
}

/* -------------------------------------------------------------------------- */
/* Manifests                                                                  */
/* -------------------------------------------------------------------------- */

export async function saveManifest(manifest: ScanManifest): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE_MANIFESTS, "readwrite");
  tx.objectStore(STORE_MANIFESTS).put(manifest);
  await done(tx);
}

export async function getManifest(eventId: string): Promise<ScanManifest | null> {
  const db = await open();
  const tx = db.transaction(STORE_MANIFESTS, "readonly");
  const result = await request<ScanManifest | undefined>(
    tx.objectStore(STORE_MANIFESTS).get(eventId) as IDBRequest<ScanManifest | undefined>,
  );
  return result ?? null;
}

export async function listManifests(): Promise<ScanManifest[]> {
  const db = await open();
  const tx = db.transaction(STORE_MANIFESTS, "readonly");
  const result = await request<ScanManifest[]>(
    tx.objectStore(STORE_MANIFESTS).getAll() as IDBRequest<ScanManifest[]>,
  );
  return result.sort((a, b) => Date.parse(a.eventStartsAt) - Date.parse(b.eventStartsAt));
}

/** Drops an event: its package, its local admissions, and anything still queued for it. */
export async function forgetEvent(eventId: string): Promise<void> {
  const db = await open();
  const tx = db.transaction([STORE_MANIFESTS, STORE_ADMISSIONS, STORE_QUEUE], "readwrite");

  tx.objectStore(STORE_MANIFESTS).delete(eventId);

  const admissions = tx.objectStore(STORE_ADMISSIONS).index("by-event").openCursor(IDBKeyRange.only(eventId));
  admissions.onsuccess = () => {
    const cursor = admissions.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };

  const queued = tx.objectStore(STORE_QUEUE).index("by-event").openCursor(IDBKeyRange.only(eventId));
  queued.onsuccess = () => {
    const cursor = queued.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };

  await done(tx);
}

/** Marks the code as used inside the stored package, so a reload still refuses it. */
export async function markManifestEntryUsed(eventId: string, codeHash: string): Promise<void> {
  const manifest = await getManifest(eventId);
  if (!manifest) return;

  const entry = manifest.entries.find((candidate) => candidate.codeHash === codeHash);
  if (!entry || entry.status === "USED") return;

  entry.status = "USED";
  await saveManifest(manifest);
}

/* -------------------------------------------------------------------------- */
/* Local admissions                                                           */
/* -------------------------------------------------------------------------- */

export async function recordAdmission(admission: LocalAdmission): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE_ADMISSIONS, "readwrite");
  // First admission wins locally too: a second put would rewrite the timestamp
  // the host is later shown as "wjechał o 19:42".
  const store = tx.objectStore(STORE_ADMISSIONS);
  const existing = await request<LocalAdmission | undefined>(
    store.get(admission.codeHash) as IDBRequest<LocalAdmission | undefined>,
  );
  if (!existing) store.put(admission);
  await done(tx);
}

export async function findAdmission(codeHash: string): Promise<LocalAdmission | null> {
  const db = await open();
  const tx = db.transaction(STORE_ADMISSIONS, "readonly");
  const result = await request<LocalAdmission | undefined>(
    tx.objectStore(STORE_ADMISSIONS).get(codeHash) as IDBRequest<LocalAdmission | undefined>,
  );
  return result ?? null;
}

/* -------------------------------------------------------------------------- */
/* Sync queue                                                                 */
/* -------------------------------------------------------------------------- */

export async function enqueueScan(scan: QueuedScan): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  // `id` is assigned by the store; passing one in would overwrite a queued scan.
  const payload: Omit<QueuedScan, "id"> = {
    eventId: scan.eventId,
    parkingId: scan.parkingId,
    codeHash: scan.codeHash,
    scannedAt: scan.scannedAt,
    result: scan.result,
    reason: scan.reason,
    source: scan.source,
    deviceId: scan.deviceId,
  };
  tx.objectStore(STORE_QUEUE).add(payload);
  await done(tx);
}

export async function pendingScans(limit = 200): Promise<QueuedScan[]> {
  const db = await open();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  const all = await request<QueuedScan[]>(
    tx.objectStore(STORE_QUEUE).getAll(undefined, limit) as IDBRequest<QueuedScan[]>,
  );
  return all;
}

export async function pendingCount(): Promise<number> {
  const db = await open();
  const tx = db.transaction(STORE_QUEUE, "readonly");
  return request<number>(tx.objectStore(STORE_QUEUE).count());
}

/** Called only after the server has acknowledged the batch. */
export async function dropScans(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await open();
  const tx = db.transaction(STORE_QUEUE, "readwrite");
  const store = tx.objectStore(STORE_QUEUE);
  for (const id of ids) store.delete(id);
  await done(tx);
}

/* -------------------------------------------------------------------------- */
/* Device identity                                                            */
/* -------------------------------------------------------------------------- */

export async function getDeviceId(): Promise<string> {
  const db = await open();

  const readTx = db.transaction(STORE_META, "readonly");
  const existing = await request<{ key: string; value: string } | undefined>(
    readTx.objectStore(STORE_META).get("deviceId") as IDBRequest<
      { key: string; value: string } | undefined
    >,
  );
  if (existing?.value) return existing.value;

  const value = crypto.randomUUID();
  const writeTx = db.transaction(STORE_META, "readwrite");
  writeTx.objectStore(STORE_META).put({ key: "deviceId", value });
  await done(writeTx);
  return value;
}
