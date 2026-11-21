import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
} from "/api/document-reader/assets/build/pdf.mjs";

GlobalWorkerOptions.workerSrc =
  "/api/document-reader/assets/build/pdf.worker.mjs";
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const documentId = Number(params.get("documentId"));
let token = "",
  pdf,
  info,
  page = Math.max(1, Number(params.get("page")) || 1),
  scale = 1;
let fitMode = "width";
let selection,
  annotations = [],
  busy = false,
  rendering = false,
  snipping = false,
  lastSource;
let renderTask,
  layer,
  textLayerTask,
  renderGeneration = 0,
  searching = false;
let active = false;
const state = (message, error = false) => {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
};
// Request IDs are deduplication keys, not credentials. The fallback supports LAN HTTP WebViews.
const id = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
const errorText = error =>
  error instanceof Error ? error.message : "The action failed. Try again.";

async function api(
  method,
  input,
  mutation = false,
  namespace = "documentReader"
) {
  if (!token) throw new Error("Sign in again to use the document reader.");
  const url = "/api/trpc/" + namespace + "." + method;
  const response = await fetch(
    mutation
      ? url
      : url + "?input=" + encodeURIComponent(JSON.stringify({ json: input })),
    {
      method: mutation ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(mutation ? { "Content-Type": "application/json" } : {}),
      },
      ...(mutation ? { body: JSON.stringify({ json: input }) } : {}),
    }
  );
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error(
      data.error?.json?.message || data.error?.message || "The request failed."
    );
  return data.result.data.json;
}

function showPanel() {
  if ($("panel").hidden) $("panel").scrollTop = 0;
  $("panel").hidden = false;
}
function showLearningControls() {
  $("learningControls").hidden = false;
  $("saved").hidden = true;
  $("panelHeading").textContent = "Learn from this page";
  $("showSaved").setAttribute("aria-expanded", "false");
}
function selectedHighlight() {
  if (!selection) return;
  const compact = text => text.normalize("NFKC").replace(/[\s\u200b\u00ad]+/g, "");
  const selectedRects = selection.region ? [selection.region] : selection.rects;
  return annotations.find(record => record.kind === "highlight" && record.page === selection.page &&
    (selection.region || compact(record.excerpt) === compact(selection.text)) &&
    record.rects.some(a => selectedRects.some(b => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)));
}
function updateHighlightActions() {
  const record = selectedHighlight();
  $("removeHighlight").hidden = !record;
}
async function removeSavedAnnotation(record, button) {
  if (busy) return;
  busy = true;
  button.disabled = true;
  try {
    await api("remove", { id: record.id }, true);
    annotations = annotations.filter(item => item.id !== record.id);
    paintHighlights();
    updateHighlightActions();
    await refreshSaved();
    state(record.kind === "highlight" ? "Highlight removed." : "Saved item deleted.");
  } catch (error) {
    state(errorText(error), true);
  } finally {
    busy = false;
    button.disabled = false;
  }
}
function setSelection(next) {
  selection = next;
  showLearningControls();
  updateHighlightActions();
  $("selectionText").textContent = next.region
    ? "Selected page region. OCR will attempt to recognize its text."
    : next.text;
  $("sourceLabel").textContent = `${info.title} · Page ${next.page}`;
  $("visualNotice").hidden = !next.region;
  $("response").textContent = "";
  $("responseSources").replaceChildren();
  $("returnSource").hidden = true;
  showPanel();
}
function normalizedRect(rect, bounds) {
  const x = Math.max(0, Math.min(1, (rect.left - bounds.left) / bounds.width));
  const y = Math.max(0, Math.min(1, (rect.top - bounds.top) / bounds.height));
  return {
    x,
    y,
    width: Math.min(1 - x, rect.width / bounds.width),
    height: Math.min(1 - y, rect.height / bounds.height),
  };
}
function paintRects(container, rects, className) {
  container.replaceChildren();
  for (const r of rects) {
    const mark = document.createElement("div");
    mark.className = className;
    Object.assign(mark.style, {
      left: r.x * 100 + "%",
      top: r.y * 100 + "%",
      width: r.width * 100 + "%",
      height: r.height * 100 + "%",
    });
    container.append(mark);
  }
}
function paintHighlights() {
  paintRects(
    $("highlights"),
    annotations
      .filter(a => a.page === page && a.kind === "highlight")
      .flatMap(a => a.rects),
    "highlightRect"
  );
}
function snipMode(value) {
  snipping = value;
  $("snipLayer").classList.toggle("active", value);
  $("snip").setAttribute("aria-pressed", String(value));
  state(
    value
      ? "Drag over a region. OCR extracts text only; it does not interpret diagrams."
      : "Select text to explain, highlight or create revision resources."
  );
}

