import { useAuth } from "@/_core/hooks/useAuth";
import { getDashboardPathForRole } from "@shared/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function useRoleGuard(allowedRole: string) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (user.role !== allowedRole) {
      setLocation(getDashboardPathForRole(user.role));
    }
  }, [user, loading, allowedRole, setLocation]);

  return { user, loading, isAllowed: user?.role === allowedRole };
}
