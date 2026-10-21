-- =====================================================================
-- Ficha de Anamnese · Cris Ferreira Nail Designer
-- 01 · Tabelas
-- Como usar: Supabase > SQL Editor > New query > cole TODO este arquivo > Run.
-- Pode rodar de novo sem problema (é seguro repetir).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Quem pode entrar na área restrita (só Rafael e Cris; preenchido no script 04).
create table if not exists public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Fichas preenchidas pelas clientes.
create table if not exists public.fichas (
  id             uuid primary key default gen_random_uuid(),
  protocolo      text        not null unique,
  criado_em      timestamptz not null default now(),
  nome           text        not null,
  nascimento     date        not null,
  whatsapp       text        not null,
  email          text        not null,
  menor_de_idade boolean     not null default false,
  alerta         boolean     not null default false,  -- há resposta "Sim" em saúde (ponto de atenção)
  servicos       text        not null default '',
  dados          jsonb       not null,                -- ficha completa, sem a assinatura
  assinatura     text        not null,                -- imagem da assinatura (data URL)
  hash_sha256    text        not null,                -- código de integridade
  ip_hash        text,                                -- apenas para limitar abuso (não é o IP)
  vista_em       timestamptz,                         -- quando um administrador abriu a ficha
  constraint fichas_protocolo_formato   check (protocolo ~ '^CF-[0-9]{8}-[0-9]{4}-[A-Z2-9]{4}$'),
  constraint fichas_nome_tamanho        check (char_length(nome) between 2 and 100),
  constraint fichas_dados_tamanho       check (octet_length(dados::text) < 100000),
  constraint fichas_assinatura_tamanho  check (char_length(assinatura) between 300 and 400000),
  constraint fichas_assinatura_tipo     check (assinatura ~ '^data:image/(png|jpeg);base64,')
);

create index if not exists fichas_criado_em_idx on public.fichas (criado_em desc);
create index if not exists fichas_ip_idx        on public.fichas (ip_hash, criado_em);

comment on table public.fichas is 'Fichas de anamnese (dados de saúde: sensíveis, LGPD). Acesso só por administradores.';
comment on table public.admins is 'Lista de quem pode acessar a área restrita.';
