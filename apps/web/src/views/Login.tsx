"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Lock, Mail, UserPlus } from "lucide-react";

type Mode = "signin" | "signup" | "reset";

function getFriendlyError(message?: string | null) {
  const text = String(message || "").toLowerCase();
  if (text.includes("invalid") || text.includes("password")) {
    return "E-mail ou senha inválidos.";
  }
  if (text.includes("already") || text.includes("exists")) {
    return "Este e-mail já possui conta. Use Entrar.";
  }
  return message || "Não foi possível concluir a operação.";
}

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setPassword("");
    setConfirmPassword("");
    setRecoveryCode("");
  };

  const ensureUserProfile = async () => {
    const response = await fetch("/api/user-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: name || email.split("@")[0],
        role: "nurse",
      }),
    });

    if (!response.ok && response.status !== 409) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Erro ao criar perfil do usuário.");
    }
  };

  const handlePasswordReset = async () => {
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    const response = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        recoveryCode,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Erro ao redefinir senha.");
    }

    setSuccess("Senha redefinida com sucesso. Você já pode entrar com a nova senha.");
    setMode("signin");
    setPassword("");
    setConfirmPassword("");
    setRecoveryCode("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isReset) {
        await handlePasswordReset();
        setLoading(false);
        return;
      }

      if (isSignup) {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });

        if (signUpError) {
          setError(getFriendlyError(signUpError.message));
          setLoading(false);
          return;
        }

        await ensureUserProfile();
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        });

        if (signInError) {
          setError(getFriendlyError(signInError.message));
          setLoading(false);
          return;
        }
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.message || "Erro ao acessar o sistema.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-xl">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex justify-center">
            <img
              src="https://dtvoeevhaseb5.cloudfront.net/uploads/mocha-import/35ca4676-1cfd-4f0a-a77f-097229f6f74d/f362c8ab-33bf-490a-a504-54ce9635b9ae.png"
              alt="Núcleo de Validação Clínica"
              className="h-20"
            />
          </div>
          <CardDescription className="text-base">
            Área restrita para médicos validadores, enfermagem e administradores
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-5 grid grid-cols-3 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => changeMode("signin")}
              className={`h-10 rounded-full text-sm font-semibold transition ${
                mode === "signin" ? "bg-[#0D3473] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => changeMode("signup")}
              className={`h-10 rounded-full text-sm font-semibold transition ${
                isSignup ? "bg-[#0D3473] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Criar
            </button>
            <button
              type="button"
              onClick={() => changeMode("reset")}
              className={`h-10 rounded-full text-sm font-semibold transition ${
                isReset ? "bg-[#0D3473] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Recuperar
            </button>
          </div>

          {isReset && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-[#0D3473]">
              Use o código de recuperação fornecido pela TI para definir uma nova senha.
            </div>
          )}

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nome do colaborador"
                    className="h-11 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
                  placeholder="usuario@hospitalprontocardio.com.br"
                  className="h-11 rounded-xl pl-10"
                  required
                />
              </div>
            </div>

            {isReset && (
              <div className="space-y-2">
                <Label htmlFor="recoveryCode">Código de recuperação</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="recoveryCode"
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                    placeholder="Código informado pela TI"
                    className="h-11 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{isReset ? "Nova senha" : "Senha"}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isReset ? "Digite a nova senha" : "Digite sua senha"}
                  className="h-11 rounded-xl pl-10 pr-10"
                  minLength={isSignup || isReset ? 8 : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isReset && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  className="h-11 rounded-xl"
                  minLength={8}
                  required
                />
              </div>
            )}

            {!isReset && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => changeMode("reset")}
                  className="text-sm font-semibold text-[#0D3473] hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {success}
              </div>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl bg-[#0D3473] text-white hover:bg-[#09285a]" disabled={loading}>
              {loading ? "Aguarde..." : isReset ? "Redefinir senha" : isSignup ? "Criar usuário" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
