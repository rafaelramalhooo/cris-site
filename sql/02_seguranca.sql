-- =====================================================================
-- 02 · Segurança (quem pode ver o quê)
-- Regra de ouro: o público (clientes) NÃO lê nem altera nada nas tabelas.
-- Só os administradores listados em "admins" leem as fichas.
-- =====================================================================

alter table public.fichas enable row level security;
alter table public.admins enable row level security;

-- Tira TODA permissão padrão do público e dos usuários logados...
revoke all on table public.fichas from public, anon, authenticated;
revoke all on table public.admins from public, anon, authenticated;

-- ...e devolve só o mínimo aos usuários logados (que ainda passam pelas regras abaixo).
grant select, delete          on public.fichas to authenticated;
grant update (vista_em)       on public.fichas to authenticated;  -- só pode marcar "vista"; não edita o conteúdo
grant select                  on public.admins to authenticated;

-- "Este usuário é administrador?"
create or replace function public.eh_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

-- Regras por linha (RLS)
drop policy if exists fichas_ler          on public.fichas;
drop policy if exists fichas_marcar_vista on public.fichas;
drop policy if exists fichas_excluir      on public.fichas;
drop policy if exists admins_ver_propria  on public.admins;

create policy fichas_ler          on public.fichas for select to authenticated using (public.eh_admin());
create policy fichas_marcar_vista on public.fichas for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy fichas_excluir      on public.fichas for delete to authenticated using (public.eh_admin());
create policy admins_ver_propria  on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- Sem nenhuma regra de INSERT: ninguém grava direto na tabela.
-- A única porta de entrada das clientes é a função enviar_ficha (script 03).
