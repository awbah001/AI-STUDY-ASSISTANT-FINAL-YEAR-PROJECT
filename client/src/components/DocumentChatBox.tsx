import { useState, useEffect } from "react";
import { AIChatBox } from "./AIChatBox";
import { trpc } from "@/lib/trpc";
import type { Message } from "./AIChatBox";
import { toast } from "sonner";
import { SaveResponseNote } from "./SaveResponseNote";
import type { RetrievalScope } from "@shared/retrievalScope";

interface DocumentChatBoxProps {
  documentId: number;
  /** Passed to the chat panel (default 600px). Use e.g. min(70vh, 720px) beside a PDF viewer. */
  height?: string | number;
  className?: string;
}

export function DocumentChatBox({
  documentId,
  height = "600px",
  className,
}: DocumentChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [scope, setScope] = useState<
    "assistant" | "document" | "course" | "enrolled"
  >("assistant");
  const document = trpc.documents.get.useQuery(
    { id: documentId },
    { enabled: documentId > 0 }
  );
  const utils = trpc.useUtils();

  const { data: chatHistory, isLoading: historyLoading } =
    trpc.chat.history.useQuery({
      documentId,
    });

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: response => {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: response.aiResponse,
        },
      ]);
      void utils.summary.get.invalidate({ documentId });
      void utils.flashcards.list.invalidate({ documentId });
      void utils.quizzes.list.invalidate({ documentId });
      void utils.progress.get.invalidate({ documentId });
    },
    onError: error => {
      toast.error(error.message || "Failed to get a response");
      setMessages(prev => prev.slice(0, -1));
    },
  });

  // Reset messages when documentId changes
  useEffect(() => {
    setMessages([]);
  }, [documentId]);

  // Initialize messages from chat history (API returns oldest-first)
  useEffect(() => {
    if (chatHistory) {
      const chronological = [...chatHistory].sort((a, b) => a.id - b.id);
      setMessages(
        chronological.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, [chatHistory]);

  const handleSendMessage = (message: string) => {
    // Add user message to local state
    setMessages(prev => [
      ...prev,
      {
        role: "user",
        content: message,
      },
    ]);

    // Send to backend
    sendMessageMutation.mutate({
      documentId,
      message,
      ...(!message.trim().startsWith("/") && scope !== "assistant"
        ? {
            retrievalScope:
              scope === "document"
                ? ({ type: "document", documentId } as RetrievalScope)
                : scope === "course" && document.data?.courseId
                  ? ({
                      type: "course",
                      courseId: document.data.courseId,
                    } as RetrievalScope)
                  : ({ type: "enrolled" } as RetrievalScope),
          }
        : {}),
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Answer sources
        <select
          aria-label="Answer sources"
          className="min-h-11 rounded-lg border bg-background px-3"
          value={scope}
          disabled={sendMessageMutation.isPending}
          onChange={e => setScope(e.target.value as typeof scope)}
        >
          <option value="assistant">Learning assistant</option>
          <option value="document">Current document only</option>
          <option value="course" disabled={!document.data?.courseId}>
            Current course only
          </option>
          <option value="enrolled">My enrolled courses</option>
        </select>
      </label>
      {scope !== "assistant" && (
        <p className="text-xs text-muted-foreground">
          Answers use verified source material. Select passages and page regions
          in the document reader.
        </p>
      )}
      <AIChatBox
        renderMessageActions={message => <SaveResponseNote content={message.content} documentId={documentId} />}
        className={className}
        height={height}
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={sendMessageMutation.isPending || historyLoading}
        isGenerating={sendMessageMutation.isPending}
        placeholder="Ask the AI anything, or try /summary, /flashcards, /quiz …"
        emptyStateMessage="Ask questions about this document, or use AI commands: /summary, /flashcards 10, /quiz 5."
        suggestedPrompts={["/summary", "/flashcards 10", "/quiz 5"]}
      />
    </div>
  );
}