async function renderPage() {
  const generation = ++renderGeneration;
  rendering = true;
  document.querySelector(".reader").dataset.ready = "false";
  const previousTasks = [renderTask?.promise, textLayerTask].filter(Boolean);
  renderTask?.cancel();
  layer?.cancel();
  await Promise.allSettled(previousTasks);
  if (generation !== renderGeneration) return;
  state("Rendering page…");
  $("textLayer").replaceChildren();
  $("snipLayer").replaceChildren();
  snipMode(false);
  try {
    const current = await pdf.getPage(page);
    if (generation !== renderGeneration) return;
    const original = current.getViewport({ scale: 1 });
    const viewportStyle = getComputedStyle($("viewport"));
    const available = Math.max(1, $("viewport").clientWidth - 2 -
      parseFloat(viewportStyle.paddingLeft) - parseFloat(viewportStyle.paddingRight));
    const availableHeight = Math.max(1, $("viewport").clientHeight -
      parseFloat(viewportStyle.paddingTop) - parseFloat(viewportStyle.paddingBottom));
    const fitted = (fitMode === "page"
      ? Math.min(available / original.width, availableHeight / original.height)
      : available / original.width) * scale;
    const viewport = current.getViewport({ scale: fitted });
    const canvas = $("pdfCanvas"),
      outputScale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    $("sheet").style.width = viewport.width + "px";
    $("sheet").style.height = viewport.height + "px";
    $("sheet").style.setProperty("--scale-factor", String(fitted));
    $("sheet").style.setProperty("--total-scale-factor", String(fitted));
    renderTask = current.render({
      canvas,
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: [outputScale, 0, 0, outputScale, 0, 0],
    });
    await renderTask.promise;
    if (generation !== renderGeneration) return;
    const textContent = await current.getTextContent();
    if (generation !== renderGeneration) return;
    layer = new TextLayer({
      textContentSource: textContent,
      container: $("textLayer"),
      viewport,
    });
    textLayerTask = layer.render();
    await textLayerTask;
    if (generation !== renderGeneration) return;
    $("page").value = page;
    $("pages").textContent = `of ${pdf.numPages}`;
    $("page").max = pdf.numPages;
    $("previous").disabled = page <= 1;
    $("next").disabled = page >= pdf.numPages;
    $("zoom").textContent = Math.round(scale * 100) + "%";
    document.querySelector(".reader").dataset.ready = "true";
    paintHighlights();
    state(
      `Page ${page} of ${pdf.numPages}. Select text, or use Snip region for a scan.`
    );
  } catch (error) {
    if (
      generation === renderGeneration &&
      error.name !== "RenderingCancelledException"
    )
      state(errorText(error), true);
  } finally {
    if (generation === renderGeneration) rendering = false;
  }
}
async function goToPage(value) {
  if (!pdf || busy) return;
  page = Math.min(pdf.numPages, Math.max(1, Math.floor(Number(value) || 1)));
  selection = undefined;
  updateHighlightActions();
  $("panel").hidden = true;
  window.getSelection()?.removeAllRanges();
  await renderPage();
  $("viewport").scrollTop = 0;
}

