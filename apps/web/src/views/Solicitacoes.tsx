"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Solicitacoes() {
  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Solicitações</h1>
          <p className="text-sm text-gray-500">Histórico completo de solicitações de internação</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Em desenvolvimento</CardTitle>
            <CardDescription>Esta página estará disponível em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Aqui você poderá visualizar e filtrar todas as solicitações de internação.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
