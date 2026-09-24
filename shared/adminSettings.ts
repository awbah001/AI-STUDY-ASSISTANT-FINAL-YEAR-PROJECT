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
    systemName: "Cognify",
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
    provider: "lmstudio" as "lmstudio" | "gemini" | "openai",
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
  rolePermissions: DEFAULT_ROLE_PERMISSIONS as Record<string, string[]>,
};

export type SystemSettings = typeof DEFAULT_SYSTEM_SETTINGS;

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
