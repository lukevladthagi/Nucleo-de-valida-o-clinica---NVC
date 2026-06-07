"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Auditoria() {
  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Auditoria</h1>
          <p className="text-sm text-gray-500">Registro de ações e histórico do sistema</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Em desenvolvimento</CardTitle>
            <CardDescription>Esta página estará disponível em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Aqui você poderá visualizar o histórico completo de ações realizadas no sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
