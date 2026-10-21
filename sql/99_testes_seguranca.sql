-- =====================================================================
-- 99 · Testes de segurança (rode DEPOIS dos scripts 01 a 04)
-- Supabase > SQL Editor > cole tudo > Run.
-- Resultado esperado: a última mensagem diz "TODOS OS TESTES PASSARAM".
-- Se algo falhar, aparece "FALHOU: ..." com o motivo. Nada fica gravado
-- (tudo é desfeito no fim).
-- =====================================================================

do $$
declare
  v_ass   text := 'data:image/png;base64,' || repeat('A', 400);
  v_ok    jsonb;
  v_res   jsonb;
  v_n     int;
  v_uid   uuid := gen_random_uuid();   -- "usuária logada" qualquer, que NÃO é administradora
  v_adm   uuid;                        -- um administrador real (da tabela admins)
  v_base  int;
  v_id    uuid;
  v_bool  boolean;

  -- ficha válida de exemplo
  v_ficha jsonb := jsonb_build_object(
    'versaoFicha', '1',
    'site', '',
    'identificacao', jsonb_build_object('nome','Teste Segurança','nascimento','1990-05-10','whatsapp','(11) 99999-0000','email','teste@exemplo.com','instagram',''),
    'saude', jsonb_build_object('itens', jsonb_build_array(jsonb_build_object('id','alergia','pergunta','Alergia?','resposta','Sim','detalhe','esmalte')),'outra',''),
    'unhas', jsonb_build_object('itens', jsonb_build_array(jsonb_build_object('id','infeccao','pergunta','Infecção?','resposta','Não','detalhe',''))),
    'historico', jsonb_build_object('jaFezAlongamentoOuGel','Não','contatoAguaQuimicos','Não','servicosDesejados', jsonb_build_array('Manicure'),'preferencias',''),
    'termos', jsonb_build_array(
      jsonb_build_object('id','termo_veracidade','texto','x','obrigatorio',true,'aceito',true),
      jsonb_build_object('id','termo_riscos','texto','x','obrigatorio',true,'aceito',true),
      jsonb_build_object('id','termo_lgpd','texto','x','obrigatorio',true,'aceito',true)),
    'assinatura', v_ass);
