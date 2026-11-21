import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  BookOpen,
  Bold,
  ChevronDown,
  Code2,
  ExternalLink,
  FileText,
  Image,
  Italic,
  Layers,
  Link2,
  List,
  ListOrdered,
  MessageSquareText,
  MoreVertical,
  Plus,
  Redo2,
  Save,
  Search,
  Sparkles,
  Strikethrough,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DocumentLearningReader } from "@/components/DocumentLearningReader";
import { storagePut } from "@/lib/storage";
import { apiUrl } from "@/lib/apiBaseUrl";
import "./personal-notes.css";

// ── Note detail view (pixel-match screenshot layout) ─────────────────────────

type NoteRecord = {
  id: number;
  title: string;
  body: string;
  topic: string;
  collection: string;
  courseId: number | null;
  documentId: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

function NoteDetailView({
  note,
  onBack,
  onEdit,
}: {
  note: NoteRecord;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const wordCount = note.body.trim().split(/\s+/).filter(Boolean).length;
  const createdDate = (() => {
    try {
      return new Date(note.createdAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch { return ""; }
  })();

  const sendQuery = trpc.chat.send.useMutation({
    onSuccess: data => {
      setAiResponse(data.aiResponse ?? "");
      setAiLoading(false);
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
      setAiLoading(false);
    },
  });

  const handleAiQuestion = (q: string) => {
    if (!q.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    sendQuery.mutate({ documentId: note.documentId ?? 0, message: q });
  };

  const chipActions = [
    { label: "Summarize this note", prompt: `Summarize the key points from this note: "${note.title}"` },
    { label: "Explain this concept", prompt: `Explain the main concept in: ${note.title}` },
    { label: "Create flashcards", prompt: "/flashcards 5" },
    { label: "Quiz me", prompt: "/quiz 5" },
  ];

  const quickActions = [
    { Icon: BookOpen,         label: "Summarize note",       prompt: `Summarize "${note.title}" as bullet points` },
    { Icon: Layers,           label: "Generate flashcards",  prompt: "/flashcards 5" },
    { Icon: FileText,         label: "Create quiz",          prompt: "/quiz 5" },
    { Icon: MessageSquareText,label: "Ask a question",       prompt: "" },
  ] as const;

  const highlight = note.body
    .replace(/[#*`_~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

  return (
    <div className="pn-detail-view">
      {/* ── Left panel: document reader or note body ── */}
      <section className="pn-detail-main">
        <header className="pn-detail-header">
          <button type="button" className="pn-detail-back" onClick={onBack} aria-label="Back to notes">
            <ArrowLeft size={16} />
          </button>
          <div className="pn-detail-meta">
            {createdDate && (
              <span className="pn-detail-meta-item">
                <FileText size={12} />
                Created on {createdDate}
              </span>
            )}
            {note.topic && <span className="pn-detail-meta-item pn-detail-topic">{note.topic}</span>}
            {note.collection && <span className="pn-detail-meta-item pn-detail-tag">{note.collection}</span>}
          </div>
          <div className="pn-detail-actions">
            {note.documentId && (
              <a href={`/document/${note.documentId}`} target="_blank" rel="noreferrer" className="pn-detail-open-btn">
                Open in new tab <ExternalLink size={12} />
              </a>
            )}
            <button type="button" className="pn-detail-edit-btn" onClick={onEdit}>⋯</button>
          </div>
        </header>

        <h1 className="pn-detail-title">{note.title}</h1>

        <div className="pn-detail-content">
          {note.documentId ? (
            <DocumentLearningReader documentId={note.documentId} title={note.title} />
          ) : (
            <article className="pn-detail-body">
              <Streamdown>{note.body}</Streamdown>
            </article>
          )}
        </div>
      </section>

      {/* ── Right panel: AI assistant ── */}
      <aside className="pn-detail-ai">
        <header className="pn-ai-panel-header">
          <div className="pn-ai-panel-title">
            <Sparkles size={15} className="pn-ai-sparkle" />
            <h2>AI Assistant</h2>
          </div>
          <span className="pn-ai-badge">Powered by AI</span>
        </header>
        <p className="pn-ai-subtitle">Get summaries, explanations and insights from your notes</p>

        <form className="pn-ai-ask" onSubmit={e => { e.preventDefault(); handleAiQuestion(aiQuestion); setAiQuestion(""); }}>
          <input
            className="pn-ai-input"
            placeholder="Ask a question about this note..."
            value={aiQuestion}
            maxLength={500}
            onChange={e => setAiQuestion(e.target.value)}
            aria-label="Ask about this note"
          />
          <button type="submit" className="pn-ai-send" disabled={!aiQuestion.trim() || aiLoading} aria-label="Send">
            ➤
          </button>
        </form>

        <div className="pn-ai-chips">
          {chipActions.map(a => (
            <button key={a.label} type="button" className="pn-ai-chip" disabled={aiLoading} onClick={() => handleAiQuestion(a.prompt)}>
              {a.label}
            </button>
          ))}
        </div>

        {(aiLoading || aiResponse) && (
          <div className="pn-ai-response">
            {aiLoading
              ? <p className="pn-ai-thinking">Thinking…</p>
              : aiResponse
                ? <div className="pn-ai-response-body"><Streamdown>{aiResponse}</Streamdown></div>
                : null}
          </div>
        )}

        {!aiResponse && !aiLoading && highlight && (
          <section className="pn-ai-section">
            <div className="pn-ai-section-heading">
              <h3>Key highlights</h3>
              <button type="button" className="pn-ai-view-all" onClick={() => handleAiQuestion(`What are the key highlights from "${note.title}"?`)}>
                View all
              </button>
            </div>
            <div className="pn-ai-highlight-card">
              <span className="pn-ai-quote">"</span>
              <p>{highlight}{highlight.length >= 220 ? "…" : ""}</p>
              <span className="pn-ai-page-tag">Note</span>
            </div>
          </section>
        )}

        {!aiResponse && !aiLoading && (
          <section className="pn-ai-section">
            <div className="pn-ai-section-heading"><h3>Quick actions</h3></div>
            <div className="pn-ai-quick-grid">
              {quickActions.map(a => (
                <button key={a.label} type="button" className="pn-ai-quick-btn" disabled={aiLoading}
                  onClick={() => a.prompt ? handleAiQuestion(a.prompt) : undefined}>
                  <span className="pn-ai-quick-icon"><a.Icon size={14} /></span>
                  <span className="pn-ai-quick-label">{a.label}</span>
                  <span className="pn-ai-quick-arrow">›</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="pn-ai-section pn-ai-stats-section">
          <div className="pn-ai-section-heading"><h3>Note statistics</h3></div>
          <p className="pn-ai-stats-text">
            {wordCount.toLocaleString()} words{createdDate ? ` · Created ${createdDate}` : ""}
          </p>
        </section>
      </aside>
    </div>
  );
}

type Draft = {
  courseId: number | null;
  topic: string;
  collection: string;
  id?: number;
  version?: number;
  title: string;
  body: string;
  tags: string[];
  requestId: string;
};
const fresh = (): Draft => ({
  courseId: null,
  topic: "",
  collection: "",
  title: "",
  body: "",
  tags: [],
  requestId: crypto.randomUUID(),
});
const plain = (body: string) =>
  body
    .replace(/[#*`_~>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export default function PersonalNotes() {
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"latest" | "oldest" | "title">("latest");
  const [offset, setOffset] = useState(0);
  const [courseFilter, setCourseFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | undefined>();
  const [collectionFilter, setCollectionFilter] = useState<
    string | undefined
  >();
  const [viewingNote, setViewingNote] = useState<NoteRecord | null>(null);
  const [draft, setDraft] = useState<Draft>(fresh);
  const [dirty, setDirty] = useState(false);
  const [writing, setWriting] = useState(false);
  const [tag, setTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [importing, setImporting] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const draftTouched = useRef(false);
  // Pending format: applied once textarea is mounted after setWriting(true)
  const pendingFormat = useRef<{ start: number; end: number; before: string; after: string; fallback: string } | null>(null);
  const history = useRef<{ past: Draft[]; future: Draft[] }>({
    past: [],
    future: [],
  });
  const utils = trpc.useUtils();
  const organization = trpc.personalNotes.organization.useQuery();
  const courseChoices = [
    ...(organization.data?.courses ?? []),
    ...(organization.data?.linkedCourseIds ?? [])
      .filter(id => !organization.data?.courses.some(c => c.id === id))
      .map(id => ({
        id,
        title: `Previously linked course (#${id})`,
        code: `Course ${id}`,
      })),
  ];
  const notes = trpc.personalNotes.list.useQuery({
    search,
    offset,
    order,
    courseId: courseFilter ? Number(courseFilter) : undefined,
    topic: topicFilter,
    collection: collectionFilter,
  });
  const responses = trpc.generalChat.history.useQuery(undefined, {
    enabled: importing,
  });
  const loaded = (note: Omit<Draft, "requestId">) => {
    draftTouched.current = true;
    setDraft({ ...note, requestId: crypto.randomUUID() });
    setDirty(false);
    setWriting(false);
    history.current = { past: [], future: [] };
  };
  useEffect(() => {
    if (notes.data && !initialized.current) {
      initialized.current = true;
      if (notes.data.items[0] && !draftTouched.current)
        loaded(notes.data.items[0]);
    }
  }, [notes.data]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Apply pending format once the textarea is mounted (after switching to write mode)
  useEffect(() => {
    if (!writing || !pendingFormat.current || !textarea.current) return;
    const { start, end, before, after, fallback } = pendingFormat.current;
    pendingFormat.current = null;
    const field = textarea.current;
    const selected = draft.body.slice(start, end) || fallback;
    const newBody =
      draft.body.slice(0, start) + before + selected + after + draft.body.slice(end);
    // Update body directly in the textarea and trigger React's synthetic onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    nativeInputValueSetter?.call(field, newBody);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
    field.setSelectionRange(start + before.length, start + before.length + selected.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing]);

  const failed = (error: { message: string }) => toast.error(error.message);
  const done = (note: Omit<Draft, "requestId">) => {
    loaded(note);
    void utils.personalNotes.list.invalidate();
    void utils.personalNotes.organization.invalidate();
    toast.success("Note saved");
  };
  const create = trpc.personalNotes.create.useMutation({
    onSuccess: done,
    onError: failed,
  });
  const update = trpc.personalNotes.update.useMutation({
    onSuccess: done,
    onError: failed,
  });
  const remove = trpc.personalNotes.remove.useMutation({
    onSuccess: result => {
      if (draft.id === result.id) loaded(fresh());
      setOffset(0);
      setMenu(null);
      void utils.personalNotes.list.invalidate();
      void utils.personalNotes.organization.invalidate();
    },
    onError: failed,
  });
  const saveResponse = trpc.personalNotes.saveResponse.useMutation({
    onSuccess: note => {
      done(note);
      setImporting(false);
    },
    onError: failed,
  });
  const busy = create.isPending || update.isPending || saveResponse.isPending;
  const open = (next: Draft) => {
    if (busy) return;
    if (dirty && !window.confirm("Discard your unsaved note changes?")) return;
    draftTouched.current = true;
    loaded(next);
    setMenu(null);
  };
  const change = (next: Draft) => {
    draftTouched.current = true;
    history.current.past = [...history.current.past.slice(-39), draft];
    history.current.future = [];
    setDraft(next);
    setDirty(true);
  };
  function undo(redo = false) {
    const next = (redo ? history.current.future : history.current.past).pop();
    if (!next) return;
    (redo ? history.current.past : history.current.future).push(draft);
    setDraft(next);
    setDirty(true);
  }
  const hasFilters = Boolean(
    search ||
    courseFilter ||
    topicFilter !== undefined ||
    collectionFilter !== undefined
  );
  function format(before: string, after = "", fallback = "text") {
    const field = textarea.current;
    // Get current selection from textarea if in write mode, else use end of body
    const start = writing && field ? field.selectionStart : draft.body.length;
    const end   = writing && field ? field.selectionEnd   : start;

    if (!writing) {
      // Not yet in write mode — stash the format request and switch to write mode.
      // The useEffect above will apply it once the textarea mounts.
      pendingFormat.current = { start, end, before, after, fallback };
      setWriting(true);
      return;
    }

    // Already in write mode — apply immediately
    const selected = draft.body.slice(start, end) || fallback;
    change({
      ...draft,
      body:
        draft.body.slice(0, start) +
        before +
        selected +
        after +
        draft.body.slice(end),
    });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      );
    });
  }
  function addTag() {
    const value = tag.trim().replace(/^#+/, "");
    if (!value) return;
    if (value.length > 30 || draft.tags.length >= 12) {
      toast.error("Use up to 12 tags, each 30 characters or fewer.");
      return;
    }
    if (!draft.tags.some(t => t.toLowerCase() === value.toLowerCase()))
      change({ ...draft, tags: [...draft.tags, value] });
    setTag("");
    setAddingTag(false);
  }
  const tools = [
    { Icon: Bold, label: "Bold", before: "**", after: "**" },
    { Icon: Italic, label: "Italic", before: "_", after: "_" },
    { Icon: Strikethrough, label: "Strikethrough", before: "~~", after: "~~" },
    { Icon: List, label: "Bullet list", before: "\n- ", after: "" },
    { Icon: ListOrdered, label: "Numbered list", before: "\n1. ", after: "" },
  ];
  // Show the detail view when a note is selected (pixel-match screenshot)
  if (viewingNote) {
    return (
      <NoteDetailView
        note={viewingNote}
        onBack={() => setViewingNote(null)}
        onEdit={() => {
          // Load the note into the editor and close the detail view
          open({ ...viewingNote, requestId: crypto.randomUUID() });
          setViewingNote(null);
        }}
      />
    );
  }
  return (
    <div className="personal-notes-workspace">
      <section className="pn-editor pn-panel" aria-label="Note editor">
        <header className="pn-panel-heading">
          <h2>
            <span className="pn-heading-icon">
              <BookOpen size={20} />
            </span>
            {draft.id ? "Edit note" : "Create new note"}
          </h2>
          <button
            type="button"
            className="pn-ai-button"
            onClick={() => {
              if (
                !dirty ||
                window.confirm("Leave your draft to save an AI response?")
              )
                setImporting(true);
            }}
            disabled={busy}
          >
            <Sparkles size={17} />
            Save from AI response
          </button>
        </header>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (busy) return;
            const { title, body, tags, courseId, topic, collection } = draft;
            if (draft.id)
              update.mutate({
                id: draft.id,
                version: draft.version!,
                title,
                body,
                tags,
                courseId,
                topic,
                collection,
              });
            else
              create.mutate({
                title,
                body,
                tags,
                courseId,
                topic,
                collection,
                requestId: draft.requestId,
              });
          }}
        >
          <input
            className="pn-title-input"
            aria-label="Title"
            placeholder="Give your note a title"
            value={draft.title}
            maxLength={160}
            required
            disabled={busy}
            onChange={e => change({ ...draft, title: e.target.value })}
          />
          <div className="pn-organization-fields">
            <label>
              Course
              <select
                aria-label="Note course"
                value={draft.courseId ?? ""}
                disabled={busy || organization.isLoading}
                onChange={e =>
                  change({
                    ...draft,
                    courseId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">Personal / no course</option>
                {courseChoices.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.title}
                  </option>
                ))}
                {draft.courseId &&
                  !courseChoices.some(c => c.id === draft.courseId) && (
                    <option value={draft.courseId}>
                      Previously linked course (#{draft.courseId})
                    </option>
                  )}
              </select>
            </label>
            <label>
              Topic
              <input
                aria-label="Note topic"
                list="pn-topics"
                maxLength={100}
                placeholder="e.g. Neural networks"
                value={draft.topic}
                disabled={busy}
                onChange={e => change({ ...draft, topic: e.target.value })}
              />
            </label>
            <label>
              Collection
              <input
                aria-label="Note collection"
                list="pn-collections"
                maxLength={80}
                placeholder="Choose or create a collection"
                value={draft.collection}
                disabled={busy}
                onChange={e => change({ ...draft, collection: e.target.value })}
              />
            </label>
            <datalist id="pn-topics">
              {organization.data?.topics.map(topic => (
                <option key={topic} value={topic} />
              ))}
            </datalist>
            <datalist id="pn-collections">
              {organization.data?.collections.map(collection => (
                <option key={collection} value={collection} />
              ))}
            </datalist>
          </div>
          {organization.error && (
            <p className="pn-organization-error" role="alert">
              Course choices could not load.{" "}
              <button type="button" onClick={() => void organization.refetch()}>
                Retry
              </button>
            </p>
          )}
          <div className="pn-document-editor">
            <div
              className="pn-toolbar"
              role="toolbar"
              aria-label="Note formatting"
            >
              <select
                aria-label="Paragraph style"
                defaultValue="normal"
                disabled={busy}
                onChange={e => {
                  format(
                    e.target.value === "h1"
                      ? "\n# "
                      : e.target.value === "h2"
                        ? "\n## "
                        : "\n",
                    "",
                    "Heading"
                  );
                  e.target.value = "normal";
                }}
              >
                <option value="normal">Normal</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
              </select>
              <span className="pn-divider" />
              {tools.map(({ Icon, label, before, after }, index) => (
                <button
                  title={label}
                  aria-label={label}
                  key={label}
                  type="button"
                  disabled={busy}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => format(before, after)}
                  className={index === 3 ? "pn-tool-separated" : ""}
                >
                  <Icon size={18} />
                </button>
              ))}
              <span className="pn-divider" />
              <button
                type="button"
                aria-label="Insert link"
                title="Insert link"
                disabled={busy}
                onClick={() => {
                  const url = window.prompt("Link address (https://…)");
                  if (url && /^https?:\/\/[^\s)]+$/i.test(url))
                    format("[", `](${url})`, "Link text");
                  else if (url)
                    toast.error("Enter a valid HTTP or HTTPS address.");
                }}
              >
                <Link2 size={18} />
              </button>
              <button
                type="button"
                aria-label="Insert image from computer"
                title="Insert image from your computer"
                disabled={busy}
                onClick={() => imageInputRef.current?.click()}
              >
                <Image size={18} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error("Image must be 10 MB or smaller.");
                    return;
                  }
                  try {
                    const key = `uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
                    const { url } = await storagePut(key, await file.arrayBuffer(), file.type || "image/png");
                    const alt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || "image";
                    const imgMd = `![${alt}](${apiUrl(url)})`;
                    const field = textarea.current;
                    const pos = writing && field ? field.selectionStart : draft.body.length;
                    change({ ...draft, body: draft.body.slice(0, pos) + imgMd + draft.body.slice(pos) });
                    setWriting(true);
                    requestAnimationFrame(() => {
                      field?.focus();
                      const after = pos + imgMd.length;
                      field?.setSelectionRange(after, after);
                    });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Image upload failed.");
                  }
                }}
              />
              <button
                type="button"
                aria-label={writing ? "Preview note" : "Edit Markdown"}
                title={writing ? "Preview note" : "Edit Markdown"}
                aria-pressed={writing}
                disabled={busy}
                onClick={() => setWriting(!writing)}
              >
                <Code2 size={18} />
              </button>
              <span className="pn-toolbar-spacer" />
              <button
                type="button"
                aria-label="Undo"
                disabled={busy || !history.current.past.length}
                onClick={() => undo()}
              >
                <Undo2 size={19} />
              </button>
              <button
                type="button"
                aria-label="Redo"
                disabled={busy || !history.current.future.length}
                onClick={() => undo(true)}
              >
                <Redo2 size={19} />
              </button>
            </div>
            {writing ? (
              <textarea
                ref={textarea}
                className="pn-body-input"
                aria-label="Note"
                placeholder="Start writing your study notes…"
                value={draft.body}
                maxLength={50000}
                disabled={busy}
                onChange={e => change({ ...draft, body: e.target.value })}
              />
            ) : (
              <div
                className="pn-preview"
                role="button"
                tabIndex={0}
                aria-label="Edit note text"
                onClick={() => {
                  if (!busy) setWriting(true);
                }}
                onKeyDown={e => {
                  if (!busy && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setWriting(true);
                  }
                }}
              >
                {draft.body ? (
                  <Streamdown>{draft.body}</Streamdown>
                ) : (
                  <div className="pn-empty-editor">
                    <FileText size={34} />
                    <h3>A fresh page for your ideas</h3>
                    <p>Click here to start writing, or save an AI response.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <footer className="pn-editor-footer">
            <div className="pn-tags">
              {draft.tags.map(value => (
                <button
                  type="button"
                  className="pn-tag"
                  key={value}
                  title={`Remove ${value} tag`}
                  disabled={busy}
                  onClick={() =>
                    change({
                      ...draft,
                      tags: draft.tags.filter(t => t !== value),
                    })
                  }
                >
                  #{value}
                  <X size={10} />
                </button>
              ))}
              {addingTag ? (
                <input
                  autoFocus
                  className="pn-tag-input"
                  aria-label="New tag"
                  value={tag}
                  maxLength={30}
                  onChange={e => setTag(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                    if (e.key === "Escape") {
                      setAddingTag(false);
                      setTag("");
                    }
                  }}
                  onBlur={addTag}
                />
              ) : (
                <button
                  type="button"
                  className="pn-add-tag"
                  disabled={busy}
                  onClick={() => setAddingTag(true)}
                >
                  <Plus size={13} />
                  Add tag
                </button>
              )}
            </div>
            <div className="pn-save-actions">
              <button
                className="pn-discard"
                type="button"
                disabled={busy}
                onClick={() => open(fresh())}
              >
                <Trash2 size={17} />
                Discard
              </button>
              <button
                className="pn-save"
                type="submit"
                disabled={busy || !draft.title.trim() || !draft.body.trim()}
              >
                <Save size={18} />
                {busy ? "Saving…" : "Save note"}
              </button>
            </div>
          </footer>
        </form>
      </section>
      <section className="pn-list pn-panel" aria-label="Saved notes">
        <header className="pn-panel-heading">
          <h2>
            <span className="pn-heading-icon pn-heading-icon-neutral">
              <FileText size={19} />
            </span>
            My notes{" "}
            <span className="pn-count">({notes.data?.total ?? 0})</span>
          </h2>
          <div className="pn-list-controls">
            <label className="pn-search">
              <Search size={16} />
              <input
                aria-label="Search personal notes"
                placeholder="Search notes…"
                value={search}
                maxLength={200}
                onChange={e => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label className="pn-sort">
              <select
                aria-label="Sort notes"
                value={order}
                onChange={e => {
                  setOrder(e.target.value as typeof order);
                  setOffset(0);
                }}
              >
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A–Z</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button
              type="button"
              className="pn-new"
              aria-label="New note"
              title="New note"
              disabled={busy}
              onClick={() => open(fresh())}
            >
              <Plus size={18} />
            </button>
          </div>
        </header>
        <div className="pn-organization-filters">
          <select
            aria-label="Filter notes by course"
            value={courseFilter}
            onChange={e => {
              setCourseFilter(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All courses</option>
            <option value="0">Personal / no course</option>
            {courseChoices.map(course => (
              <option key={course.id} value={course.id}>
                {course.code}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter notes by topic"
            value={topicFilter === undefined ? "*" : ":" + topicFilter}
            onChange={e => {
              setTopicFilter(
                e.target.value === "*" ? undefined : e.target.value.slice(1)
              );
              setOffset(0);
            }}
          >
            <option value="*">All topics</option>
            <option value=":">No topic</option>
            {organization.data?.topics.map(topic => (
              <option key={topic} value={":" + topic}>
                {topic}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter notes by collection"
            value={
              collectionFilter === undefined ? "*" : ":" + collectionFilter
            }
            onChange={e => {
              setCollectionFilter(
                e.target.value === "*" ? undefined : e.target.value.slice(1)
              );
              setOffset(0);
            }}
          >
            <option value="*">All collections</option>
            <option value=":">Uncollected</option>
            {organization.data?.collections.map(collection => (
              <option key={collection} value={":" + collection}>
                {collection}
              </option>
            ))}
          </select>
        </div>
        <div className="pn-note-list">
          {notes.isLoading && (
            <p className="pn-state" role="status">
              Loading notes…
            </p>
          )}
          {notes.error && (
            <div className="pn-state" role="alert">
              {notes.error.message}
              <button type="button" onClick={() => void notes.refetch()}>
                Retry
              </button>
            </div>
          )}
          {notes.data && !notes.data.items.length && (
            <div className="pn-list-empty">
              <BookOpen size={32} />
              <h3>
                {hasFilters ? "No matching notes" : "Your notes belong here"}
              </h3>
              <p>
                {hasFilters
                  ? "Try a different search, course, topic, or collection."
                  : "Create your first note in the editor or save a useful AI response."}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  className="pn-clear-filters"
                  onClick={() => {
                    setSearch("");
                    setCourseFilter("");
                    setTopicFilter(undefined);
                    setCollectionFilter(undefined);
                    setOffset(0);
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
          {notes.data?.items.map((note, index) => (
            <article
              className={`pn-note-card pn-card-color-${index % 5}${draft.id === note.id ? " is-selected" : ""}`}
              key={note.id}
            >
              <button
                type="button"
                className="pn-note-open"
                onClick={() => setViewingNote(note as NoteRecord)}
                disabled={busy}
              >
                <span className="pn-file-icon">
                  <FileText size={23} />
                </span>
                <div className="pn-note-copy">
                  <h3>{note.title}</h3>
                  <p>{plain(note.body)}</p>
                  {(note.courseId || note.topic || note.collection) && (
                    <div className="pn-note-organization">
                      {[
                        note.courseId
                          ? courseChoices.find(c => c.id === note.courseId)
                              ?.code || `Course ${note.courseId}`
                          : "",
                        note.topic,
                        note.collection,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                  <div className="pn-note-bottom">
                    <span>
                      {new Date(note.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      <span>•</span>{" "}
                      {plain(note.body).split(/\s+/).filter(Boolean).length}{" "}
                      words
                    </span>
                    <div className="pn-note-tags">
                      {note.tags.map(value => (
                        <span key={value}>#{value}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="pn-note-menu-button"
                aria-label={`Actions for ${note.title}`}
                aria-expanded={menu === note.id}
                onClick={() => setMenu(menu === note.id ? null : note.id)}
              >
                <MoreVertical size={19} />
              </button>
              {menu === note.id && (
                <div className="pn-note-menu">
                  <button
                    type="button"
                    onClick={() =>
                      open({ ...note, requestId: crypto.randomUUID() })
                    }
                  >
                    Edit note
                  </button>
                  {note.documentId && (
                    <Link href={`/document/${note.documentId}?tab=chat`}>
                      Source conversation
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete “${note.title}”?`))
                        remove.mutate({ id: note.id, version: note.version });
                    }}
                  >
                    Delete note
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {(offset > 0 || notes.data?.hasMore) && (
          <nav className="pn-pagination" aria-label="Notes pages">
            <button
              type="button"
              disabled={!offset || notes.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!notes.data?.hasMore || notes.isFetching}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
      <Dialog.Root open={importing} onOpenChange={setImporting}>
        <Dialog.Portal>
          <Dialog.Overlay className="pn-modal-backdrop" />
          <Dialog.Content asChild>
            <section className="pn-import-dialog pn-import-modal">
              <header>
                <Dialog.Title>Save an AI response</Dialog.Title>
                <button
                  type="button"
                  aria-label="Close AI responses"
                  onClick={() => setImporting(false)}
                >
                  <X size={20} />
                </button>
              </header>
              <Dialog.Description>
                Choose a response from your general study conversation. You can
                also save replies directly from document chat.
              </Dialog.Description>
              {responses.isLoading && <p>Loading responses…</p>}
              {responses.error && <p role="alert">{responses.error.message}</p>}
              {responses.data
                ?.filter(m => m.role === "assistant")
                .reverse()
                .map(m => (
                  <button
                    className="pn-import-response"
                    type="button"
                    disabled={saveResponse.isPending}
                    key={m.id}
                    onClick={() =>
                      saveResponse.mutate({ documentId: 0, content: m.content })
                    }
                  >
                    {plain(m.content).slice(0, 240)}
                    <Save size={17} />
                  </button>
                ))}
              {responses.data &&
                !responses.data.some(m => m.role === "assistant") && (
                  <Link href="/student/askai">
                    Open Ask AI to start a conversation
                  </Link>
                )}
            </section>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
