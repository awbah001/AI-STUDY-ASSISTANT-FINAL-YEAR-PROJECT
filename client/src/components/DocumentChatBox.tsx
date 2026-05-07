import { useState, useEffect } from "react";
import { AIChatBox } from "./AIChatBox";
import { trpc } from "@/lib/trpc";
import type { Message } from "./AIChatBox";
import { toast } from "sonner";

interface DocumentChatBoxProps {
  documentId: number;
  /** Passed to the chat panel (default 600px). Use e.g. min(70vh, 720px) beside a PDF viewer. */
  height?: string | number;
  className?: string;
}

export function DocumentChatBox({ documentId, height = "600px", className }: DocumentChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const utils = trpc.useUtils();

  const { data: chatHistory, isLoading: historyLoading } = trpc.chat.history.useQuery({
    documentId,
  });

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
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
    onError: (error) => {
      toast.error(error.message || "Failed to get a response");
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  // Reset messages when documentId changes
  useEffect(() => {
    setMessages([]);
  }, [documentId]);

  // Initialize messages from chat history
  useEffect(() => {
    if (chatHistory) {
      // History is returned newest-first from DB, so we reverse it for display
      
      setMessages(chatHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [chatHistory]);

  const handleSendMessage = (message: string) => {
    // Add user message to local state
    setMessages((prev) => [
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
    });
  };

  return (
    <AIChatBox
      className={className}
      height={height}
      messages={messages}
      onSendMessage={handleSendMessage}
      isLoading={sendMessageMutation.isPending || historyLoading}
      placeholder="Ask the AI anything, or try /summary, /flashcards, /quiz …"
      emptyStateMessage="Ask questions about this document, or use AI commands: /summary, /flashcards 10, /quiz 5."
      suggestedPrompts={["/summary", "/flashcards 10", "/quiz 5"]}
    />
  );
}
