import { useRef, useState, useEffect } from "react";
import { View, Text, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { API_URL, getToken } from "../../lib/api";
import { colors } from "../../theme/colors";
import { useRouter } from "expo-router";

export function DocumentLearningReader({
  documentId,
  page,
  revision,
}: {
  documentId: number;
  page?: string;
  revision?: string;
}) {
  const webview = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const query = new URLSearchParams({ documentId: String(documentId) });
  if (page && /^\d+$/.test(page)) query.set("page", page);
  if (revision && /^[a-f0-9]{64}$/.test(revision))
    query.set("revision", revision);
  const uri = `${API_URL.replace(/\/$/, "")}/learning-reader?${query}`;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const navigate = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== new URL(uri).origin ||
        event.data?.type !== "cognify-reader-source"
      )
        return;
      const source = event.data.source;
      if (!Number.isSafeInteger(source?.documentId) || source.documentId < 1)
        return;
      const params: Record<string, string> = {
        id: String(source.documentId),
        tab: "notes",
      };
      if (
        Number.isSafeInteger(source.page) &&
        source.page >= 1 &&
        source.page <= 2000 &&
        /^[a-f0-9]{64}$/.test(source.revision)
      ) {
        params.page = String(source.page);
        params.revision = source.revision;
      } else if (/^[a-f0-9]{24}$/.test(source.sourceId))
        params.source = source.sourceId;
      else return;
      router.push({ pathname: "/document/[id]", params });
    };
    window.addEventListener("message", navigate);
    return () => window.removeEventListener("message", navigate);
  }, [router, uri]);
  if (Platform.OS === "web")
    return (
      <iframe
        ref={frame}
        title="Document learning reader"
        src={uri}
        style={{ flex: 1, width: "100%", border: 0 }}
        onLoad={async event => {
          const frame = event.currentTarget;
          const token = await getToken();
          if (mounted.current)
            frame.contentWindow?.postMessage(
              { type: "cognify-reader-auth", token },
              new URL(uri).origin
            );
        }}
      />
    );
  if (error)
    return (
      <View style={{ padding: 24 }}>
        <Text style={{ color: colors.text }}>{error}</Text>
      </View>
    );
  return (
    <WebView
      ref={webview}
      source={{ uri }}
      style={{ flex: 1 }}
      javaScriptEnabled
      domStorageEnabled={false}
      mixedContentMode="never"
      allowFileAccess={false}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request =>
        request.url === uri || request.url === "about:blank"
      }
      onError={() =>
        setError(
          "The reader could not connect. Check your connection and reopen this document."
        )
      }
      onMessage={async event => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === "cognify-reader-source") {
            const source = message.source;
            if (
              !Number.isSafeInteger(source?.documentId) ||
              source.documentId < 1
            )
              return;
            if (
              Number.isSafeInteger(source.page) &&
              source.page >= 1 &&
              source.page <= 2000 &&
              /^[a-f0-9]{64}$/.test(source.revision)
            )
              router.push({
                pathname: "/document/[id]",
                params: {
                  id: String(source.documentId),
                  tab: "notes",
                  page: String(source.page),
                  revision: source.revision,
                },
              });
            else if (/^[a-f0-9]{24}$/.test(source.sourceId))
              router.push({
                pathname: "/document/[id]",
                params: {
                  id: String(source.documentId),
                  tab: "notes",
                  source: source.sourceId,
                },
              });
            return;
          }
          if (message.type !== "cognify-reader-ready") return;
          const token = await getToken();
          if (!mounted.current) return;
          if (!token) {
            setError("Sign in again to use the document reader.");
            return;
          }
          webview.current?.injectJavaScript(
            `window.dispatchEvent(new CustomEvent('cognify-reader-auth',{detail:${JSON.stringify(token)}}));true;`
          );
        } catch {
          if (mounted.current)
            setError("The reader could not start. Reopen this document.");
        }
      }}
    />
  );
}
