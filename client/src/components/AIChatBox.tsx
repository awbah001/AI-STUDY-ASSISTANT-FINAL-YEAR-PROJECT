import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Mic,
  Send,
  Sparkles,
  Square,
  User,
  Volume2,
  Volume1,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { LIMITS } from "@shared/validation";
import {
  startRecording,
  transcribeRecording,
  voiceInputBlockedReason,
  type ActiveRecording,
} from "@/lib/voiceInput";

/** Errors where the browser's speech service is unusable but recording + server transcription still works. */
const RECOGNITION_FALLBACK_ERRORS = new Set(["network", "service-not-allowed", "language-not-supported"]);

function joinDictation(base: string, spoken: string) {
  return [base.trimEnd(), spoken.trim()].filter(Boolean).join(" ");
}

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const hasAnnouncedSynthesisUnavailableRef = useRef(false);
  const speakingMessageIndexRef = useRef<number | null>(null);
  const inputValueRef = useRef("");
  const dictationBaseRef = useRef("");
  const recordingRef = useRef<ActiveRecording | null>(null);
  const preferRecorderRef = useRef(false);
  const startRecorderRef = useRef<() => Promise<void>>(async () => undefined);
  const finishRecordingRef = useRef<() => Promise<void>>(async () => undefined);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      // Note: margin-bottom is not counted because it naturally pushes the assistant message down
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setSpeechSynthesisSupported("speechSynthesis" in window);

    const RecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionClass) return;

    const recognition = new RecognitionClass();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    // Words appear in the box as they are spoken; the student reviews them and presses send.
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setInput(joinDictation(dictationBaseRef.current, transcript));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (RECOGNITION_FALLBACK_ERRORS.has(event.error)) {
        preferRecorderRef.current = true;
        void startRecorderRef.current();
      } else if (event.error === "not-allowed") {
        toast.error("Microphone permission denied. Allow microphone access in your browser's address bar.");
      } else if (event.error === "no-speech") {
        toast.error("No speech detected. Please try again.");
      } else if (event.error === "audio-capture") {
        toast.error("No microphone was found. Check that one is connected.");
      } else if (event.error !== "aborted") {
        toast.error("Speech recognition failed. Please try again.");
      }
    };

    recognition.onend = () => {
      if (!recordingRef.current) setIsListening(false);
      textareaRef.current?.focus();
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(
    () => () => {
      void recordingRef.current?.stop();
      recordingRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      if (!selectedVoiceURI && voices.length > 0) {
        const preferredVoice =
          voices.find((voice) => voice.lang.toLowerCase().startsWith("en-us")) ??
          voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
          voices[0];
        setSelectedVoiceURI(preferredVoice.voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoiceURI]);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || isTranscribing) return;
    if (trimmedInput.length > LIMITS.chatMessage) {
      toast.error(`Messages can be up to ${LIMITS.chatMessage.toLocaleString()} characters. Shorten it or split it into two questions.`);
      return;
    }

    if (isListening) handleStopListening();
    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const speakText = (text: string, messageIndex?: number) => {
    if (!text.trim()) return;

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechSynthesisSupported(false);
      if (!hasAnnouncedSynthesisUnavailableRef.current) {
        toast.error("Speech synthesis is unavailable in this browser.");
        hasAnnouncedSynthesisUnavailableRef.current = true;
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (selectedVoiceURI) {
      const selectedVoice = availableVoices.find(
        (voice) => voice.voiceURI === selectedVoiceURI
      );
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || utterance.lang;
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      const resolvedIndex = typeof messageIndex === "number" ? messageIndex : null;
      setSpeakingMessageIndex(resolvedIndex);
      speakingMessageIndexRef.current = resolvedIndex;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
      speakingMessageIndexRef.current = null;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
      speakingMessageIndexRef.current = null;
      toast.error("Speech playback failed.");
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingMessageIndex(null);
    speakingMessageIndexRef.current = null;
  };

  const finishRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsListening(false);
    setIsTranscribing(true);
    try {
      const blob = await recording.stop();
      if (blob.size < 1000) throw new Error("No speech detected. Please try again.");
      const text = await transcribeRecording(blob);
      setInput(joinDictation(inputValueRef.current, text));
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert speech to text.");
    } finally {
      setIsTranscribing(false);
    }
  };
  finishRecordingRef.current = finishRecording;

  const startRecorderInput = async () => {
    const blocked = voiceInputBlockedReason();
    if (blocked) {
      toast.error(blocked);
      setIsListening(false);
      return;
    }
    try {
      recordingRef.current = await startRecording(() => void finishRecordingRef.current());
      setIsListening(true);
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      toast.error(
        denied
          ? "Microphone permission denied. Allow microphone access in your browser's address bar."
          : "Could not start the microphone. Check that one is connected."
      );
      setIsListening(false);
    }
  };
  startRecorderRef.current = startRecorderInput;

  const handleStartListening = () => {
    if (isListening || isTranscribing) return;
    stopSpeaking();

    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error(voiceInputBlockedReason() ?? "Voice input needs a secure connection.");
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition || preferRecorderRef.current) {
      void startRecorderInput();
      return;
    }

    dictationBaseRef.current = inputValueRef.current;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      void startRecorderInput();
    }
  };

  const handleStopListening = () => {
    if (recordingRef.current) {
      void finishRecording();
      return;
    }
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div className="max-w-[80%]">
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2.5",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <Streamdown>{message.content}</Streamdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </p>
                        )}
                      </div>
                      {message.role === "assistant" && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {isSpeaking && speakingMessageIndex === index ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-primary animate-pulse">
                                <Volume1 className="size-3.5" />
                                Playing...
                              </span>
                              <button
                                type="button"
                                onClick={stopSpeaking}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
                                title="Stop playback"
                              >
                                <Square className="size-3" />
                                Stop
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => speakText(message.content, index)}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
                              disabled={!speechSynthesisSupported}
                              title="Read this answer aloud"
                            >
                              <Volume2 className="size-3.5" />
                              Listen
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t bg-background/50 items-end"
      >
        <div className="flex flex-col gap-1 items-center">
          <Button
            type="button"
            variant={isListening ? "destructive" : "secondary"}
            size="icon"
            onClick={isListening ? handleStopListening : handleStartListening}
            className={cn(
              "shrink-0 rounded-full h-[38px] w-[38px] transition-all duration-200",
              isListening ? "animate-pulse shadow-lg shadow-destructive/30" : "hover:scale-105"
            )}
            disabled={isTranscribing}
            title={isListening ? "Stop and use what I said" : "Speak your question"}
          >
            {isTranscribing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isListening ? (
              <Square className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
          </Button>
          <span
            className={cn(
              "text-[11px] text-muted-foreground transition-opacity duration-200",
              isListening || isTranscribing ? "opacity-100" : "opacity-0"
            )}
          >
            {isTranscribing ? "Converting..." : "Listening..."}
          </span>
        </div>

        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening ? "Speak now — your words will appear here..." : placeholder
            }
            maxLength={LIMITS.chatMessage}
            aria-invalid={input.length > LIMITS.chatMessage}
            className="max-h-32 resize-none min-h-9"
            rows={1}
          />
          {input.length > LIMITS.chatMessage * 0.8 && (
            <span
              className={cn(
                "pointer-events-none absolute bottom-1 right-2 text-[10px]",
                input.length > LIMITS.chatMessage ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {input.length}/{LIMITS.chatMessage}
            </span>
          )}
        </div>
        {isSpeaking && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stopSpeaking}
            className="h-[38px] transition-all duration-200"
            title="Stop voice output"
          >
            <Square className="size-3.5" />
            Stop voice
          </Button>
        )}
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
