import { acknowledgeOfflineEvents, type OfflineStudyEvent, type OfflineStudyPack } from "./offlineStudy";

type SavedStudy = { version: 1; packs: OfflineStudyPack[]; events: OfflineStudyEvent[] };
export interface OfflineStorageDriver { read(key: string): Promise<string | null>; write(key: string, value: string): Promise<void> }

/** Serializes read/modify/write operations, including downloads completed during a sync. */
export class OfflineStudyStorage {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private driver: OfflineStorageDriver) {}
  private run<T>(ownerId: number, action: (data: SavedStudy) => Promise<T>): Promise<T> {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) return Promise.reject(new Error("Sign in to use downloads."));
    const result = this.pending.catch(() => undefined).then(async () => {
      const raw = await this.driver.read(`offline-study-${ownerId}`);
      const data: SavedStudy = raw ? JSON.parse(raw) : { version: 1, packs: [], events: [] };
      if (data.version !== 1 || !Array.isArray(data.packs) || !Array.isArray(data.events) || data.packs.some(pack => pack.ownerId !== ownerId)) throw new Error("The saved study data cannot be read. Please download the material again.");
      return action(data);
    });
    this.pending = result;
    return result;
  }
  read(ownerId: number) { return this.run(ownerId, async data => data); }
  save(ownerId: number, pack: OfflineStudyPack) {
    return this.run(ownerId, async data => {
      if (pack.ownerId !== ownerId) throw new Error("This download belongs to another account.");
      data.packs = [...data.packs.filter(existing => existing.document.id !== pack.document.id), pack];
      await this.driver.write(`offline-study-${ownerId}`, JSON.stringify(data));
    });
  }
  remove(ownerId: number, documentId: number) {
    return this.run(ownerId, async data => {
      data.packs = data.packs.filter(pack => pack.document.id !== documentId);
      await this.driver.write(`offline-study-${ownerId}`, JSON.stringify(data));
    });
  }
  enqueue(ownerId: number, event: OfflineStudyEvent) {
    return this.run(ownerId, async data => {
      if (!data.packs.some(pack => pack.document.id === event.documentId)) throw new Error("Download this document before studying offline.");
      if (!data.events.some(existing => existing.eventId === event.eventId)) data.events.push(event);
      await this.driver.write(`offline-study-${ownerId}`, JSON.stringify(data));
    });
  }
  acknowledge(ownerId: number, accepted: string[]) {
    return this.run(ownerId, async data => {
      data.events = acknowledgeOfflineEvents(data.events, accepted);
      await this.driver.write(`offline-study-${ownerId}`, JSON.stringify(data));
    });
  }
}
