import { useState } from "react";
import { useLocation } from "wouter";

import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DocumentProcessingStatus } from "@/components/DocumentProcessingStatus";

import { DOCUMENT_ACCEPT } from "@shared/documentPreview";

import { LIMITS, titleFromFileName, validateText } from "@shared/validation";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/lib/formValidation";

import FlashcardReview from "./FlashcardReview";

import { CalendarDays, FileText, Upload, Search } from "lucide-react";

import { Box, State, Go, Empty, grid, fail, upload } from "./workspaceShared";
export default function Library({ mode }: { mode?: "flashcards" }) {
  const query = trpc.documents.list.useQuery(undefined, { refetchInterval: query => query.state.data?.some(d => d.processingStatus === "pending" || d.processingStatus === "processing") ? 2500 : false });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("All materials");
  const { errors: uploadErrors, check: checkUpload, clear: clearUpload } = useFieldErrors<"title" | "file">();
  const create = trpc.documents.createOwn.useMutation();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const visibleDocuments = query.data?.filter(
    d =>
      `${d.title} ${d.fileName}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All materials" ||
        (category === "Slides"
          ? /\.pptx?$/i
          : category === "Notes"
            ? /\.txt$/i
            : category === "Images"
              ? /\.(png|jpe?g|webp)$/i
              : /\.(pdf|docx?)$/i
        ).test(d.fileName))
  );
  return (
    <>
      {mode && <FlashcardReview />}
      {!mode && (
        <Box title="Upload study material">
          <p className="student-muted">
            Add your notes, slides, or any learning resources.
          </p>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={async e => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const file = form.get("file") as File;
              const title = String(form.get("title") || "");
              const ok = checkUpload({
                title: validateText(title, { label: "Title", required: false, ...LIMITS.title }),
                file: file?.size ? null : "Choose a file to upload.",
              });
              if (!ok) return;
              setBusy(true);
              try {
                const doc = await create.mutateAsync({
                  title: title.trim() || titleFromFileName(file.name),
                  ...(await upload(file)),
                });
                await utils.documents.list.invalidate();
                navigate(`/document/${doc.id}`);
              } catch (error) {
                fail(error as Error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="w-full max-w-xs space-y-1.5">
              <Input
                name="title"
                aria-label="Document title"
                placeholder="Document title (optional)"
                maxLength={LIMITS.title.max}
                aria-invalid={Boolean(uploadErrors.title)}
                onChange={() => clearUpload("title")}
              />
              <FieldError message={uploadErrors.title} />
            </div>
            <div className="w-full max-w-xs space-y-1.5">
              <Input
                name="file"
                aria-label="Study material file"
                type="file"
                accept={DOCUMENT_ACCEPT}
                aria-invalid={Boolean(uploadErrors.file)}
                onChange={() => clearUpload("file")}
              />
              <FieldError message={uploadErrors.file} />
            </div>
            <Button disabled={busy}>
              {busy ? "Uploading..." : "Upload document"}
            </Button>
          </form>
        </Box>
      )}
      <div className="student-toolbar">
        {!mode && (
          <div className="student-tabs">
            {["All materials", "Documents", "Slides", "Notes", "Images"].map(
              type => (
                <button
                  key={type}
                  className={category === type ? "active" : ""}
                  onClick={() => setCategory(type)}
                >
                  {type}
                </button>
              )
            )}
          </div>
        )}
        <Input
          aria-label="Search documents"
          placeholder="Search your study materials..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <State query={query} />
      <div className={`${grid} student-material-grid`}>
        {visibleDocuments?.map(d => (
          <Box title={d.title} key={d.id}>
            <p className="text-sm text-muted-foreground">{d.fileName}</p>
            <DocumentProcessingStatus doc={d} />
            <div className="student-material-meta">
              <span>
                <CalendarDays />
                {new Date(d.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span>
                <FileText />
                {d.fileSize
                  ? `${(d.fileSize / 1048576).toFixed(1)} MB`
                  : "Size unavailable"}
              </span>
            </div>
            <Go href={`/document/${d.id}${mode ? "?tab=flashcards" : ""}`} tone="accent">
              {mode ? "Review flashcards" : "Open workspace"}
            </Go>
          </Box>
        ))}
      </div>
      {query.data && !visibleDocuments?.length && (
        <Empty>
          No materials found. Upload a document or join a course to get started.
        </Empty>
      )}
    </>
  );
}
