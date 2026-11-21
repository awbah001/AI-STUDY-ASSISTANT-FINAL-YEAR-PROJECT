import { useRef, useEffect } from "react";
import { getAuthToken } from "@/lib/authToken";
import { apiUrl } from "@/lib/apiBaseUrl";

/** The same reader is hosted inside the Expo WebView. Tokens never appear in its URL. */
export function DocumentLearningReader({
  documentId,
  title,
}: {
  documentId: number;
  title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const query = new URLSearchParams(window.location.search);
  const params = new URLSearchParams({ documentId: String(documentId) });
  if (/^\d+$/.test(query.get("page") ?? ""))
    params.set("page", query.get("page")!);
  if (/^[a-f0-9]{64}$/.test(query.get("revision") ?? ""))
    params.set("revision", query.get("revision")!);
  const src = apiUrl(`/learning-reader?${params}`);
  useEffect(() => {
    const navigate = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== new URL(src, window.location.origin).origin ||
        event.data?.type !== "cognify-reader-source"
      )
        return;
      const source = event.data.source;
      if (!Number.isSafeInteger(source?.documentId) || source.documentId < 1)
        return;
      const target = new URLSearchParams({ tab: "notes" });
      if (
        Number.isSafeInteger(source.page) &&
        source.page >= 1 &&
        source.page <= 2000 &&
        /^[a-f0-9]{64}$/.test(source.revision)
      ) {
        target.set("page", String(source.page));
        target.set("revision", source.revision);
      } else if (/^[a-f0-9]{24}$/.test(source.sourceId))
        target.set("source", source.sourceId);
      else return;
      window.location.assign(`/document/${source.documentId}?${target}`);
    };
    window.addEventListener("message", navigate);
    return () => window.removeEventListener("message", navigate);
  }, [src]);
  return (
    <iframe
      ref={frame}
      title={`${title} learning reader`}
      src={src}
      className="block h-full min-h-0 w-full rounded-xl border bg-white"
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          { type: "cognify-reader-auth", token: getAuthToken() },
          new URL(src, window.location.origin).origin
        )
      }
    />
  );
}
