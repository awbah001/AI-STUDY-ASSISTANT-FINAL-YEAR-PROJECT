export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** Used by non-LLM Forge helpers (storage/maps/notifications) when configured. */
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** Groq Cloud — sole LLM provider (OpenAI-compatible API). */
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqBaseUrl: (process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/$/, ""),
  /** Default: openai/gpt-oss-20b — override with GROQ_MODEL. */
  groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
  /** Speech-to-text model used for voice input. */
  groqSttModel: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
  groqTimeoutMs: Math.max(
    5_000,
    Number(process.env.GROQ_TIMEOUT_MS ?? "60000") || 60_000
  ),
  googleClientIds: [
    ...(process.env.GOOGLE_CLIENT_IDS ?? "").split(","),
    process.env.GOOGLE_CLIENT_ID,
    process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  ]
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id)),
};
