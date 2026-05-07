export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** When true (default), chat/embeddings use LM Studio OpenAI-compatible API at lmStudioBaseUrl. */
  useLocalLlm: process.env.USE_LOCAL_LLM !== "false",
  /** OpenAI-compatible base URL (include /v1), e.g. http://127.0.0.1:1234/v1 */
  lmStudioBaseUrl: (process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1").replace(/\/$/, ""),
  /** Must match the model name shown in LM Studio (or use a placeholder if the server ignores it). */
  lmStudioModel: process.env.LM_STUDIO_MODEL ?? "local-model",
};
