import { accessibleFileUrl, openFileUrl } from "@/lib/privateFiles";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { getAuthToken } from "@/lib/authToken";
import { apiUrl } from "@/lib/apiBaseUrl";
import "./index.css";
import "./admin.css";
import "./lecturer.css";
import "./student.css";
import "./student-course.css";
import "./secondary-accents.css";
import "./motion.css";
import "./premium.css";
import "./professional.css";
import "./buttons.css";
import "./cards.css";
import "./forms.css";
import "./loading.css";
import "./dashboard-overview.css";
import "./workspace-components.css";
import { MotionConfig } from "framer-motion";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 4_000), refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: apiUrl("/api/trpc"),
      transformer: superjson,
      fetch(input, init) {
        const token = getAuthToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user"><App /></MotionConfig>
    </QueryClientProvider>
  </trpc.Provider>
);

// File links need bearer authorization even when opened in a new browser tab.
document.addEventListener("click", event => {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const url = new URL(anchor.href);
  const base = new URL(apiUrl("/"), window.location.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith("/uploads/") || url.searchParams.has("ticket")) return;
  event.preventDefault();
  if (anchor.hasAttribute("download")) {
    void accessibleFileUrl(anchor.href).then(url => {
      const link = document.createElement("a"); link.href = url; link.download = anchor.download;
      // Direct click avoids re-entering this delegated handler.
      link.addEventListener("click", e => e.stopPropagation()); link.click();
    }).catch(error => toast.error(error.message));
  } else void openFileUrl(anchor.href).catch(error => toast.error(error.message));
}, true);
