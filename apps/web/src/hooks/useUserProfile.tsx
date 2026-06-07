"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-shim";

export type UserRole = "admin" | "validator" | "nurse";

export interface UserProfile {
  id: number;
  email: string;
  role: UserRole;
  name: string | null;
  isActive: boolean;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        const response = await fetch("/api/user-profile");
        if (!response.ok) {
          if (response.status === 403) {
            const data = await response.json();
            setError(data.error || "Usuário aguardando aprovação do administrador");
          } else if (response.status === 404) {
            setError("Usuário não possui perfil cadastrado no sistema");
          } else {
            setError("Erro ao carregar perfil do usuário");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProfile(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setError("Erro ao carregar perfil do usuário");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user?.email]);

  return { profile, loading, error };
}
