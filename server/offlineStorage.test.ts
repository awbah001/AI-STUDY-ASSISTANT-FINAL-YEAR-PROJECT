import { describe, expect, it } from "vitest";
import { OfflineStudyStorage } from "../shared/offlineStorage";
import { gradeOfflineQuiz, type OfflineStudyPack, type OfflineStudyEvent } from "../shared/offlineStudy";
const pack = (ownerId: number): OfflineStudyPack => ({ version: 1, ownerId, savedAt: 1, document: { id: 7, title: "Notes", fileName: "notes.docx" }, html: "Notes", cards: [], quizzes: [] });
const event = (eventId: string): OfflineStudyEvent => ({ eventId, documentId: 7, occurredAt: 1, minutes: 2, kind: "reading" });
function storage() {
  const data = new Map<string, string>();
  const driver = { read: async (key: string) => data.get(key) ?? null, write: async (key: string, value: string) => { data.set(key, value); } };
  return { store: new OfflineStudyStorage(driver), driver };
}
describe("offline storage and grading", () => {
  it("retains new sessions queued while older sessions are acknowledged", async () => {
    const { store } = storage();
    await store.save(3, pack(3));
    await store.enqueue(3, event("old-event"));
    await Promise.all([store.enqueue(3, event("new-event")), store.acknowledge(3, ["old-event"])]);
    expect((await store.read(3)).events.map(e => e.eventId)).toEqual(["new-event"]);
  });
  it("isolates downloads and progress by account", async () => {
    const { store } = storage();
    await store.save(3, pack(3));
    expect((await store.read(4)).packs).toHaveLength(0);
    await expect(store.save(4, pack(3))).rejects.toThrow("another account");
  });
  it("keeps queued progress when a download is removed", async () => {
    const { store } = storage();
    await store.save(3, pack(3)); await store.enqueue(3, event("pending-event"));
    await store.remove(3, 7);
    expect((await store.read(3)).packs).toHaveLength(0);
    expect((await store.read(3)).events).toHaveLength(1);
  });
  it("does not discard pending work when a storage write fails", async () => {
    const { store, driver } = storage();
    await store.save(3, pack(3)); await store.enqueue(3, event("pending-event"));
    driver.write = async () => { throw new Error("Disk full"); };
    await expect(store.acknowledge(3, ["pending-event"])).rejects.toThrow("Disk full");
    expect((await store.read(3)).events).toHaveLength(1);
  });
  it("scores unanswered and incorrect questions without accepting a supplied score", () => {
    const questions = [{ id: 1, question: "First?", options: ["A", "B"], correctAnswer: "A", explanation: null }, { id: 2, question: "Second?", options: ["C", "D"], correctAnswer: "C", explanation: null }];
    expect(gradeOfflineQuiz(questions, { "1": "A", "2": "D" })).toBe(50);
    expect(gradeOfflineQuiz(questions, {})).toBe(0);
  });
});
