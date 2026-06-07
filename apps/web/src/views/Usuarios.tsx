"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CheckCircle, XCircle, Pencil, Shield, Stethoscope, UserCog } from "lucide-react";

interface UserProfile {
  id: number;
  email: string;
  role: "admin" | "validator" | "nurse";
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

const roleLabels = {
  admin: "Administrador",
  validator: "Validador",
  nurse: "Enfermeiro",
};

const roleIcons = {
  admin: Shield,
  validator: Stethoscope,
  nurse: UserCog,
};

const roleColors = {
  admin: "bg-purple-100 text-purple-700 border-purple-300",
  validator: "bg-blue-100 text-blue-700 border-blue-300",
  nurse: "bg-green-100 text-green-700 border-green-300",
};

export default function Usuarios() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    role: "nurse" as "admin" | "validator" | "nurse",
    name: "",
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/user-profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error("Error fetching user profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/user-profiles/${editingId}` : "/api/user-profiles";
      const method = editingId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({ email: "", role: "nurse", name: "" });
        setShowForm(false);
        setEditingId(null);
        fetchProfiles();
      } else {
        const error = await res.json();
        alert(error.error || (editingId ? "Erro ao atualizar usuário" : "Erro ao adicionar usuário"));
      }
    } catch (error) {
      console.error("Error saving user profile:", error);
      alert(editingId ? "Erro ao atualizar usuário" : "Erro ao adicionar usuário");
    }
  };

  const startEdit = (profile: UserProfile) => {
    setFormData({
      email: profile.email,
      role: profile.role,
      name: profile.name || "",
    });
    setEditingId(profile.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setFormData({ email: "", role: "nurse", name: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const toggleActive = async (id: number) => {
    try {
      const res = await fetch(`/api/user-profiles/${id}/toggle`, {
        method: "PATCH",
      });

      if (res.ok) {
        fetchProfiles();
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const deleteProfile = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) {
      return;
    }

    try {
      const res = await fetch(`/api/user-profiles/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchProfiles();
      }
    } catch (error) {
      console.error("Error deleting user profile:", error);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando usuários...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Usuários</h1>
              <p className="text-slate-600">Gerencie os usuários e perfis de acesso do sistema</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </div>

          {showForm && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</CardTitle>
                <CardDescription>
                  {editingId ? "Edite os dados do usuário" : "Adicione um novo usuário ao sistema"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome do usuário"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="usuario@exemplo.com"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        O usuário deve fazer login com este e-mail
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="role">Perfil de Acesso *</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value: "admin" | "validator" | "nurse") =>
                          setFormData({ ...formData, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nurse">
                            <div className="flex items-center gap-2">
                              <UserCog className="h-4 w-4" />
                              Enfermeiro - Apenas Dashboard
                            </div>
                          </SelectItem>
                          <SelectItem value="validator">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4" />
                              Validador - Dashboard e Fila de Validação
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Administrador - Acesso Total
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">{editingId ? "Salvar" : "Adicionar"}</Button>
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Usuários Cadastrados</CardTitle>
              <CardDescription>
                Total de {profiles.length} usuário{profiles.length !== 1 ? "s" : ""} cadastrado{profiles.length !== 1 ? "s" : ""} 
                {profiles.filter(p => !p.isActive).length > 0 && (
                  <span className="ml-2 text-orange-600 font-medium">
                    ({profiles.filter(p => !p.isActive).length} aguardando aprovação)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum usuário cadastrado
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Show inactive users first */}
                  {profiles.filter(p => !p.isActive).map((profile) => {
                    const RoleIcon = roleIcons[profile.role];
                    return (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border-2 border-orange-300 bg-orange-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900">
                              {profile.name || profile.email}
                            </h3>
                            <Badge className="bg-orange-500">Aguardando Aprovação</Badge>
                          </div>
                          {profile.name && (
                            <p className="text-sm text-slate-600 mb-1">{profile.email}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-md border ${roleColors[profile.role]}`}>
                              <RoleIcon className="h-4 w-4" />
                              <span className="text-sm font-medium">{roleLabels[profile.role]}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(profile)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => toggleActive(profile.id)}
                            title="Aprovar Acesso"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProfile(profile.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Then show active users */}
                  {profiles.filter(p => p.isActive).map((profile) => {
                    const RoleIcon = roleIcons[profile.role];
                    return (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900">
                              {profile.name || profile.email}
                            </h3>
                            {profile.isActive ? (
                              <Badge className="bg-green-600">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                          {profile.name && (
                            <p className="text-sm text-slate-600 mb-1">{profile.email}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-md border ${roleColors[profile.role]}`}>
                              <RoleIcon className="h-4 w-4" />
                              <span className="text-sm font-medium">{roleLabels[profile.role]}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(profile)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(profile.id)}
                            title={profile.isActive ? "Desativar" : "Ativar"}
                          >
                            {profile.isActive ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteProfile(profile.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
