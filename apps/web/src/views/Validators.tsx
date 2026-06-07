"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageLayout from "@/components/PageLayout";
import { Plus, Trash2, CheckCircle, XCircle, Mail, MessageSquare, Send, Pencil } from "lucide-react";

interface Validator {
  id: number;
  name: string;
  crm: string;
  email: string;
  phone: string | null;
  telegram_chat_id: string | null;
  is_active: number;
  notification_email: number;
  notification_whatsapp: number;
  notification_telegram: number;
}

interface Nurse {
  id: number;
  name: string;
  coren: string;
  email: string;
  phone: string | null;
  telegram_chat_id: string | null;
  is_active: number;
  notification_email: number;
  notification_whatsapp: number;
  notification_telegram: number;
}

interface Requester {
  id: number;
  name: string;
  crm: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  telegram_chat_id: string | null;
  is_active: number;
  notification_email: number;
  notification_whatsapp: number;
  notification_telegram: number;
}

export default function Validators() {
  // Validators state
  const [validators, setValidators] = useState<Validator[]>([]);
  const [showValidatorForm, setShowValidatorForm] = useState(false);
  const [editingValidatorId, setEditingValidatorId] = useState<number | null>(null);
  const [validatorFormData, setValidatorFormData] = useState({
    name: "",
    crm: "",
    email: "",
    phone: "",
    telegram_chat_id: "",
  });

  // Nurses state
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [showNurseForm, setShowNurseForm] = useState(false);
  const [editingNurseId, setEditingNurseId] = useState<number | null>(null);
  const [nurseFormData, setNurseFormData] = useState({
    name: "",
    coren: "",
    email: "",
    phone: "",
    telegram_chat_id: "",
  });

  // Requesters state
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [showRequesterForm, setShowRequesterForm] = useState(false);
  const [editingRequesterId, setEditingRequesterId] = useState<number | null>(null);
  const [requesterFormData, setRequesterFormData] = useState({
    name: "",
    crm: "",
    email: "",
    phone: "",
    specialty: "",
    telegram_chat_id: "",
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    await Promise.all([
      fetchValidators(),
      fetchNurses(),
      fetchRequesters(),
    ]);
    setLoading(false);
  };

  // Validators functions
  const fetchValidators = async () => {
    try {
      const res = await fetch("/api/validators");
      if (res.ok) {
        const data = await res.json();
        setValidators(data);
      }
    } catch (error) {
      console.error("Error fetching validators:", error);
    }
  };

  const handleValidatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingValidatorId ? `/api/validators/${editingValidatorId}` : "/api/validators";
      const method = editingValidatorId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatorFormData),
      });

      if (res.ok) {
        setValidatorFormData({ name: "", crm: "", email: "", phone: "", telegram_chat_id: "" });
        setShowValidatorForm(false);
        setEditingValidatorId(null);
        fetchValidators();
      } else {
        alert(editingValidatorId ? "Erro ao atualizar validador" : "Erro ao adicionar validador");
      }
    } catch (error) {
      console.error("Error saving validator:", error);
      alert(editingValidatorId ? "Erro ao atualizar validador" : "Erro ao adicionar validador");
    }
  };

  const startEditValidator = (validator: Validator) => {
    setValidatorFormData({
      name: validator.name,
      crm: validator.crm,
      email: validator.email,
      phone: validator.phone || "",
      telegram_chat_id: validator.telegram_chat_id || "",
    });
    setEditingValidatorId(validator.id);
    setShowValidatorForm(true);
  };

  const cancelEditValidator = () => {
    setValidatorFormData({ name: "", crm: "", email: "", phone: "", telegram_chat_id: "" });
    setShowValidatorForm(false);
    setEditingValidatorId(null);
  };

  const toggleValidatorActive = async (id: number) => {
    try {
      const res = await fetch(`/api/validators/${id}/toggle`, { method: "PATCH" });
      if (res.ok) fetchValidators();
    } catch (error) {
      console.error("Error toggling validator:", error);
    }
  };

  const deleteValidator = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este validador?")) return;
    try {
      const res = await fetch(`/api/validators/${id}`, { method: "DELETE" });
      if (res.ok) fetchValidators();
    } catch (error) {
      console.error("Error deleting validator:", error);
    }
  };

  const toggleValidatorNotification = async (id: number, channel: string) => {
    try {
      const res = await fetch(`/api/validators/${id}/notification/${channel}`, { method: "PATCH" });
      if (res.ok) fetchValidators();
    } catch (error) {
      console.error("Error toggling notification:", error);
    }
  };

  // Nurses functions
  const fetchNurses = async () => {
    try {
      const res = await fetch("/api/nurses");
      if (res.ok) {
        const data = await res.json();
        setNurses(data);
      }
    } catch (error) {
      console.error("Error fetching nurses:", error);
    }
  };

  const handleNurseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingNurseId ? `/api/nurses/${editingNurseId}` : "/api/nurses";
      const method = editingNurseId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nurseFormData),
      });

      if (res.ok) {
        setNurseFormData({ name: "", coren: "", email: "", phone: "", telegram_chat_id: "" });
        setShowNurseForm(false);
        setEditingNurseId(null);
        fetchNurses();
      } else {
        alert(editingNurseId ? "Erro ao atualizar enfermeiro" : "Erro ao adicionar enfermeiro");
      }
    } catch (error) {
      console.error("Error saving nurse:", error);
      alert(editingNurseId ? "Erro ao atualizar enfermeiro" : "Erro ao adicionar enfermeiro");
    }
  };

  const startEditNurse = (nurse: Nurse) => {
    setNurseFormData({
      name: nurse.name,
      coren: nurse.coren,
      email: nurse.email,
      phone: nurse.phone || "",
      telegram_chat_id: nurse.telegram_chat_id || "",
    });
    setEditingNurseId(nurse.id);
    setShowNurseForm(true);
  };

  const cancelEditNurse = () => {
    setNurseFormData({ name: "", coren: "", email: "", phone: "", telegram_chat_id: "" });
    setShowNurseForm(false);
    setEditingNurseId(null);
  };

  const toggleNurseActive = async (id: number) => {
    try {
      const res = await fetch(`/api/nurses/${id}/toggle`, { method: "PATCH" });
      if (res.ok) fetchNurses();
    } catch (error) {
      console.error("Error toggling nurse:", error);
    }
  };

  const deleteNurse = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este enfermeiro?")) return;
    try {
      const res = await fetch(`/api/nurses/${id}`, { method: "DELETE" });
      if (res.ok) fetchNurses();
    } catch (error) {
      console.error("Error deleting nurse:", error);
    }
  };

  const toggleNurseNotification = async (id: number, channel: string) => {
    try {
      const res = await fetch(`/api/nurses/${id}/notification/${channel}`, { method: "PATCH" });
      if (res.ok) fetchNurses();
    } catch (error) {
      console.error("Error toggling notification:", error);
    }
  };

  // Requesters functions
  const fetchRequesters = async () => {
    try {
      const res = await fetch("/api/requesters");
      if (res.ok) {
        const data = await res.json();
        setRequesters(data);
      }
    } catch (error) {
      console.error("Error fetching requesters:", error);
    }
  };

  const handleRequesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRequesterId ? `/api/requesters/${editingRequesterId}` : "/api/requesters";
      const method = editingRequesterId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requesterFormData),
      });

      if (res.ok) {
        setRequesterFormData({ name: "", crm: "", email: "", phone: "", specialty: "", telegram_chat_id: "" });
        setShowRequesterForm(false);
        setEditingRequesterId(null);
        fetchRequesters();
      } else {
        alert(editingRequesterId ? "Erro ao atualizar solicitante" : "Erro ao adicionar solicitante");
      }
    } catch (error) {
      console.error("Error saving requester:", error);
      alert(editingRequesterId ? "Erro ao atualizar solicitante" : "Erro ao adicionar solicitante");
    }
  };

  const startEditRequester = (requester: Requester) => {
    setRequesterFormData({
      name: requester.name,
      crm: requester.crm,
      email: requester.email,
      phone: requester.phone || "",
      specialty: requester.specialty || "",
      telegram_chat_id: requester.telegram_chat_id || "",
    });
    setEditingRequesterId(requester.id);
    setShowRequesterForm(true);
  };

  const cancelEditRequester = () => {
    setRequesterFormData({ name: "", crm: "", email: "", phone: "", specialty: "", telegram_chat_id: "" });
    setShowRequesterForm(false);
    setEditingRequesterId(null);
  };

  const toggleRequesterActive = async (id: number) => {
    try {
      const res = await fetch(`/api/requesters/${id}/toggle`, { method: "PATCH" });
      if (res.ok) fetchRequesters();
    } catch (error) {
      console.error("Error toggling requester:", error);
    }
  };

  const deleteRequester = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este solicitante?")) return;
    try {
      const res = await fetch(`/api/requesters/${id}`, { method: "DELETE" });
      if (res.ok) fetchRequesters();
    } catch (error) {
      console.error("Error deleting requester:", error);
    }
  };

  const toggleRequesterNotification = async (id: number, channel: string) => {
    try {
      const res = await fetch(`/api/requesters/${id}/notification/${channel}`, { method: "PATCH" });
      if (res.ok) fetchRequesters();
    } catch (error) {
      console.error("Error toggling notification:", error);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Equipe de Regulação</h1>
            <p className="text-slate-600">Gerencie validadores, enfermeiros e solicitantes do sistema</p>
          </div>

          <Tabs defaultValue="validators" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="validators">Validadores</TabsTrigger>
              <TabsTrigger value="nurses">Enfermeiros</TabsTrigger>
              <TabsTrigger value="requesters">Solicitantes</TabsTrigger>
            </TabsList>

            {/* VALIDATORS TAB */}
            <TabsContent value="validators">
              <div className="mb-4 flex justify-end">
                <Button onClick={() => setShowValidatorForm(!showValidatorForm)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Validador
                </Button>
              </div>

              {showValidatorForm && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>{editingValidatorId ? "Editar Validador" : "Novo Validador"}</CardTitle>
                    <CardDescription>
                      {editingValidatorId ? "Edite os dados do médico validador" : "Adicione um novo médico validador"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleValidatorSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="validator-name">Nome Completo *</Label>
                          <Input
                            id="validator-name"
                            value={validatorFormData.name}
                            onChange={(e) => setValidatorFormData({ ...validatorFormData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="validator-crm">CRM *</Label>
                          <Input
                            id="validator-crm"
                            value={validatorFormData.crm}
                            onChange={(e) => setValidatorFormData({ ...validatorFormData, crm: e.target.value })}
                            placeholder="CRM-UF 123456"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="validator-email">E-mail *</Label>
                          <Input
                            id="validator-email"
                            type="email"
                            value={validatorFormData.email}
                            onChange={(e) => setValidatorFormData({ ...validatorFormData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="validator-phone">Telefone (WhatsApp)</Label>
                          <Input
                            id="validator-phone"
                            value={validatorFormData.phone}
                            onChange={(e) => setValidatorFormData({ ...validatorFormData, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="validator-telegram">ID do Chat no Telegram</Label>
                          <Input
                            id="validator-telegram"
                            value={validatorFormData.telegram_chat_id}
                            onChange={(e) => setValidatorFormData({ ...validatorFormData, telegram_chat_id: e.target.value })}
                            placeholder="123456789 ou @username"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Para obter o Chat ID, envie /start para o bot do NDIR no Telegram
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit">{editingValidatorId ? "Salvar" : "Adicionar"}</Button>
                        <Button type="button" variant="outline" onClick={cancelEditValidator}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Validadores Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  {validators.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhum validador cadastrado
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {validators.map((validator) => (
                        <div
                          key={validator.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900">{validator.name}</h3>
                              {validator.is_active ? (
                                <Badge className="bg-green-600">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{validator.crm}</p>
                            <p className="text-sm text-slate-600">{validator.email}</p>
                            {validator.phone && (
                              <p className="text-sm text-slate-600">Tel: {validator.phone}</p>
                            )}
                            {validator.telegram_chat_id && (
                              <p className="text-sm text-slate-600 font-mono">Telegram: {validator.telegram_chat_id}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => toggleValidatorNotification(validator.id, "email")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  validator.notification_email
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Mail className="h-3 w-3" />
                                E-mail
                              </button>
                              <button
                                onClick={() => toggleValidatorNotification(validator.id, "whatsapp")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  validator.notification_whatsapp
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                WhatsApp
                              </button>
                              <button
                                onClick={() => toggleValidatorNotification(validator.id, "telegram")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  validator.notification_telegram
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Send className="h-3 w-3" />
                                Telegram
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditValidator(validator)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleValidatorActive(validator.id)}
                            >
                              {validator.is_active ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteValidator(validator.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* NURSES TAB */}
            <TabsContent value="nurses">
              <div className="mb-4 flex justify-end">
                <Button onClick={() => setShowNurseForm(!showNurseForm)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Enfermeiro
                </Button>
              </div>

              {showNurseForm && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>{editingNurseId ? "Editar Enfermeiro" : "Novo Enfermeiro"}</CardTitle>
                    <CardDescription>
                      {editingNurseId ? "Edite os dados do enfermeiro" : "Adicione um novo enfermeiro"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleNurseSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="nurse-name">Nome Completo *</Label>
                          <Input
                            id="nurse-name"
                            value={nurseFormData.name}
                            onChange={(e) => setNurseFormData({ ...nurseFormData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="nurse-coren">COREN *</Label>
                          <Input
                            id="nurse-coren"
                            value={nurseFormData.coren}
                            onChange={(e) => setNurseFormData({ ...nurseFormData, coren: e.target.value })}
                            placeholder="COREN-UF 123456"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="nurse-email">E-mail *</Label>
                          <Input
                            id="nurse-email"
                            type="email"
                            value={nurseFormData.email}
                            onChange={(e) => setNurseFormData({ ...nurseFormData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="nurse-phone">Telefone (WhatsApp)</Label>
                          <Input
                            id="nurse-phone"
                            value={nurseFormData.phone}
                            onChange={(e) => setNurseFormData({ ...nurseFormData, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="nurse-telegram">ID do Chat no Telegram</Label>
                          <Input
                            id="nurse-telegram"
                            value={nurseFormData.telegram_chat_id}
                            onChange={(e) => setNurseFormData({ ...nurseFormData, telegram_chat_id: e.target.value })}
                            placeholder="123456789 ou @username"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Para obter o Chat ID, envie /start para o bot do NDIR no Telegram
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit">{editingNurseId ? "Salvar" : "Adicionar"}</Button>
                        <Button type="button" variant="outline" onClick={cancelEditNurse}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Enfermeiros Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  {nurses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhum enfermeiro cadastrado
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {nurses.map((nurse) => (
                        <div
                          key={nurse.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900">{nurse.name}</h3>
                              {nurse.is_active ? (
                                <Badge className="bg-green-600">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{nurse.coren}</p>
                            <p className="text-sm text-slate-600">{nurse.email}</p>
                            {nurse.phone && (
                              <p className="text-sm text-slate-600">Tel: {nurse.phone}</p>
                            )}
                            {nurse.telegram_chat_id && (
                              <p className="text-sm text-slate-600 font-mono">Telegram: {nurse.telegram_chat_id}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => toggleNurseNotification(nurse.id, "email")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  nurse.notification_email
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Mail className="h-3 w-3" />
                                E-mail
                              </button>
                              <button
                                onClick={() => toggleNurseNotification(nurse.id, "whatsapp")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  nurse.notification_whatsapp
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                WhatsApp
                              </button>
                              <button
                                onClick={() => toggleNurseNotification(nurse.id, "telegram")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  nurse.notification_telegram
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Send className="h-3 w-3" />
                                Telegram
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditNurse(nurse)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleNurseActive(nurse.id)}
                            >
                              {nurse.is_active ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteNurse(nurse.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* REQUESTERS TAB */}
            <TabsContent value="requesters">
              <div className="mb-4 flex justify-end">
                <Button onClick={() => setShowRequesterForm(!showRequesterForm)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Solicitante
                </Button>
              </div>

              {showRequesterForm && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>{editingRequesterId ? "Editar Solicitante" : "Novo Solicitante"}</CardTitle>
                    <CardDescription>
                      {editingRequesterId ? "Edite os dados do solicitante" : "Adicione um novo solicitante"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRequesterSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="requester-name">Nome Completo *</Label>
                          <Input
                            id="requester-name"
                            value={requesterFormData.name}
                            onChange={(e) => setRequesterFormData({ ...requesterFormData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="requester-crm">CRM *</Label>
                          <Input
                            id="requester-crm"
                            value={requesterFormData.crm}
                            onChange={(e) => setRequesterFormData({ ...requesterFormData, crm: e.target.value })}
                            placeholder="CRM-UF 123456"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="requester-email">E-mail *</Label>
                          <Input
                            id="requester-email"
                            type="email"
                            value={requesterFormData.email}
                            onChange={(e) => setRequesterFormData({ ...requesterFormData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="requester-phone">Telefone</Label>
                          <Input
                            id="requester-phone"
                            value={requesterFormData.phone}
                            onChange={(e) => setRequesterFormData({ ...requesterFormData, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="requester-specialty">Especialidade</Label>
                          <Input
                            id="requester-specialty"
                            value={requesterFormData.specialty}
                            onChange={(e) => setRequesterFormData({ ...requesterFormData, specialty: e.target.value })}
                            placeholder="Ex: Cardiologia, Neurologia"
                          />
                        </div>
                        <div>
                          <Label htmlFor="requester-telegram">ID do Chat no Telegram</Label>
                          <Input
                            id="requester-telegram"
                            value={requesterFormData.telegram_chat_id}
                            onChange={(e) => setRequesterFormData({ ...requesterFormData, telegram_chat_id: e.target.value })}
                            placeholder="123456789 ou @username"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Para obter o Chat ID, envie /start para o bot do NDIR no Telegram
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit">{editingRequesterId ? "Salvar" : "Adicionar"}</Button>
                        <Button type="button" variant="outline" onClick={cancelEditRequester}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Solicitantes Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  {requesters.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhum solicitante cadastrado
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {requesters.map((requester) => (
                        <div
                          key={requester.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900">{requester.name}</h3>
                              {requester.is_active ? (
                                <Badge className="bg-green-600">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{requester.crm}</p>
                            <p className="text-sm text-slate-600">{requester.email}</p>
                            {requester.phone && (
                              <p className="text-sm text-slate-600">Tel: {requester.phone}</p>
                            )}
                            {requester.specialty && (
                              <p className="text-sm text-slate-600">Especialidade: {requester.specialty}</p>
                            )}
                            {requester.telegram_chat_id && (
                              <p className="text-sm text-slate-600 font-mono">Telegram: {requester.telegram_chat_id}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => toggleRequesterNotification(requester.id, "email")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  requester.notification_email
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Mail className="h-3 w-3" />
                                E-mail
                              </button>
                              <button
                                onClick={() => toggleRequesterNotification(requester.id, "whatsapp")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  requester.notification_whatsapp
                                    ? "bg-green-100 text-green-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                WhatsApp
                              </button>
                              <button
                                onClick={() => toggleRequesterNotification(requester.id, "telegram")}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                  requester.notification_telegram
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <Send className="h-3 w-3" />
                                Telegram
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditRequester(requester)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleRequesterActive(requester.id)}
                            >
                              {requester.is_active ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRequester(requester.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}