async function refreshSaved() {
  annotations = await api("annotations", {
    documentId,
    revision: info.revision,
  });
  paintHighlights();
  updateHighlightActions();
  const list = $("savedList");
  list.replaceChildren();
  if (!annotations.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No saved highlights or notes for this document version.";
    list.append(p);
  }
  for (const record of annotations) {
    const row = document.createElement("article");
    row.className = "savedItem";
    const label = document.createElement("strong");
    label.textContent = `${record.kind} · Page ${record.page}`;
    const excerpt = document.createElement("p");
    excerpt.textContent = record.excerpt;
    row.append(label, excerpt);
    if (record.body) {
      const body = document.createElement("p");
      body.textContent = record.body;
      row.append(body);
    }
    const open = document.createElement("button");
    open.textContent = "Open source page";
    open.onclick = () => void goToPage(record.page);
    const remove = document.createElement("button");
    remove.textContent = record.kind === "highlight" ? "Delete highlight" : "Delete saved item";
    remove.className = "deleteAnnotation";
    remove.setAttribute(
      "aria-label",
      `Delete ${record.kind} on page ${record.page}`
    );
    remove.onclick = () => void removeSavedAnnotation(record, remove);
    row.append(open, remove);
    list.append(row);
  }
}

async function perform(action) {
  if (!selection && !(action === "ask" && $("scope").value !== "selection")) {
    state("Select text or snip a region first.", true);
    return;
  }
  if (busy) return;
  busy = true;
  const chosen = selection ?? {
    documentId,
    revision: info.revision,
    page,
    text: "",
    rects: [],
  };
  document.querySelectorAll("#actions button, #askForm button").forEach(b => {
    b.disabled = true;
  });
  state(
    chosen.region
      ? "Recognizing the selected text… This does not interpret image meaning."
      : "Working with the verified selection…"
  );
  try {
    if (action === "ask") {
      const mode = $("scope").value;
      const retrievalScope =
        mode === "selection"
          ? { type: "selection", selection: chosen }
          : mode === "document"
            ? { type: "document", documentId }
            : mode === "course"
              ? { type: "course", courseId: info.courseId }
              : { type: "enrolled" };
      const result = await api(
        "send",
        { documentId, message: $("question").value, retrievalScope },
        true,
        "chat"
      );
      $("response").textContent =
        result.aiResponse.split("\n\n**Material excerpts used**")[0] +
        (result.warnings?.length ? "\n\n" + result.warnings.join("\n\n") : "");
      $("responseSources").replaceChildren();
      for (const source of result.sources ?? []) {
        const button = document.createElement("button");
        button.textContent = `${source.documentTitle}${source.page ? " · Page " + source.page : " · Source excerpt"}`;
        button.onclick = () => openSource(source);
        $("responseSources").append(button);
      }
      state("Answer ready. Open the sources to check it.");
    } else if (action === "highlight") {
      if (chosen.region && !info.ocrAvailable)
        throw new Error(
          "OCR is unavailable for this scan. Select searchable text instead."
        );
      await api("highlight", { selection: chosen, requestId: id() }, true);
      state("Highlight saved to your account.");
    } else {
      const result = await api(
        "act",
        {
          selection: chosen,
          action,
          question: $("question").value,
          requestId: id(),
        },
        true
      );
      lastSource = result.source;
      $("response").textContent =
        (result.source.recognition === "ocr"
          ? "Based on OCR text only. Image structure was not interpreted.\n\n"
          : "") + result.content;
      $("returnSource").hidden = false;
      state(
        action === "notes"
          ? "Notes saved with their source page."
          : "Response ready. Check it against the source material."
      );
    }
    await refreshSaved();
  } catch (error) {
    state(errorText(error), true);
  } finally {
    busy = false;
    document.querySelectorAll("#actions button, #askForm button").forEach(b => {
      b.disabled = false;
    });
  }
}

let selectionTimer, selectionGeneration;
document.addEventListener("selectionchange", () => {
  if (!info || busy || snipping) return;
  const selected = window.getSelection();
  if (!selected?.rangeCount || selected.isCollapsed) {
    // A responsive redraw temporarily clears the browser range, but not the
    // verified page/text snapshot captured before the redraw.
    if (!rendering && selectionGeneration === renderGeneration) clearTimeout(selectionTimer);
    return;
  }
  if (rendering) return;
  const range = selected.getRangeAt(0);
  if (!$("textLayer").contains(range.commonAncestorContainer)) {
    clearTimeout(selectionTimer);
    return;
  }
  const text = selected.toString().trim();
  if (!text) return;
  if (text.length > 12000) {
    clearTimeout(selectionTimer);
    state("Select a smaller passage (up to 12,000 characters).", true);
    return;
  }
  const bounds = $("sheet").getBoundingClientRect();
  const rects = [...range.getClientRects()]
    .filter(r => r.width > 0 && r.height > 0)
    .map(r => normalizedRect(r, bounds))
    .filter(r => r.width > 0 && r.height > 0)
    .slice(0, 200);
  const next = { documentId, revision: info.revision, page, text, rects };
  selectionGeneration = renderGeneration;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    if (!info || busy || snipping || next.page !== page || next.revision !== info.revision) return;
    setSelection(next);
  }, 300);
});

