import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export type RoleAssignment = {
  role: AppRole;
  tenant_id: string | null;
  /** مسار محدد تقتصر عليه صلاحيات هذا الدور (للنائبة الأكاديمية). null = كل المقرأة */
  track_id: string | null;
  /** حلقة محددة تقتصر عليها صلاحيات هذا الدور (للمعلمة/المشرفة). null = كل المقرأة */
  circle_id: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: RoleAssignment[];
  loading: boolean;
  isPlatformOwner: boolean;
  tenantRoles: (tenantId: string) => AppRole[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUserData(userId: string) {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone, avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, tenant_id, track_id, circle_id").eq("user_id", userId),
    ]);
    setProfile((profileRes.data as Profile) ?? null);
    setRoles((rolesRes.data as RoleAssignment[]) ?? []);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setTimeout(() => void loadUserData(nextSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadUserData(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    isPlatformOwner: roles.some((r) => r.role === "platform_owner"),
    tenantRoles: (tenantId) => roles.filter((r) => r.tenant_id === tenantId).map((r) => r.role),
    refresh: async () => {
      if (session?.user) await loadUserData(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth يجب أن يُستخدم داخل AuthProvider");
  return ctx;
}
