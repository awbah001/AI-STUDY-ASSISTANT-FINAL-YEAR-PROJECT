export type AppRole = "user" | "lecturer" | "admin";

export function homeForRole(role: string | null | undefined) {
  if (role === "admin") return "/admin" as const;
  if (role === "lecturer") return "/lecturer" as const;
  return "/(tabs)/dashboard" as const;
}

export function roleLabel(role: string | null | undefined) {
  if (role === "admin") return "Administrator";
  if (role === "lecturer") return "Lecturer";
  return "Student";
}
