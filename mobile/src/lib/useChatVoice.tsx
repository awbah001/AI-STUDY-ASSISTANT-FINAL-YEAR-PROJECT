import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Speech from "expo-speech";
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { API_URL, getToken } from "./api";

function stripForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function speechChunks(text: string): string[] {
  const clean = stripForSpeech(text);
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let buffer = "";
  for (const part of parts) {
    const next = `${buffer}${part}`.trim();
    if (next.length > 220 && buffer) {
      chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer = `${buffer} ${part}`;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.filter(Boolean);
}

const RECORDING_OPTIONS = {
  extension: Platform.OS === "ios" ? ".wav" : ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: ".m4a",
    outputFormat: "mpeg4" as const,
    audioEncoder: "aac" as const,
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

async function setPlaybackMode() {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "mixWithOthers",
  });
}

async function setRecordingMode() {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
  });
}

async function transcribeRecording(uri: string, mimeType: string): Promise<string> {
  const audioBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const token = await getToken();
  const response = await fetch(`${API_URL}/api/voice/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok || !payload.text?.trim()) {
    throw new Error(payload.error || "Could not convert speech to text.");
  }
  return payload.text.trim();
}

async function listenWithAndroidSpeech(): Promise<"unavailable" | string | null> {
  if (Platform.OS !== "android") return "unavailable";
  try {
    const result = await IntentLauncher.startActivityAsync("android.speech.action.RECOGNIZE_SPEECH", {
      extra: {
        "android.speech.extra.LANGUAGE_MODEL": "free_form",
        "android.speech.extra.PROMPT": "Ask Cognify",
        "android.speech.extra.LANGUAGE": "en-US",
        "android.speech.extra.MAX_RESULTS": 1,
      },
    });
    const extra = (result.extra ?? {}) as Record<string, unknown>;
    const results =
      (extra["android.speech.extra.RESULTS"] as string[] | undefined) ??
      (extra.android_speech_extra_RESULTS as string[] | undefined) ??
      (Array.isArray(extra.results) ? (extra.results as string[]) : undefined);
    const text = results?.[0]?.trim();
    return text || null;
  } catch {
    return "unavailable";
  }
}

export function useChatVoice(onTranscript: (text: string) => void) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const cancelledSpeakRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    cancelledSpeakRef.current = true;
    Speech.stop();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (muted) return;
      const chunks = speechChunks(text);
      if (!chunks.length) return;
      cancelledSpeakRef.current = false;
      try {
        await setPlaybackMode();
        const voices = await Speech.getAvailableVoicesAsync();
        const english = voices.find((voice) => voice.language?.toLowerCase().startsWith("en"));
        Speech.stop();
        setSpeaking(true);
        const play = (index: number) => {
          if (cancelledSpeakRef.current) {
            setSpeaking(false);
            return;
          }
          if (index >= chunks.length) {
            setSpeaking(false);
            return;
          }
          Speech.speak(chunks[index], {
            language: english?.language ?? "en-US",
            voice: english?.identifier,
            pitch: 1,
            rate: Platform.OS === "ios" ? 0.5 : 0.95,
            onDone: () => play(index + 1),
            onStopped: () => {
              if (cancelledSpeakRef.current) setSpeaking(false);
            },
            onError: () => play(index + 1),
          });
        };
        play(0);
      } catch (error) {
        setSpeaking(false);
        Alert.alert(
          "Voice output",
          error instanceof Error
            ? error.message
            : "Could not read the reply aloud. Check the phone volume and silent switch."
        );
      }
    },
    [muted]
  );

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      if (next) {
        cancelledSpeakRef.current = true;
        Speech.stop();
        setSpeaking(false);
      }
      return next;
    });
  }, []);

  const finishRecording = useCallback(async () => {
    try {
      await recorder.stop();
      await setPlaybackMode();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording was captured.");
      const mimeType = Platform.OS === "ios" ? "audio/wav" : "audio/m4a";
      const text = await transcribeRecording(uri, mimeType);
      onTranscriptRef.current(text);
    } catch (error) {
      Alert.alert(
        "Microphone",
        error instanceof Error ? error.message : "Could not convert speech to text. Type your question instead."
      );
    } finally {
      setListening(false);
    }
  }, [recorder]);

  const stopListening = useCallback(() => {
    void finishRecording();
  }, [finishRecording]);

  const startRecording = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microphone", "Allow microphone access so you can ask questions by voice.");
      return;
    }
    await setRecordingMode();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setListening(true);
  }, [recorder]);

  const toggleListening = useCallback(async () => {
    if (listening || recorder.isRecording) {
      await finishRecording();
      return;
    }
    stopSpeaking();
    const androidText = await listenWithAndroidSpeech();
    if (androidText && androidText !== "unavailable") {
      onTranscriptRef.current(androidText);
      return;
    }
    if (androidText === null) return;
    try {
      await startRecording();
    } catch (error) {
      setListening(false);
      void setPlaybackMode();
      Alert.alert(
        "Microphone",
        error instanceof Error ? error.message : "Could not start the microphone in Expo Go."
      );
    }
  }, [finishRecording, listening, recorder.isRecording, startRecording, stopSpeaking]);

  useEffect(
    () => () => {
      cancelledSpeakRef.current = true;
      Speech.stop();
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
      void setPlaybackMode();
    },
    [recorder]
  );

  return {
    listening,
    speaking,
    muted,
    usingWebSpeech: false,
    speak,
    stopSpeaking,
    toggleMute,
    toggleListening,
    stopListening,
    handleWebMessage: (_raw: string) => undefined,
  };
}

export function VoiceCapture(_props: {
  listening: boolean;
  usingWebSpeech: boolean;
  onMessage: (raw: string) => void;
}) {
  return null;
}
