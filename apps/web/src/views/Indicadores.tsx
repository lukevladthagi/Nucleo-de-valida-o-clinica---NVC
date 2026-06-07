"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Indicadores() {
  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Indicadores</h1>
          <p className="text-sm text-gray-500">Métricas e indicadores de desempenho</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Em desenvolvimento</CardTitle>
            <CardDescription>Esta página estará disponível em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Aqui você poderá visualizar indicadores de desempenho do sistema de regulação.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
