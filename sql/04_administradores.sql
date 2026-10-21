-- =====================================================================
-- 04 · Administradores (Rafael e Cris)
-- ANTES: crie os dois usuários em Authentication > Users > Add user
--        (marque "Auto Confirm User").
-- DEPOIS: troque os dois e-mails abaixo pelos e-mails reais e rode.
-- =====================================================================

insert into public.admins (user_id)
select id
  from auth.users
 where lower(email) in (
         lower('rafaelramalho@outlook.com'),
         lower('crismaria.ferreira@outlook.com')
       )
on conflict do nothing;

-- Conferência: devem aparecer exatamente 2 linhas.
select a.user_id, u.email, a.criado_em
  from public.admins a
  join auth.users u on u.id = a.user_id
 order by u.email;
