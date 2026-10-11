import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Headphones, Pause, Play, RefreshCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/apiBaseUrl";
import { trpc } from "@/lib/trpc";
import { formatBytesShort, formatDuration } from "@shared/studentFeatures";

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

function fileHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : apiUrl(url);
}

/** Device voice fallback when the server could not produce an audio file. */
function useDeviceSpeech(script: string | undefined, rate: number) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);
  const play = () => {
    if (!supported || !script) return;
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = rate;
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    synth.speak(utterance);
    setState("playing");
  };
  const pause = () => {
    window.speechSynthesis.pause();
    setState("paused");
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setState("idle");
  };
  return { supported, state, play, pause, stop };
}

export function AudioRecap({ documentId }: { documentId: number }) {
  const utils = trpc.useUtils();
  const query = trpc.audioRecap.get.useQuery({ documentId });
  const generate = trpc.audioRecap.generate.useMutation({
    onSuccess: () => {
      void query.refetch();
      void utils.summary.get.invalidate({ documentId });
    },
    onError: (error) => toast.error(error.message),
  });
  const [speed, setSpeed] = useState<number>(1);
  const [showScript, setShowScript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recap = query.data?.recap;
  const speech = useDeviceSpeech(recap?.script, speed);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, recap?.audioUrl]);

  const busy = generate.isPending || !!query.data?.generating;

  return (
    <section className="student-panel space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="student-panel-title">
            <span className="student-icon">
              <Headphones />
            </span>
            Audio recap
          </h3>
          <p className="student-muted text-sm">
            A short spoken revision of this document, for the bus, the gym or a walk.
          </p>
        </div>
        {recap && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => generate.mutate({ documentId })}>
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> {recap.stale ? "Update recap" : "Remake"}
          </Button>
        )}
      </div>

      {query.isLoading && <p role="status" className="text-muted-foreground">Loading...</p>}

      {query.data && !recap && (
        <Button disabled={busy} onClick={() => generate.mutate({ documentId })}>
          <Headphones className="size-4" />
          {busy
            ? "Recording your recap (up to a minute)..."
            : query.data.hasSummary
              ? "Create audio recap"
              : "Summarise and create audio recap"}
        </Button>
      )}

      {recap && (
        <div className="space-y-3">
          {recap.stale && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              The summary changed after this recap was made. Update it to hear the latest version.
            </p>
          )}
          {recap.audioUrl ? (
            <>
              <audio ref={audioRef} controls preload="metadata" className="w-full" src={fileHref(recap.audioUrl)}>
                Your browser can't play this audio.
              </audio>
              <p className="student-muted text-xs">
                {formatDuration(recap.durationSeconds)} · {formatBytesShort(recap.audioBytes)}
              </p>
            </>
          ) : speech.supported ? (
            <div className="flex flex-wrap items-center gap-2">
              {speech.state === "playing" ? (
                <Button onClick={speech.pause}>
                  <Pause className="size-4" /> Pause
                </Button>
              ) : (
                <Button onClick={speech.play}>
                  <Play className="size-4" /> {speech.state === "paused" ? "Resume" : "Listen"}
                </Button>
              )}
              {speech.state !== "idle" && (
                <Button variant="outline" onClick={speech.stop}>
                  <Square className="size-4" /> Stop
                </Button>
              )}
              <span className="student-muted text-xs">Read aloud by your device voice · about {formatDuration(recap.durationSeconds)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your browser can't read text aloud. Read the transcript below instead.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="student-tabs" role="radiogroup" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={speed === s}
                  className={speed === s ? "active" : ""}
                  onClick={() => {
                    setSpeed(s);
                    if (!recap.audioUrl && speech.state !== "idle") speech.stop();
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
            {recap.audioUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={fileHref(recap.audioUrl)} download>
                  <Download className="size-4" /> Download
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowScript((v) => !v)} aria-expanded={showScript}>
              {showScript ? "Hide transcript" : "Show transcript"}
            </Button>
          </div>
          {showScript && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-7">{recap.script}</p>}
        </div>
      )}
    </section>
  );
}
