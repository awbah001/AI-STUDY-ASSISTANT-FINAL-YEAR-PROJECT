import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { canAccessDocument } from "./documentAccess";
import * as documentAi from "./documentAiService";
import { generateVideoScript, type VideoScene } from "./llmUtils";
import * as queries from "./queries";
import type { GeneratedVideo } from "../drizzle/schema";
import { getFeatureFlags } from "./settings";
import { resolveUploadPath } from "./_core/uploads";
import { synthesizeSpeech, joinWavClips, ttsConfig } from "./tts";

const inFlight = new Map<string, Promise<GeneratedVideo>>();

type SceneManifestEntry = {
  index: number;
  imageUrl: string;
  startSeconds: number;
  durationSeconds: number;
  title: string;
  narration: string;
};

async function assertAccess(userId: number, documentId: number) {
  const doc = await queries.getDocumentById(documentId);
  if (!doc || !(await canAccessDocument(userId, doc)))
    throw new TRPCError({ code: "NOT_FOUND" });
  return doc;
}

/** Word-wrap a string into lines that fit maxWidth using the current font. */
function wrapLines(ctx: { measureText: (s: string) => { width: number } }, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

/** Render one scene to a PNG buffer (1280x720, branded dark theme). */
async function renderSceneImage(scene: VideoScene, index: number, total: number): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const W = 1280;
  const H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1E3A5F");
  grad.addColorStop(1, "#16294A");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent bar + scene badge.
  ctx.fillStyle = "#4F8AC4";
  ctx.fillRect(0, 0, 8, H);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(W - 70, 64, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 26px Arial";
  const badge = `${index + 1}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge, W - 70, 64);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Title (wrapped, up to 3 lines).
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 50px Arial";
  const titleLines = wrapLines(ctx, scene.title, W - 260).slice(0, 3);
  let y = 110;
  for (const ln of titleLines) {
    ctx.fillText(ln, 70, y);
    y += 62;
  }

  // Divider.
  ctx.strokeStyle = "rgba(79,138,196,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, Math.max(y + 6, 250));
  ctx.lineTo(W - 70, Math.max(y + 6, 250));
  ctx.stroke();

  // Bullets (wrapped).
  ctx.fillStyle = "#D6E4F2";
  ctx.font = "34px Arial";
  let by = Math.max(y + 6, 250) + 60;
  for (const bullet of scene.bullets.slice(0, 6)) {
    if (by > H - 110) break;
    ctx.fillStyle = "#4F8AC4";
    ctx.fillText("•", 78, by);
    ctx.fillStyle = "#D6E4F2";
    const lines = wrapLines(ctx, bullet, W - 220);
    for (const ln of lines) {
      if (by > H - 110) break;
      ctx.fillText(ln, 108, by);
      by += 46;
    }
    by += 16;
  }

  // Footer.
  ctx.fillStyle = "#7A9BC2";
  ctx.font = "22px Arial";
  ctx.fillText(`Scene ${index + 1} of ${total}  ·  AI Learning Assistant`, 70, H - 40);

  return canvas.toBuffer("image/png");
}

/** Estimate a scene's display length (seconds) from the narration word count. */
function estimatedDuration(narration: string): number {
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.ceil(words / 2.2));
}

function buildPlayerHtml(manifest: SceneManifestEntry[], hasAudio: boolean, title: string): string {
  const m = JSON.stringify(manifest);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 16px; }
  h1 { font-size: 1.05rem; font-weight: 600; margin: 4px 0 12px; text-align: center; }
  .stage { position: relative; width: 100%; max-width: 960px; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .stage img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 14px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); font-size: 0.85rem; }
  .controls { display: flex; align-items: center; gap: 12px; margin-top: 14px; width: 100%; max-width: 960px; }
  button { background: #1E3A5F; color: #fff; border: 0; border-radius: 999px; width: 46px; height: 46px; font-size: 20px; cursor: pointer; display: grid; place-items: center; flex: 0 0 auto; }
  button:hover { background: #2a507d; }
  .bar { flex: 1; height: 8px; background: #1e293b; border-radius: 999px; overflow: hidden; }
  .bar > div { height: 100%; width: 0; background: #4F8AC4; transition: width 0.1s linear; }
  .time { font-variant-numeric: tabular-nums; font-size: 0.8rem; color: #94a3b8; flex: 0 0 auto; min-width: 84px; text-align: right; }
  .scenes { width: 100%; max-width: 960px; margin-top: 18px; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .thumb { cursor: pointer; border-radius: 8px; overflow: hidden; border: 2px solid transparent; background: #1e293b; }
  .thumb.active { border-color: #4F8AC4; }
  .thumb img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
  .note { margin-top: 16px; font-size: 0.78rem; color: #64748b; text-align: center; }
</style>
</head>
<body>
<h1>${title.replace(/</g, "&lt;")}</h1>
<div class="stage"><img id="slide" alt="scene" /><div class="caption" id="cap"></div></div>
<div class="controls">
  <button id="play" aria-label="Play/Pause">▶</button>
  <div class="bar"><div id="fill"></div></div>
  <div class="time" id="time">0:00 / 0:00</div>
  <button id="restart" aria-label="Restart">↺</button>
</div>
<div class="scenes" id="thumbs"></div>
<div class="note">Narrated study video generated from your material. Use Play to start.</div>
<script>
const SCENES = ${m};
const HAS_AUDIO = ${hasAudio ? "true" : "false"};
const slide = document.getElementById("slide");
const cap = document.getElementById("cap");
const fill = document.getElementById("fill");
const timeEl = document.getElementById("time");
const playBtn = document.getElementById("play");
const restartBtn = document.getElementById("restart");
const thumbs = document.getElementById("thumbs");
let total = SCENES.length ? SCENES[SCENES.length-1].startSeconds + SCENES[SCENES.length-1].durationSeconds : 0;
let playing = false;
let virtualT = 0;
let lastTs = 0;
let raf = 0;
const audio = HAS_AUDIO ? new Audio("narration.wav") : null;
function fmt(s){ s=Math.max(0,Math.floor(s)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
function sceneAt(t){ for(const sc of SCENES){ if(t>=sc.startSeconds && t<sc.startSeconds+sc.durationSeconds) return sc; } return SCENES[SCENES.length-1]; }
function render(t){
  const sc = sceneAt(t);
  if(sc){ slide.src = sc.imageUrl; cap.textContent = sc.title; }
  fill.style.width = total ? Math.min(100,(t/total)*100)+"%" : "0%";
  timeEl.textContent = fmt(t)+" / "+fmt(total);
  [...thumbs.children].forEach((el,i)=>el.classList.toggle("active", SCENES[i]===sc));
}
function tick(ts){
  if(!playing) return;
  if(!lastTs) lastTs = ts;
  const dt = (ts - lastTs)/1000; lastTs = ts;
  if(HAS_AUDIO){ virtualT = audio.currentTime; }
  else { virtualT += dt; if(virtualT >= total){ virtualT = total; stop(); } }
  render(virtualT);
  if(playing) raf = requestAnimationFrame(tick);
}
function play(){
  if(total<=0) return;
  playing = true; lastTs = 0;
  playBtn.textContent = "❚❚";
  if(HAS_AUDIO){ audio.play().catch(()=>{}); }
  raf = requestAnimationFrame(tick);
}
function stop(){ playing=false; playBtn.textContent="▶"; if(raf) cancelAnimationFrame(raf); if(HAS_AUDIO) audio.pause(); raf=0; }
function toggle(){ playing ? stop() : play(); }
playBtn.addEventListener("click", toggle);
restartBtn.addEventListener("click", ()=>{ if(HAS_AUDIO) audio.currentTime=0; virtualT=0; lastTs=0; render(0); if(!playing) play(); });
if(HAS_AUDIO){ audio.addEventListener("ended", ()=>{ stop(); }); audio.addEventListener("timeupdate", ()=>{ if(playing){ render(audio.currentTime); } }); }
SCENES.forEach((sc,i)=>{
  const d=document.createElement("div"); d.className="thumb"; d.innerHTML='<img src="'+sc.imageUrl+'" alt="scene '+(i+1)+'">';
  d.addEventListener("click", ()=>{ if(HAS_AUDIO) audio.currentTime=sc.startSeconds+0.01; else { virtualT=sc.startSeconds; } render(HAS_AUDIO?sc.startSeconds:virtualT); });
  thumbs.appendChild(d);
});
render(0);
</script>
</body>
</html>`;
}

/** Remove a previously generated video folder before regenerating. */
function removeOldFolder(playerUrl: string | null | undefined) {
  if (!playerUrl?.startsWith("/uploads/")) return;
  try {
    const full = resolveUploadPath(playerUrl.replace("/uploads/", ""));
    fs.rmSync(path.dirname(full), { recursive: true, force: true });
  } catch {
    // Already gone.
  }
}

export async function getVideo(userId: number, documentId: number) {
  await assertAccess(userId, documentId);
  const row = await queries.getGeneratedVideo(userId, documentId);
  return {
    video: row ?? null,
    generating: inFlight.has(`${userId}:${documentId}`),
  };
}

async function buildVideo(userId: number, documentId: number, sceneCount: number, topic?: string) {
  const doc = await documentAi.ensureDocumentText(documentId);
  documentAi.assertDocumentHasExtractedText(doc);
  const script = await generateVideoScript(
    documentId,
    doc.extractedText || "",
    doc.title,
    sceneCount,
    topic
  );

  const folder = `video/${userId}/${documentId}-${Date.now()}`;
  const folderPath = resolveUploadPath(folder);
  fs.mkdirSync(folderPath, { recursive: true });

  // Render scene images.
  const imageUrls: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const png = await renderSceneImage(script.scenes[i], i, script.scenes.length);
    const name = `scene-${i + 1}.png`;
    await fs.promises.writeFile(path.join(folderPath, name), png);
    imageUrls.push(name);
  }

  // Narration: synthesize each scene, then join into one track.
  const ttsOn = ttsConfig().enabled;
  let audioUrl: string | null = null;
  let audioBytes: number | null = null;
  let voice: string | null = null;
  let totalDuration = 0;
  const durations: number[] = [];
  let hasAudio = false;

  if (ttsOn) {
    try {
      const clips: Buffer[] = [];
      for (let i = 0; i < script.scenes.length; i++) {
        const speech = await synthesizeSpeech(script.scenes[i].narration);
        clips.push(speech.wav);
        durations.push(speech.durationSeconds);
        voice = speech.voice;
      }
      const { wav, durationSeconds } = joinWavClips(clips);
      await fs.promises.writeFile(path.join(folderPath, "narration.wav"), wav);
      audioUrl = `${folder}/narration.wav`;
      audioBytes = wav.length;
      totalDuration = durationSeconds;
      hasAudio = true;
    } catch (error) {
      console.warn(`[video] TTS narration failed for document ${documentId}; building a silent slideshow.`, error);
    }
  }

  // Graceful fallback: no audio — give each scene an estimated display duration.
  if (!hasAudio) {
    for (let i = 0; i < script.scenes.length; i++) {
      const d = estimatedDuration(script.scenes[i].narration);
      durations.push(d);
      totalDuration += d;
    }
  }

  // Build the per-scene manifest with cumulative start times (incl. 220ms join pauses when audio present).
  const PAUSE = hasAudio ? 0.22 : 0;
  let acc = 0;
  const manifest: SceneManifestEntry[] = script.scenes.map((scene, i) => {
    const dur = durations[i];
    const entry: SceneManifestEntry = {
      index: i,
      imageUrl: imageUrls[i],
      startSeconds: Math.round(acc * 100) / 100,
      durationSeconds: dur,
      title: scene.title,
      narration: scene.narration,
    };
    acc += dur + PAUSE;
    return entry;
  });

  // Self-contained HTML player (relative asset URLs resolve against the folder).
  const html = buildPlayerHtml(manifest, hasAudio, script.title);
  await fs.promises.writeFile(path.join(folderPath, "player.html"), html);

  // Remove the previous video folder now that the new one is on disk.
  const existing = await queries.getGeneratedVideo(userId, documentId);
  if (existing) removeOldFolder(existing.playerUrl);

  return queries.replaceGeneratedVideo({
    userId,
    documentId,
    title: script.title,
    sceneCount: script.scenes.length,
    durationSeconds: totalDuration,
    playerUrl: `/uploads/${folder}/player.html`,
    audioUrl,
    audioBytes,
    voice,
    scenes: manifest,
  });
}

export async function generateVideo(
  userId: number,
  documentId: number,
  sceneCount: number,
  topic?: string
) {
  const doc = await assertAccess(userId, documentId);
  const flags = await getFeatureFlags();
  if (!flags.videoGeneration) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Video generation is turned off by an administrator.",
    });
  }
  const key = `${userId}:${documentId}`;
  let job = inFlight.get(key);
  if (!job) {
    job = buildVideo(userId, documentId, sceneCount, topic).finally(() =>
      inFlight.delete(key)
    );
    inFlight.set(key, job);
  }
  return job;
}
