"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Prioridades() {
  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Prioridades</h1>
          <p className="text-sm text-gray-500">Configuração de níveis de prioridade</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Em desenvolvimento</CardTitle>
            <CardDescription>Esta página estará disponível em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Aqui você poderá configurar as regras automáticas de classificação de prioridade.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
