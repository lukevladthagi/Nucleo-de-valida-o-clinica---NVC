"use client";

import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Criterios() {
  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Critérios</h1>
          <p className="text-sm text-gray-500">Critérios clínicos de internação</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Em desenvolvimento</CardTitle>
            <CardDescription>Esta página estará disponível em breve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Aqui você poderá configurar os critérios clínicos para aprovação de internações.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