begin
  -- ---- preparação ----
  select user_id into v_adm from public.admins order by criado_em limit 1;
  if v_adm is null then raise exception 'FALHOU: rode primeiro o script 04 (administradores) e depois este teste'; end if;
  select count(*) into v_base from public.fichas;   -- fichas que já existem (o teste não mexe nelas)

  -- ---- 1. Cliente anônima ----
  set local role anon;

  begin perform 1 from public.fichas limit 1; raise exception 'FALHOU: anon leu fichas';
  exception when insufficient_privilege then null; end;

  begin insert into public.fichas (protocolo,nome,nascimento,whatsapp,email,dados,assinatura,hash_sha256)
        values ('CF-20260101-1200-ABCD','x y','1990-01-01','1','a@b.co','{}', v_ass,'h');
        raise exception 'FALHOU: anon inseriu direto';
  exception when insufficient_privilege then null; end;

  begin delete from public.fichas; raise exception 'FALHOU: anon apagou';
  exception when insufficient_privilege then null; end;

  begin perform 1 from public.admins; raise exception 'FALHOU: anon leu admins';
  exception when insufficient_privilege then null; end;

  begin perform public.eh_admin(); raise exception 'FALHOU: anon executou eh_admin';
  exception when insufficient_privilege then null; end;

  begin perform public.ficha_integra(gen_random_uuid()); raise exception 'FALHOU: anon executou ficha_integra';
  exception when insufficient_privilege then null; end;

  begin perform public.calcular_hash('a', now(), '{}', 'b'); raise exception 'FALHOU: anon executou calcular_hash';
  exception when insufficient_privilege then null; end;

  if public.ping() <> 'ok' then raise exception 'FALHOU: ping'; end if;

  -- envio válido
  v_res := public.enviar_ficha(v_ficha);
  if not (v_res ->> 'ok')::boolean or (v_res ->> 'protocolo') !~ '^CF-[0-9]{8}-[0-9]{4}-[A-Z2-9]{4}$' then
    raise exception 'FALHOU: envio válido não retornou protocolo (%)', v_res;
  end if;

  -- robô (campo-armadilha)
  begin perform public.enviar_ficha(v_ficha || '{"site":"http://spam"}'); raise exception 'FALHOU: aceitou robô';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- sem aceite da LGPD
  begin
    perform public.enviar_ficha(jsonb_set(v_ficha, '{termos,2,aceito}', 'false'));
    raise exception 'FALHOU: aceitou sem LGPD';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- sem assinatura / assinatura de tipo errado
  begin perform public.enviar_ficha(v_ficha - 'assinatura'); raise exception 'FALHOU: aceitou sem assinatura';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.enviar_ficha(v_ficha || jsonb_build_object('assinatura','data:text/html;base64,'||repeat('A',400)));
        raise exception 'FALHOU: aceitou assinatura inválida';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- e-mail inválido, nome curto, nascimento no futuro
  begin perform public.enviar_ficha(jsonb_set(v_ficha,'{identificacao,email}','"naoeemail"')); raise exception 'FALHOU: e-mail inválido aceito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.enviar_ficha(jsonb_set(v_ficha,'{identificacao,nome}','"A"')); raise exception 'FALHOU: nome curto aceito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.enviar_ficha(jsonb_set(v_ficha,'{identificacao,nascimento}','"2999-01-01"')); raise exception 'FALHOU: nascimento futuro aceito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- menor de idade sem responsável
  begin perform public.enviar_ficha(jsonb_set(v_ficha,'{identificacao,nascimento}', to_jsonb(to_char(current_date - interval '10 years','YYYY-MM-DD'))));
        raise exception 'FALHOU: menor sem responsável aceito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- resposta fora da lista
  begin perform public.enviar_ficha(jsonb_set(v_ficha,'{saude,itens,0,resposta}','"talvez"')); raise exception 'FALHOU: resposta inválida aceita';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- limite por aparelho: já enviamos 1 válida; mais 9 passam, a 11ª é barrada
  for i in 1..9 loop perform public.enviar_ficha(v_ficha); end loop;
  begin perform public.enviar_ficha(v_ficha); raise exception 'FALHOU: limite de envios não funcionou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  reset role;

  -- ---- 2. Usuária logada que NÃO é administradora ----
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_uid, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fichas;
  if v_n <> 0 then raise exception 'FALHOU: logada não-admin enxergou % fichas', v_n; end if;
  select count(*) into v_n from public.admins;
  if v_n <> 0 then raise exception 'FALHOU: logada não-admin enxergou admins'; end if;
  begin perform public.ficha_integra(gen_random_uuid()); raise exception 'FALHOU: não-admin executou ficha_integra';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  delete from public.fichas;   -- RLS: não apaga nada
  reset role;
  select count(*) into v_n from public.fichas;
  if v_n <> v_base + 10 then raise exception 'FALHOU: não-admin apagou fichas'; end if;

  -- ---- 3. Administrador ----
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_adm, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.fichas;
  if v_n <> v_base + 10 then raise exception 'FALHOU: admin vê % fichas (esperado %)', v_n, v_base + 10; end if;
  select id into v_id from public.fichas order by criado_em desc limit 1;
  update public.fichas set vista_em = now() where id = v_id;
  begin update public.fichas set nome = 'Alterado' where id = v_id; raise exception 'FALHOU: admin conseguiu editar o conteúdo';
  exception when insufficient_privilege then null; end;
  begin insert into public.fichas (protocolo,nome,nascimento,whatsapp,email,dados,assinatura,hash_sha256)
        values ('CF-20260101-1200-ABCD','x y','1990-01-01','1','a@b.co','{}', v_ass,'h');
        raise exception 'FALHOU: admin inseriu direto';
  exception when insufficient_privilege then null; end;
  v_bool := public.ficha_integra(v_id);
  if v_bool is not true then raise exception 'FALHOU: integridade da ficha recém-enviada deu %', v_bool; end if;
  delete from public.fichas where id = v_id;
  select count(*) into v_n from public.fichas;
  if v_n <> v_base + 9 then raise exception 'FALHOU: admin não conseguiu excluir'; end if;
  reset role;

  -- ---- 4. Adulteração é detectada ----
  select id into v_id from public.fichas order by criado_em desc limit 1;
  update public.fichas set dados = jsonb_set(dados, '{identificacao,nome}', '"Outra Pessoa"') where id = v_id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_adm, 'role','authenticated')::text, true);
  set local role authenticated;
  if public.ficha_integra(v_id) is not false then raise exception 'FALHOU: adulteração não detectada'; end if;
  reset role;

  -- desfaz tudo
  raise exception 'TODOS OS TESTES PASSARAM (os dados de teste foram desfeitos)';
end $$;
