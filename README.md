# NVC - Núcleo de Validação Clínica

Sistema web para solicitação, validação e acompanhamento de pré-internações clínicas do Hospital Prontocardio.

O NVC centraliza o formulário de pré-internação, consulta dados do MVSOUL, envia solicitações para médicos validadores via Telegram e registra o retorno da aprovação para enfermagem e médico solicitante.

## Objetivo

O projeto foi criado para organizar o fluxo de validação clínica antes da internação hospitalar, reduzindo retrabalho, melhorando rastreabilidade e acelerando a comunicação entre médico solicitante, validadores e enfermagem.

## Fluxo Principal

1. O médico solicitante acessa o formulário protegido por código.
2. Informa o atendimento MVSOUL e preenche os dados clínicos da solicitação.
3. O sistema pode buscar dados do paciente no MVSOUL, conforme configuração.
4. A solicitação é registrada no banco de dados.
5. Os médicos validadores recebem notificação pelo Telegram.
6. Cada validador acessa o link de validação e aprova ou recusa a solicitação.
7. A decisão fica registrada no sistema.
8. Em caso de aprovação, enfermagem e médico solicitante podem ser notificados.

## Funcionalidades

- Formulário de solicitação de pré-internação.
- Proteção do formulário por código de acesso.
- Consulta de atendimento e paciente via MVSOUL.
- Gestão de solicitações.
- Fila de validação médica.
- Página individual de validação por protocolo.
- Cadastro de médicos validadores.
- Cadastro de enfermagem.
- Cadastro de médicos solicitantes.
- Configuração de SLA por prioridade.
- Configurações de integração com MVSOUL.
- Configurações de Telegram.
- Histórico de notificações e auditoria.
- Dashboard e indicadores operacionais.

## Tecnologias

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Better Auth
- Neon PostgreSQL
- Telegram Bot API
- Integração REST com MVSOUL
- Yarn 4 / Corepack

## Estrutura do Projeto

```text
apps/web
  src/app                 Rotas Next.js e APIs
  src/views               Telas principais do sistema
  src/components          Componentes reutilizáveis
  src/app/api             Endpoints internos
  src/app/api/mvsoul      Integração MVSOUL
  src/app/api/settings    Configurações do sistema

apps/mobile               Estrutura mobile preservada do export original
legacy                    Código legado preservado da migração
```

## Configuração Local

Crie o arquivo `apps/web/.env.local`:

```env
DATABASE_URL=postgresql://usuario:senha@host/neondb?sslmode=require
AUTH_SECRET=gere-uma-chave-segura-com-mais-de-32-caracteres
BETTER_AUTH_URL=http://localhost:4003
AUTH_URL=http://localhost:4003
NEXT_PUBLIC_AUTH_URL=http://localhost:4003
NEXT_PUBLIC_CREATE_BASE_URL=http://localhost:4003
NEXT_PUBLIC_CREATE_HOST=localhost:4003
NEXT_PUBLIC_PROJECT_GROUP_ID=nvc-local
```

Não envie `.env.local` para o Git, pois ele contém credenciais do banco e chaves de autenticação.

## Instalação

```bash
corepack yarn install
```

No Windows, este projeto usa `nodeLinker: node-modules` e `nmMode: classic` para evitar erros de hardlink com pacotes do Expo/mobile.

## Rodar Localmente

```bash
corepack yarn workspace web next dev --port 4003
```

Acesse:

```text
http://localhost:4003
```

O código de acesso do formulário fica na tabela `settings`, chave:

```text
form_access_code
```

## Build de Produção

```bash
corepack yarn workspace web build
```

Para iniciar após build:

```bash
corepack yarn workspace web start
```

## Banco de Dados

O sistema utiliza PostgreSQL no Neon. As principais tabelas são:

- `requests`
- `request_attachments`
- `validators`
- `nurses`
- `requesters`
- `settings`
- `notification_log`
- `telegram_registrations`
- `user_profiles`
- tabelas do Better Auth: `user`, `account`, `session`, `verification`

## Configurações Importantes

As integrações são controladas pela tabela `settings`.

Chaves relevantes:

- `form_access_secure`
- `form_access_code`
- `telegram_enabled`
- `telegram_bot_token`
- `mvsoul_integration_enabled`
- `mvsoul_api_url`
- `mvsoul_api_user`
- `mvsoul_api_password`
- `mvsoul_auto_sync`
- `sla_immediate_minutes`
- `sla_urgent_minutes`
- `sla_elective_minutes`

## MVSOUL

A integração com MVSOUL consulta dados de atendimento, paciente, evolução e laudos conforme endpoints internos do sistema.

As credenciais ficam em `settings`, não no código-fonte.

## Telegram

O Telegram é usado para notificar médicos validadores e registrar decisões de aprovação/recusa.

Para funcionar em produção, configure:

- token do bot em `telegram_bot_token`;
- chat IDs dos validadores, enfermagem e solicitantes;
- URL pública do sistema, para que os links de validação sejam acessíveis pelos médicos.

## Status Atual

- Projeto preparado localmente.
- Banco conectado.
- Typecheck executado com sucesso.
- Build de produção executado com sucesso.
- Primeiro commit enviado para o repositório GitHub.

## Observações

Este projeto veio de uma exportação/migração do Anything/Mocha. Parte do código legado foi preservada na pasta `legacy` para referência. As rotas principais já estão em Next.js, mas alguns fluxos podem exigir revisão fina durante os testes reais com MVSOUL e Telegram.