let start;
$("snipLayer").addEventListener("pointerdown", event => {
  if (!snipping || busy || rendering || !info) return;
  event.preventDefault();
  $("snipLayer").setPointerCapture(event.pointerId);
  const bounds = $("sheet").getBoundingClientRect();
  start = {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
});
function pointerRegion(event) {
  const bounds = $("sheet").getBoundingClientRect();
  const x = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    ),
    y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
  return {
    x: Math.min(start.x, x),
    y: Math.min(start.y, y),
    width: Math.abs(start.x - x),
    height: Math.abs(start.y - y),
  };
}
$("snipLayer").addEventListener("pointermove", event => {
  if (start) paintRects($("snipLayer"), [pointerRegion(event)], "snipRect");
});
$("snipLayer").addEventListener("pointercancel", () => {
  start = undefined;
});
$("snipLayer").addEventListener("pointerup", event => {
  if (!start) return;
  const region = pointerRegion(event);
  start = undefined;
  snipMode(false);
  if (region.width < 0.01 || region.height < 0.01) {
    state("Select a larger region.", true);
    return;
  }
  setSelection({
    documentId,
    revision: info.revision,
    page,
    region,
    text: "",
    rects: [],
  });
  if (!info.ocrAvailable)
    state(
      "OCR is not configured. This region has not been interpreted. Searchable text selections remain available.",
      true
    );
});
$("snip").onclick = () => {
  if (pdf && !busy && !rendering) snipMode(!snipping);
};
$("openTutor").onclick = () => {
  if (info) {
    showLearningControls();
    showPanel();
    $("scope").value = selection ? "selection" : "document";
  }
};
$("toggleTools").onclick = () => {
  const expanded = $("extraTools").hidden;
  $("extraTools").hidden = !expanded;
  $("toggleTools").setAttribute("aria-expanded", String(expanded));
  $("toggleTools").textContent = expanded ? "Hide tools" : "More tools";
};

