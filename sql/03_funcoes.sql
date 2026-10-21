-- =====================================================================
-- 03 · Funções (a "porta de entrada" das clientes e utilidades)
-- =====================================================================

-- Código de integridade: amarra protocolo, data/hora, dados e assinatura.
create or replace function public.calcular_hash(p_protocolo text, p_criado timestamptz, p_dados jsonb, p_ass text)
returns text
language sql immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        p_protocolo || '|' ||
        to_char(p_criado at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
        p_dados::text || '|' || p_ass,
        'UTF8'),
      'sha256'),
    'hex');
$$;
revoke all on function public.calcular_hash(text, timestamptz, jsonb, text) from public, anon, authenticated;

-- "Acordar" / manter o projeto ativo (usado pela tarefa semanal do GitHub).
create or replace function public.ping()
returns text
language sql stable security definer
set search_path = ''
as $$ select 'ok'::text $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------
-- enviar_ficha: única forma de uma cliente gravar uma ficha.
-- Confere tudo no servidor (não confia no celular da cliente), gera o
-- protocolo e a hora oficiais e limita abusos.
-- ---------------------------------------------------------------------
create or replace function public.enviar_ficha(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ident    jsonb := p -> 'identificacao';
  v_saude    jsonb := p -> 'saude';
  v_unhas    jsonb := p -> 'unhas';
  v_hist     jsonb := p -> 'historico';
  v_termos   jsonb := p -> 'termos';
  v_nome     text;
  v_nasc     date;
  v_idade    int;
  v_whats    text;
  v_email    text;
  v_menor    boolean;
  v_resp     jsonb;
  v_ass      text := p ->> 'assinatura';
  v_item     jsonb;
  v_aceitos  text[];
  v_headers  jsonb;
  v_ip       text;
  v_iph      text;
  v_agora    timestamptz := now();
  v_prot     text;
  v_tent     int := 0;
  v_alfa     constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_dados    jsonb;
  v_hash     text;
  v_alerta   boolean := false;
  v_serv     text;
  v_ident_ok jsonb;
begin
  -- formato geral
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'ficha_invalida'; end if;
  if octet_length(p::text) > 450000 then raise exception 'ficha_grande'; end if;
  -- campo-armadilha para robôs (a cliente nunca preenche)
  if coalesce(p ->> 'site', '') <> '' then raise exception 'ficha_invalida'; end if;
  if jsonb_typeof(v_ident) is distinct from 'object'
     or jsonb_typeof(v_saude) is distinct from 'object'
     or jsonb_typeof(v_unhas) is distinct from 'object'
     or jsonb_typeof(v_hist)  is distinct from 'object'
     or jsonb_typeof(v_termos) is distinct from 'array' then
    raise exception 'ficha_invalida';
  end if;

  -- identificação
  v_nome  := btrim(coalesce(v_ident ->> 'nome', ''));
  v_whats := coalesce(v_ident ->> 'whatsapp', '');
  v_email := btrim(coalesce(v_ident ->> 'email', ''));
  if char_length(v_nome) not between 2 and 100 then raise exception 'ficha_invalida'; end if;
  if char_length(regexp_replace(v_whats, '\D', '', 'g')) not between 10 and 15 then raise exception 'ficha_invalida'; end if;
  if char_length(v_email) > 120 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'ficha_invalida'; end if;
  if char_length(coalesce(v_ident ->> 'instagram', '')) > 40 then raise exception 'ficha_invalida'; end if;
  begin
    v_nasc := (v_ident ->> 'nascimento')::date;
  exception when others then
    raise exception 'ficha_invalida';
  end;
  v_idade := extract(year from age(current_date, v_nasc))::int;
  if v_nasc > current_date or v_idade > 110 then raise exception 'ficha_invalida'; end if;
  v_menor := v_idade < 18;       -- decidido pelo servidor, não pelo celular
  v_resp  := v_ident -> 'responsavel';
  if v_menor then
    if jsonb_typeof(v_resp) is distinct from 'object'
       or btrim(coalesce(v_resp ->> 'nome', '')) = ''
       or btrim(coalesce(v_resp ->> 'parentesco', '')) = ''
       or char_length(regexp_replace(coalesce(v_resp ->> 'telefone', ''), '\D', '', 'g')) < 10 then
      raise exception 'ficha_invalida';
    end if;
  else
    v_resp := null;
  end if;

  -- saúde e unhas: respostas válidas
  if jsonb_typeof(v_saude -> 'itens') is distinct from 'array'
     or jsonb_array_length(v_saude -> 'itens') not between 1 and 20 then raise exception 'ficha_invalida'; end if;
  if jsonb_typeof(v_unhas -> 'itens') is distinct from 'array'
     or jsonb_array_length(v_unhas -> 'itens') not between 1 and 20 then raise exception 'ficha_invalida'; end if;
  for v_item in select * from jsonb_array_elements(v_saude -> 'itens') loop
    if (v_item ->> 'resposta') not in ('Sim', 'Não', 'Não sei')
       or char_length(coalesce(v_item ->> 'pergunta', '')) not between 1 and 300
       or char_length(coalesce(v_item ->> 'detalhe', '')) > 300 then raise exception 'ficha_invalida'; end if;
    if v_item ->> 'resposta' = 'Sim' then v_alerta := true; end if;
  end loop;
  for v_item in select * from jsonb_array_elements(v_unhas -> 'itens') loop
    if (v_item ->> 'resposta') not in ('Sim', 'Não', 'Não sei')
       or char_length(coalesce(v_item ->> 'pergunta', '')) not between 1 and 300
       or char_length(coalesce(v_item ->> 'detalhe', '')) > 300 then raise exception 'ficha_invalida'; end if;
  end loop;
  if char_length(coalesce(v_saude ->> 'outra', '')) > 500 then raise exception 'ficha_invalida'; end if;
  if btrim(coalesce(v_saude ->> 'outra', '')) <> '' then v_alerta := true; end if;

  -- histórico
  if (v_hist ->> 'jaFezAlongamentoOuGel') not in ('Sim', 'Não')
     or (v_hist ->> 'contatoAguaQuimicos') not in ('Sim', 'Não')
     or char_length(coalesce(v_hist ->> 'preferencias', '')) > 500
     or jsonb_typeof(v_hist -> 'servicosDesejados') is distinct from 'array'
     or jsonb_array_length(v_hist -> 'servicosDesejados') not between 1 and 10 then
    raise exception 'ficha_invalida';
  end if;
  for v_item in select * from jsonb_array_elements(v_hist -> 'servicosDesejados') loop
    if jsonb_typeof(v_item) <> 'string' or char_length(v_item #>> '{}') not between 1 and 100 then
      raise exception 'ficha_invalida';
    end if;
  end loop;
  select string_agg(x, ', ') into v_serv from jsonb_array_elements_text(v_hist -> 'servicosDesejados') x;

  -- termos obrigatórios aceitos
  if jsonb_array_length(v_termos) not between 1 and 10 then raise exception 'ficha_invalida'; end if;
  select coalesce(array_agg(t ->> 'id'), '{}') into v_aceitos
    from jsonb_array_elements(v_termos) t
   where (t ->> 'aceito') = 'true';
  if not (v_aceitos @> array['termo_veracidade', 'termo_riscos', 'termo_lgpd']) then
    raise exception 'termos_nao_aceitos';
  end if;

  -- assinatura
  if v_ass is null or char_length(v_ass) not between 300 and 400000
     or v_ass !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$' then
    raise exception 'assinatura_invalida';
  end if;

  -- limite de abuso (por aparelho/rede e geral); guardamos só um código, não o IP
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip  := coalesce(nullif(v_headers ->> 'cf-connecting-ip', ''),
                    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
                    'desconhecido');
  v_iph := encode(extensions.digest(convert_to(v_ip || ':cris-ficha', 'UTF8'), 'sha256'), 'hex');
  if (select count(*) from public.fichas where ip_hash = v_iph and criado_em > v_agora - interval '1 hour') >= 10
     or (select count(*) from public.fichas where criado_em > v_agora - interval '1 hour') >= 150 then
    raise exception 'limite_envios';
  end if;

  -- monta o registro (lista fixa de campos; nada além disso é guardado)
  v_ident_ok := jsonb_build_object(
    'nome', v_nome,
    'nascimento', to_char(v_nasc, 'YYYY-MM-DD'),
    'whatsapp', btrim(v_whats),
    'email', v_email,
    'instagram', btrim(coalesce(v_ident ->> 'instagram', '')),
    'menorDeIdade', v_menor,
    'responsavel', v_resp
  );
  v_dados := jsonb_build_object(
    'versaoFicha', left(coalesce(p ->> 'versaoFicha', '1'), 10),
    'identificacao', v_ident_ok,
    'saude', v_saude,
    'unhas', v_unhas,
    'historico', v_hist,
    'termos', v_termos
  );

  -- protocolo oficial (único)
  loop
    v_tent := v_tent + 1;
    v_prot := 'CF-' || to_char(v_agora at time zone 'America/Sao_Paulo', 'YYYYMMDD-HH24MI') || '-' ||
              substr(v_alfa, 1 + floor(random() * 32)::int, 1) ||
              substr(v_alfa, 1 + floor(random() * 32)::int, 1) ||
              substr(v_alfa, 1 + floor(random() * 32)::int, 1) ||
              substr(v_alfa, 1 + floor(random() * 32)::int, 1);
    exit when not exists (select 1 from public.fichas where protocolo = v_prot);
    if v_tent > 8 then raise exception 'tente_novamente'; end if;
  end loop;

  v_hash := public.calcular_hash(v_prot, v_agora, v_dados, v_ass);

  begin
    insert into public.fichas
      (protocolo, criado_em, nome, nascimento, whatsapp, email, menor_de_idade, alerta,
       servicos, dados, assinatura, hash_sha256, ip_hash)
    values
      (v_prot, v_agora, v_nome, v_nasc, btrim(v_whats), v_email, v_menor, v_alerta,
       coalesce(v_serv, ''), v_dados, v_ass, v_hash, v_iph);
  exception when unique_violation then
    raise exception 'tente_novamente';
  end;

  return jsonb_build_object(
    'ok', true,
    'protocolo', v_prot,
    'criado_em', v_agora,
    'dataHoraLocal', to_char(v_agora at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI'),
    'hash', v_hash
  );
end;
$$;
revoke all on function public.enviar_ficha(jsonb) from public;
grant execute on function public.enviar_ficha(jsonb) to anon, authenticated;

-- Confere se uma ficha guardada continua igual ao que foi enviada (só administradores).
create or replace function public.ficha_integra(p_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare f public.fichas%rowtype;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  select * into f from public.fichas where id = p_id;
  if not found then return null; end if;
  return f.hash_sha256 = public.calcular_hash(f.protocolo, f.criado_em, f.dados, f.assinatura);
end;
$$;
revoke all on function public.ficha_integra(uuid) from public, anon;
grant execute on function public.ficha_integra(uuid) to authenticated;
