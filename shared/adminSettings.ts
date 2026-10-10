export const ADMIN_PERMISSIONS = [
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "courses.view",
  "courses.create",
  "courses.edit",
  "courses.delete",
  "documents.view",
  "documents.upload",
  "documents.delete",
  "quizzes.manage",
  "assignments.manage",
  "ai.configure",
  "system.configure",
  "audit.view",
  "backup.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<"admin" | "lecturer" | "user", AdminPermission[]> = {
  admin: [...ADMIN_PERMISSIONS],
  lecturer: [
    "courses.view",
    "courses.edit",
    "documents.view",
    "documents.upload",
    "quizzes.manage",
    "assignments.manage",
  ],
  user: ["courses.view", "documents.view"],
};

export const DEFAULT_SYSTEM_SETTINGS = {
  general: {
    systemName: "Course-Specific AI Learning Assistant",
    description: "AI-powered university learning platform",
    logoUrl: "",
    faviconUrl: "",
    defaultLanguage: "en",
    defaultTimezone: "UTC",
    dateFormat: "dd MMM yyyy",
    maintenanceMode: false,
  },
  appearance: {
    primaryColor: "#033c35",
    secondaryColor: "#10b981",
    theme: "light" as "light" | "dark",
    loginTagline: "Smarter learning. Brighter futures.",
    sidebarStyle: "solid" as "solid" | "soft",
  },
  notifications: {
    email: true,
    inApp: true,
    security: true,
    system: true,
    users: true,
    ai: true,
  },
  api: {
    version: "1.0",
    rateLimitPerMinute: 0,
  },
  academic: {
    academicYear: "2025/2026",
    semester: "First",
    faculties: "Computing, Education, Business",
    departments: "Computer Science, Information Systems",
    levels: "100, 200, 300, 400",
    creditHoursDefault: 3,
    passMark: 50,
    gradingSystem: "percentage",
    assessmentTypes: "Quiz, Assignment, Exam",
  },
  ai: {
    provider: "groq" as "groq",
    model: "",
    temperature: 0.3,
    maxTokens: 1024,
    rag: {
      chunkSize: 1500,
      chunkOverlap: 200,
      topK: 6,
      similarityThreshold: 0.2,
      maxContext: 4000,
    },
  },
  content: {
    maxUploadMb: 25,
    allowedTypes: "pdf,docx,pptx",
    autoIndex: true,
    courseVisibility: "assigned",
    enrollment: "code",
  },
  quizzes: {
    defaultDurationMinutes: 20,
    attemptLimit: 3,
    passingScore: 50,
    randomize: false,
    showResults: true,
  },
  assignments: {
    maxFileMb: 20,
    allowedTypes: "pdf,docx",
    lateSubmissions: true,
  },
  data: {
    userRetentionDays: 0,
    chatRetentionDays: 0,
    auditRetentionDays: 365,
    documentRetentionDays: 0,
  },
  features: {
    aiChat: true,
    documentQa: true,
    flashcards: true,
    quizGeneration: true,
    assignmentAssistance: true,
    studyPlanner: true,
    voiceInput: true,
    voiceOutput: true,
    summarization: true,
    mobile: true,
    beta: false,
    debugMode: false,
  },
  passwordPolicy: {
    minLength: 8,
  },
  /** Background study coach that checks on students without being asked. */
  autonomousAgent: {
    enabled: true,
    intervalHours: 4,
    maxStudentsPerSweep: 25,
    allowContentCreation: true,
  },
  rolePermissions: DEFAULT_ROLE_PERMISSIONS as Record<string, string[]>,
};

export type SystemSettings = typeof DEFAULT_SYSTEM_SETTINGS;

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const FILE_TYPES_RE = /^[a-z0-9]+(\s*,\s*[a-z0-9]+)*$/i;

function isUrlOrPath(value: string) {
  return value.startsWith("/") || /^https?:\/\/[^\s]+$/i.test(value);
}

/**
 * Range and format checks for the whole settings object. Returns the first
 * problem as a readable sentence, or null when everything is valid.
 */