function openSource(source) {
  if (source.documentId === documentId && source.page) {
    void goToPage(source.page);
    return;
  }
  const message = { type: "cognify-reader-source", source };
  if (window.ReactNativeWebView)
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  else window.parent.postMessage(message, embeddingOrigin);
}
$("previous").onclick = () => void goToPage(page - 1);
$("next").onclick = () => void goToPage(page + 1);
$("page").onchange = () => void goToPage($("page").value);
$("zoomIn").onclick = () => {
  if (pdf && !rendering && !busy) {
    scale = Math.min(3, scale + 0.25);
    void renderPage();
  }
};
$("zoomOut").onclick = () => {
  if (pdf && !rendering && !busy) {
    scale = Math.max(0.5, scale - 0.25);
    void renderPage();
  }
};
$("fitWidth").onclick = () => {
  if (pdf && !busy) {
    fitMode = "width";
    scale = 1;
    void renderPage();
  }
};
$("fitPage").onclick = () => {
  if (pdf && !busy) {
    fitMode = "page";
    scale = 1;
    void renderPage();
  }
};
// Refit after a panel toggle, fullscreen change, or host window resize.
let resizeTimer;
let viewportWidth = 0;
let viewportHeight = 0;
new ResizeObserver(entries => {
  const width = Math.round(entries[0].contentRect.width);
  const height = Math.round(entries[0].contentRect.height);
  if (width === viewportWidth && height === viewportHeight) return;
  viewportWidth = width;
  viewportHeight = height;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (pdf) void renderPage();
  }, 150);
}).observe($("viewport"));
$("closePanel").onclick = () => {
  $("panel").hidden = true;
  $("showSaved").setAttribute("aria-expanded", "false");
};
$("showSaved").onclick = () => {
  if (!info) return;
  showPanel();
  $("saved").hidden = false;
  $("learningControls").hidden = true;
  $("panelHeading").textContent = "Saved highlights and notes";
  $("panel").scrollTop = 0;
  $("showSaved").setAttribute("aria-expanded", "true");
};
$("highlight").onclick = () => void perform("highlight");
$("removeHighlight").onclick = () => {
  const record = selectedHighlight();
  if (record) void removeSavedAnnotation(record, $("removeHighlight"));
};
document.querySelectorAll("[data-action]").forEach(b => {
  b.onclick = () => void perform(b.dataset.action);
});
$("askForm").onsubmit = event => {
  event.preventDefault();
  void perform("ask");
};
$("returnSource").onclick = async () => {
  if (lastSource) {
    await goToPage(lastSource.page);
    $("viewport").focus();
  }
};
$("searchForm").onsubmit = async event => {
  event.preventDefault();
  const needle = $("search").value.trim().toLowerCase();
  if (!needle || !pdf || searching || busy) return;
  searching = true;
  state("Searching PDF text…");
  try {
    for (let offset = 1; offset <= pdf.numPages; offset++) {
      const target = ((page - 1 + offset) % pdf.numPages) + 1;
      const current = await pdf.getPage(target);
      const text = (await current.getTextContent()).items
        .map(i => ("str" in i ? i.str : ""))
        .join(" ")
        .toLowerCase();
      if (text.includes(needle)) {
        await goToPage(target);
        state(`Found “${$("search").value}” on page ${target}.`);
        return;
      }
    }
    state("No text match found. Scanned pages may require OCR.");
  } catch (error) {
    state(errorText(error), true);
  } finally {
    searching = false;
  }
};

async function authenticate(value) {
  if (
    active ||
    typeof value !== "string" ||
    value.length < 10 ||
    !Number.isSafeInteger(documentId) ||
    documentId < 1
  )
    return;
  active = true;
  token = value;
  try {
    info = await api("open", { documentId });
    if (info.pages > 2000)
      throw new Error("This PDF exceeds the supported 2,000-page limit.");
    $("title").textContent = info.title;
    $("scope").querySelector('option[value="course"]').disabled =
      !info.courseId;
    const response = await fetch(`/api/document-reader/${documentId}/file`, {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        "The PDF could not be opened. Check your access and try again."
      );
    if (response.headers.get("X-Document-Revision") !== info.revision)
      throw new Error("The document changed while opening. Reopen the reader.");
    pdf = await getDocument({
      data: new Uint8Array(await response.arrayBuffer()),
      isEvalSupported: false,
      cMapUrl: "/api/document-reader/assets/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/api/document-reader/assets/standard_fonts/",
      wasmUrl: "/api/document-reader/assets/wasm/",
    }).promise;
    page = Math.min(page, pdf.numPages);
    await renderPage();
    await refreshSaved();
    if (params.get("revision") && params.get("revision") !== info.revision)
      state(
        "The linked source version has changed. Showing the current document; its page content may differ.",
        true
      );
  } catch (error) {
    token = "";
    state(errorText(error), true);
  }
}
// Browser credentials come only from the embedding application at the same origin.
const embeddingOrigin = (() => {
  try {
    return document.referrer
      ? new URL(document.referrer).origin
      : location.origin;
  } catch {
    return location.origin;
  }
})();
window.addEventListener("message", event => {
  if (
    event.source === window.parent &&
    event.origin === embeddingOrigin &&
    event.data?.type === "cognify-reader-auth"
  )
    void authenticate(event.data.token);
});
// The native host supplies its SecureStore token in memory after the ready signal.
window.addEventListener(
  "cognify-reader-auth",
  event => void authenticate(event.detail)
);
if (window.ReactNativeWebView)
  window.ReactNativeWebView.postMessage(
    JSON.stringify({ type: "cognify-reader-ready" })
  );
else
  window.parent.postMessage({ type: "cognify-reader-ready" }, embeddingOrigin);
