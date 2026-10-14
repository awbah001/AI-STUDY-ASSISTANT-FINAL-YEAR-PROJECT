import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import * as queries from "./queries";
import { canAccessDocument } from "./documentAccess";
import { findDocumentSource } from "./documentSources";
import { syncOfflineStudyEvent } from "./offlineStudy";

vi.mock("./queries", async importOriginal => ({ ...await importOriginal<typeof import("./queries")>(), getDocumentById: vi.fn() }));
vi.mock("./documentAccess", () => ({ canAccessDocument: vi.fn() }));
vi.mock("./documentSources", () => ({ findDocumentSource: vi.fn() }));
vi.mock("./offlineStudy", () => ({ syncOfflineStudyEvent: vi.fn(), buildOfflineStudyPack: vi.fn() }));
function caller() {
  return appRouter.createCaller({ user: { id: 3, role: "user", isBanned: false } as TrpcContext["user"], req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(queries.getDocumentById).mockResolvedValue({ id: 7, userId: 4 } as Awaited<ReturnType<typeof queries.getDocumentById>>);
  vi.mocked(canAccessDocument).mockResolvedValue(true);
});
describe("study route authorization", () => {
  it("does not reveal source excerpts without document access", async () => {
    vi.mocked(canAccessDocument).mockResolvedValue(false);
    await expect(caller().documents.source({ id: 7, source: "0123456789abcdef01234567" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(findDocumentSource).not.toHaveBeenCalled();
  });
  it("resolves authorized references and reports removed excerpts", async () => {
    vi.mocked(findDocumentSource).mockResolvedValueOnce("Verified excerpt").mockResolvedValueOnce(null);
    expect(await caller().documents.source({ id: 7, source: "0123456789abcdef01234567" })).toMatchObject({ excerpt: "Verified excerpt" });
    await expect(caller().documents.source({ id: 7, source: "0123456789abcdef01234567" })).rejects.toThrow("no longer available");
  });
  it("prevents an enrolled reader from reprocessing another owner's document", async () => {
    await expect(caller().documents.retryProcessing({ id: 7 })).rejects.toThrow("Only the document owner");
  });
  it("does not sync a different account's offline queue", async () => {
    const event = { eventId: "offline-event", documentId: 7, occurredAt: 1, minutes: 1, kind: "reading" as const };
    await expect(caller().offlineStudy.sync({ ownerId: 4, events: [event] })).rejects.toThrow("account that downloaded");
    expect(syncOfflineStudyEvent).not.toHaveBeenCalled();
  });
  it("acknowledges only events that committed successfully", async () => {
    const event = { eventId: "offline-event", documentId: 7, occurredAt: 1, minutes: 1, kind: "reading" as const };
    vi.mocked(syncOfflineStudyEvent).mockResolvedValueOnce().mockRejectedValueOnce(new Error("Access removed"));
    const result = await caller().offlineStudy.sync({ ownerId: 3, events: [event, { ...event, eventId: "rejected-event" }] });
    expect(result.accepted).toEqual(["offline-event"]);
    expect(result.rejected).toEqual([{ eventId: "rejected-event", message: "Access removed" }]);
  });
});
