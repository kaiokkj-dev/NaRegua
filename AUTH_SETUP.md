# Configuração da autenticação

## 1. Supabase

Crie um projeto e execute no SQL Editor:

`backend/database/migrations/001_auth_and_tenancy.sql`

Copie a URL do projeto e a chave `service_role` para o `.env`. Essa chave fica somente no backend.

## 2. Google OAuth

No Google Cloud Console, crie uma credencial OAuth 2.0 do tipo aplicação Web.

Origem JavaScript autorizada:

`http://localhost:3000`

URI de redirecionamento autorizada:

`http://localhost:3000/api/auth/google/callback`

Em produção, cadastre também o domínio HTTPS definitivo.

## 3. Ambiente

Copie `.env.example` para `.env` e preencha as credenciais. Gere `JWT_SECRET` com pelo menos 32 caracteres aleatórios.

## 4. Fluxo

- `GET /api/auth/google`: inicia o OAuth com proteção de `state`.
- `GET /api/auth/google/callback`: cria a sessão em cookie `HttpOnly`.
- `GET /api/auth/me`: retorna usuário e barbearias da sessão.
- `POST /api/auth/onboarding`: cria a primeira barbearia atomicamente.
- `POST /api/auth/logout`: remove o cookie local.

Tokens não são enviados na URL nem armazenados em `localStorage`.
