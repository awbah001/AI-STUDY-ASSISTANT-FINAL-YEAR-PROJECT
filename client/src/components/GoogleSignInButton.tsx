import { useEffect, useRef } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: "popup" | "redirect";
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with";
      shape?: "rectangular" | "pill";
      width?: number;
      logo_alignment?: "left" | "center";
    }
  ) => void;
};

function getGoogleAccountsId(): GoogleAccountsId | undefined {
  const gsi = (window as unknown as { google?: { accounts?: { id?: GoogleAccountsId } } }).google;
  return gsi?.accounts?.id;
}

function loadGsiScript() {
  if (getGoogleAccountsId()) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In")), { once: true });
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function GoogleSignInButton({
  onCredential,
  pending = false,
  label = "Continue with Google",
}: {
  onCredential: (idToken: string) => void;
  pending?: boolean;
  label?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || pending) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const accountsId = getGoogleAccountsId();
        if (!accountsId) return;
        hostRef.current.innerHTML = "";
        accountsId.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential);
          },
          ux_mode: "popup",
        });
        const width = Math.max(280, hostRef.current.offsetWidth || 360);
        accountsId.renderButton(hostRef.current, {
          theme: "outline",
          size: "medium",
          text: "continue_with",
          shape: "rectangular",
          width,
          logo_alignment: "left",
        });
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, pending]);

  return (
    <div className={`cognify-google ${pending ? "is-pending" : ""} ${clientId ? "" : "is-disabled"}`}>
      <div className="cognify-google-face" aria-hidden={Boolean(clientId)}>
        {pending ? (
          <span className="cognify-google-spinner" />
        ) : (
          <GoogleMark className="cognify-google-mark" />
        )}
        <span>{pending ? "Signing in with Google…" : label}</span>
      </div>
      {clientId && !pending ? (
        <div ref={hostRef} className="cognify-google-hit" aria-label="Continue with Google" />
      ) : null}
    </div>
  );
}
