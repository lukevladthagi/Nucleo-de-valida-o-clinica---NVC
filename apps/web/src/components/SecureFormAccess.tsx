"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle } from "lucide-react";
import RequestForm from "@/views/RequestForm";

export default function SecureFormAccess() {
  const [accessCode, setAccessCode] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if already validated in session
  useEffect(() => {
    const validated = sessionStorage.getItem("form_access_validated");
    if (validated === "true") {
      setIsValidated(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/validate-form-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });

      const data = await response.json();

      if (data.valid) {
        sessionStorage.setItem("form_access_validated", "true");
        setIsValidated(true);
      } else {
        setError("Código de acesso inválido");
        setAccessCode("");
      }
    } catch (err) {
      setError("Erro ao validar código de acesso");
    } finally {
      setLoading(false);
    }
  };

  if (isValidated) {
    return <RequestForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
          <CardDescription>
            Digite o código de acesso para acessar o formulário de solicitação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessCode">Código de Acesso</Label>
              <Input
                id="accessCode"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Digite o código"
                required
                autoFocus
                className="text-center text-lg tracking-wider"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !accessCode}>
              {loading ? "Validando..." : "Acessar Formulário"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
            <p>Núcleo de Validação Clínica</p>
            <p className="text-xs mt-1">Protocolo Digital de Pré-Internação</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