export function findSystemSettingsError(s: SystemSettings): string | null {
  const text = (value: unknown, label: string, opts: { required?: boolean; max: number }) => {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) return opts.required ? `${label} is required.` : null;
    return v.length > opts.max ? `${label} must be at most ${opts.max} characters.` : null;
  };
  const num = (value: unknown, label: string, min: number, max: number, integer = true) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return `${label} must be a number.`;
    if (integer && !Number.isInteger(value)) return `${label} must be a whole number.`;
    if (value < min || value > max) return `${label} must be between ${min} and ${max}.`;
    return null;
  };
  const pattern = (value: unknown, label: string, re: RegExp, hint: string, required = true) => {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) return required ? `${label} is required.` : null;
    return re.test(v) ? null : `${label} ${hint}`;
  };
  const url = (value: unknown, label: string) => {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) return null;
    if (v.length > 2048) return `${label} is too long.`;
    return isUrlOrPath(v) ? null : `${label} must start with https:// or /.`;
  };

  const g = s.general;
  const a = s.appearance;
  const ac = s.academic;
  const ai = s.ai;
  const rag = ai.rag;
  const checks: Array<string | null> = [
    text(g.systemName, "System name", { required: true, max: 120 }),
    text(g.description, "Description", { max: 300 }),
    url(g.logoUrl, "Logo URL"),
    url(g.faviconUrl, "Favicon URL"),
    pattern(g.defaultLanguage, "Default language", LANGUAGE_RE, "should be a language code like en or en-GB."),
    text(g.defaultTimezone, "Default timezone", { required: true, max: 80 }),
    text(g.dateFormat, "Date format", { required: true, max: 40 }),
    pattern(a.primaryColor, "Primary color", HEX_COLOR_RE, "must be a hex color like #033c35."),
    pattern(a.secondaryColor, "Secondary color", HEX_COLOR_RE, "must be a hex color like #10b981."),
    text(a.loginTagline, "Login tagline", { max: 120 }),
    num(s.api.rateLimitPerMinute, "Rate limit per minute", 0, 10_000),
    text(ac.academicYear, "Academic year", { required: true, max: 40 }),
    text(ac.semester, "Semester", { max: 40 }),
    text(ac.faculties, "Faculties", { max: 500 }),
    text(ac.departments, "Departments", { max: 500 }),
    text(ac.levels, "Levels", { max: 200 }),
    num(ac.creditHoursDefault, "Default credit hours", 1, 20),
    num(ac.passMark, "Pass mark", 0, 100),
    text(ac.gradingSystem, "Grading system", { max: 40 }),
    text(ac.assessmentTypes, "Assessment types", { max: 300 }),
    text(ai.model, "Model", { max: 120 }),
    num(ai.temperature, "Temperature", 0, 2, false),
    num(ai.maxTokens, "Max output tokens", 64, 32_768),
    num(rag.chunkSize, "Chunk size", 200, 8000),
    num(rag.chunkOverlap, "Chunk overlap", 0, 2000),
    rag.chunkOverlap >= rag.chunkSize ? "Chunk overlap must be smaller than the chunk size." : null,
    num(rag.topK, "Top-K", 1, 50),
    num(rag.similarityThreshold, "Similarity threshold", 0, 1, false),
    num(rag.maxContext, "Max retrieved context", 500, 64_000),
    num(s.content.maxUploadMb, "Max upload size", 1, 500),
    pattern(s.content.allowedTypes, "Allowed document types", FILE_TYPES_RE, "should be a comma-separated list like pdf,docx,pptx."),
    num(s.quizzes.defaultDurationMinutes, "Default quiz duration", 1, 600),
    num(s.quizzes.attemptLimit, "Attempt limit", 0, 100),
    num(s.quizzes.passingScore, "Passing score", 0, 100),
    num(s.assignments.maxFileMb, "Max assignment file size", 1, 500),
    pattern(s.assignments.allowedTypes, "Allowed assignment types", FILE_TYPES_RE, "should be a comma-separated list like pdf,docx."),
    num(s.data.userRetentionDays, "User retention days", 0, 3650),
    num(s.data.chatRetentionDays, "Chat retention days", 0, 3650),
    num(s.data.auditRetentionDays, "Audit retention days", 0, 3650),
    num(s.data.documentRetentionDays, "Document retention days", 0, 3650),
    num(s.passwordPolicy.minLength, "Minimum password length", 8, 128),
    num(s.autonomousAgent.intervalHours, "Study coach interval", 1, 168),
    num(s.autonomousAgent.maxStudentsPerSweep, "Students per sweep", 1, 200),
  ];
  return checks.find(Boolean) ?? null;
}

export const SETTINGS_NAV = [
  {
    id: "account",
    label: "Account",
    items: [
      { id: "profile", label: "Profile" },
      { id: "preferences", label: "Preferences" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { id: "password", label: "Password & Authentication" },
      { id: "twofactor", label: "Two-Factor Authentication" },
      { id: "sessions", label: "Sessions" },
      { id: "security-logs", label: "Security Logs" },
    ],
  },
  {
    id: "access",
    label: "Users & Access",
    items: [
      { id: "users", label: "Users" },
      { id: "roles", label: "Roles" },
      { id: "permissions", label: "Permissions" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "general", label: "General" },
      { id: "appearance", label: "Appearance" },
      { id: "academic", label: "Academic" },
      { id: "sys-notifications", label: "Notifications" },
      { id: "maintenance", label: "Maintenance" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      { id: "ai-providers", label: "AI Providers" },
      { id: "models", label: "Models" },
      { id: "rag", label: "RAG Configuration" },
      { id: "ai-features", label: "AI Features" },
      { id: "autonomous-agent", label: "Autonomous Agent" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { id: "documents", label: "Documents" },
      { id: "courses", label: "Courses" },
      { id: "quizzes", label: "Quizzes" },
      { id: "assignments", label: "Assignments" },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      { id: "storage", label: "Storage" },
      { id: "backups", label: "Backups" },
      { id: "import-export", label: "Import / Export" },
      { id: "retention", label: "Data Retention" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      { id: "auth-int", label: "Authentication" },
      { id: "email", label: "Email" },
      { id: "storage-int", label: "Cloud Storage" },
      { id: "apis", label: "External APIs" },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    items: [
      { id: "audit", label: "Audit Logs" },
      { id: "health", label: "System Health" },
      { id: "activity", label: "Activity" },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    items: [
      { id: "flags", label: "Feature Flags" },
      { id: "api", label: "API" },
      { id: "developer", label: "Developer Settings" },
    ],
  },
] as const;
