/* Conversa com o Supabase usando apenas fetch (sem bibliotecas externas). */
(function (raiz) {
  'use strict';
  var cfg = raiz.CRIS_CONFIG || {};
  var CHAVE_SESSAO = 'cris_sessao';
  var sessao = null;
  var aoSair = null;

  function configurado() {
    return !!cfg.SUPABASE_URL && !/SEU-PROJETO/.test(cfg.SUPABASE_URL) && !!cfg.SUPABASE_KEY && !/COLE_AQUI/.test(cfg.SUPABASE_KEY);
  }
  function base() { return String(cfg.SUPABASE_URL || '').replace(/\/+$/, ''); }

  /* ---------- erros ---------- */
  var MENSAGENS = {
    ficha_invalida: 'Alguma informação está incompleta ou inválida. Volte e confira os dados.',
    ficha_grande: 'A ficha ficou grande demais. Tente assinar de novo, com um traço mais simples.',
    termos_nao_aceitos: 'É preciso aceitar os termos obrigatórios para concluir.',
    assinatura_invalida: 'Não conseguimos ler a assinatura. Limpe e assine de novo.',
    limite_envios: 'Muitos envios em pouco tempo por esta conexão. Aguarde um pouco e tente de novo.',
    tente_novamente: 'Não foi possível concluir agora. Toque em "Tentar de novo".',
    sem_permissao: 'Você não tem permissão para isso.'
  };
  function ErroApi(codigo, msg, status) {
    var e = new Error(msg); e.codigo = codigo; e.status = status || 0; return e;
  }
  function erroDeResposta(status, corpo) {
    var m = (corpo && (corpo.message || corpo.msg || corpo.error_description || corpo.error)) || '';
    if (MENSAGENS[m]) return ErroApi(m, MENSAGENS[m], status);
    if (status === 401 || status === 403) return ErroApi('nao_autorizado', 'Sessão expirada ou sem permissão. Entre de novo.', status);
    return ErroApi('erro', 'Não foi possível concluir agora. Confira sua internet e tente de novo.', status);
  }
  function erroDeRede(e) {
    return ErroApi('rede', 'Sem conexão com o servidor. Confira sua internet e tente de novo.', 0);
  }

  function fetchTempo(url, opc, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 30000) : null;
    opc = opc || {}; opc.cache = 'no-store'; if (ctl) opc.signal = ctl.signal;
    return fetch(url, opc).then(function (r) { if (t) clearTimeout(t); return r; }, function (e) { if (t) clearTimeout(t); throw erroDeRede(e); });
  }
  function lerJson(r) { return r.text().then(function (t) { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } }); }

  /* ---------- sessão (somente área da Cris) ---------- */
  function guardar(s, lembrar) {
    sessao = s;
    try {
      var j = JSON.stringify(s);
      sessionStorage.removeItem(CHAVE_SESSAO); localStorage.removeItem(CHAVE_SESSAO);
      (lembrar ? localStorage : sessionStorage).setItem(CHAVE_SESSAO, j);
    } catch (e) { /* sem armazenamento: a sessão vale só nesta aba */ }
  }
  function carregar() {
    if (sessao) return sessao;
    try {
      var j = sessionStorage.getItem(CHAVE_SESSAO) || localStorage.getItem(CHAVE_SESSAO);
      if (j) { sessao = JSON.parse(j); sessao._lembrar = !!localStorage.getItem(CHAVE_SESSAO); }
    } catch (e) { sessao = null; }
    return sessao;
  }
  function limpar() {
    sessao = null;
    try { sessionStorage.removeItem(CHAVE_SESSAO); localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* ok */ }
  }
  function normalizar(r, lembrar) {
    var exp = r.expires_at || (Math.floor(Date.now() / 1000) + (r.expires_in || 3600));
    return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp, user: r.user || (sessao && sessao.user) || null, _lembrar: !!lembrar };
  }

  function authFetch(caminho, corpo, token, metodo) {
    var h = { apikey: cfg.SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetchTempo(base() + caminho, { method: metodo || 'POST', headers: h, body: corpo ? JSON.stringify(corpo) : undefined }, 20000);
  }

  function entrar(email, senha, lembrar) {
    return authFetch('/auth/v1/token?grant_type=password', { email: email, password: senha }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (!r.ok) {
          var m = j && (j.error_code || j.msg || j.error_description || '');
          if (r.status === 400 || r.status === 401 || /invalid/i.test(m)) throw ErroApi('login', 'E-mail ou senha incorretos.', r.status);
          if (r.status === 429) throw ErroApi('limite', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', 429);
          throw erroDeResposta(r.status, j);
        }
        guardar(normalizar(j, lembrar), lembrar);
        return sessao;
      });
    });
  }

  var renovando = null;
  function renovar() {
    var s = carregar();
    if (!s || !s.refresh_token) return Promise.reject(ErroApi('nao_autorizado', 'Sessão expirada. Entre de novo.', 401));
    if (renovando) return renovando;
    renovando = authFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (!r.ok) { sair(true); throw ErroApi('nao_autorizado', 'Sessão expirada. Entre de novo.', 401); }
        guardar(normalizar(j, s._lembrar), s._lembrar);
        return sessao;
      });
    }).then(function (x) { renovando = null; return x; }, function (e) { renovando = null; throw e; });
    return renovando;
  }

  function sair(silencioso) {
    var s = carregar();
    limpar();
    if (s && s.access_token && !silencioso) { authFetch('/auth/v1/logout', null, s.access_token).catch(function () { /* ok */ }); }
    if (aoSair) aoSair();
  }

  function tokenValido() {
    var s = carregar();
    if (!s) return Promise.reject(ErroApi('nao_autorizado', 'Entre para continuar.', 401));
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    return renovar().then(function (n) { return n.access_token; });
  }

  /* ---------- chamadas ao banco ---------- */
  function rest(caminho, opc, comLogin) {
    opc = opc || {};
    var preparar = comLogin ? tokenValido() : Promise.resolve(null);
    return preparar.then(function (token) {
      var h = { apikey: cfg.SUPABASE_KEY, 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      for (var k in (opc.headers || {})) h[k] = opc.headers[k];
      return fetchTempo(base() + '/rest/v1/' + caminho, { method: opc.method || 'GET', headers: h, body: opc.body == null ? undefined : JSON.stringify(opc.body) }, opc.ms || 30000);
    }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (r.status === 401 && comLogin) { sair(true); }
        if (!r.ok) throw erroDeResposta(r.status, j);
        return { dados: j, resp: r };
      });
    });
  }

  function enviarFicha(payload) {
    if (!configurado()) return Promise.reject(ErroApi('config', 'O site ainda não foi configurado.', 0));
    return rest('rpc/enviar_ficha', { method: 'POST', body: { p: payload }, ms: 45000 }, false).then(function (x) { return x.dados; });
  }
  function ping() { return rest('rpc/ping', { method: 'POST', body: {} }, false).then(function (x) { return x.dados; }); }

  var COLUNAS_LISTA = 'id,protocolo,criado_em,nome,whatsapp,menor_de_idade,alerta,servicos,vista_em';
  function limparBusca(t) { return String(t).replace(/[(),*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim(); }

  function listar(o) {
    o = o || {};
    var lim = o.limite || 20, off = o.inicio || 0;
    var q = 'fichas?select=' + COLUNAS_LISTA + '&order=criado_em.desc&limit=' + lim + '&offset=' + off;
    var b = limparBusca(o.busca || '');
    if (b) {
      var p = encodeURIComponent('*' + b + '*');
      q += '&or=(nome.ilike.' + p + ',protocolo.ilike.' + p + ',whatsapp.ilike.' + p + ',email.ilike.' + p + ')';
    }
    return rest(q, { headers: { Prefer: 'count=exact' } }, true).then(function (x) {
      var cr = x.resp.headers.get('Content-Range') || '', m = /\/(\d+)$/.exec(cr);
      return { itens: x.dados || [], total: m ? Number(m[1]) : (x.dados || []).length };
    });
  }
  function contarNovas() {
    return rest('fichas?select=id&vista_em=is.null&limit=1', { headers: { Prefer: 'count=exact' } }, true).then(function (x) {
      var cr = x.resp.headers.get('Content-Range') || '', m = /\/(\d+)$/.exec(cr);
      return m ? Number(m[1]) : 0;
    });
  }
  function obter(id) {
    return rest('fichas?select=*&id=eq.' + encodeURIComponent(id), {}, true).then(function (x) {
      if (!x.dados || !x.dados.length) throw ErroApi('nao_encontrada', 'Ficha não encontrada.', 404);
      return x.dados[0];
    });
  }
  function marcarVista(id) {
    return rest('fichas?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { vista_em: new Date().toISOString() }, headers: { Prefer: 'return=minimal' } }, true);
  }
  function excluir(id) {
    return rest('fichas?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=representation' } }, true).then(function (x) {
      if (!x.dados || !x.dados.length) throw ErroApi('erro', 'Não foi possível excluir.', 0);
    });
  }
  function integra(id) { return rest('rpc/ficha_integra', { method: 'POST', body: { p_id: id } }, true).then(function (x) { return x.dados; }); }

  function exportarTudo(progresso) {
    var todas = [], passo = 50;
    function pagina(inicio) {
      return rest('fichas?select=*&order=criado_em.asc&limit=' + passo + '&offset=' + inicio, {}, true).then(function (x) {
        todas = todas.concat(x.dados || []);
        if (progresso) progresso(todas.length);
        return (x.dados || []).length === passo ? pagina(inicio + passo) : todas;
      });
    }
    return pagina(0);
  }

  /* ---------- conta ---------- */
  function trocarSenha(atual, nova) {
    var s = carregar();
    if (!s || !s.user || !s.user.email) return Promise.reject(ErroApi('nao_autorizado', 'Entre para continuar.', 401));
    // confere a senha atual antes de trocar
    return authFetch('/auth/v1/token?grant_type=password', { email: s.user.email, password: atual }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (!r.ok) throw ErroApi('login', 'A senha atual está incorreta.', r.status);
        guardar(normalizar(j, s._lembrar), s._lembrar);
        return tokenValido();
      });
    }).then(function (token) {
      return authFetch('/auth/v1/user', { password: nova }, token, 'PUT');
    }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (!r.ok) {
          var m = (j && (j.msg || j.message || j.error_description)) || '';
          if (/same|different/i.test(m)) throw ErroApi('senha', 'A nova senha precisa ser diferente da atual.', r.status);
          if (/weak|short|least|characters/i.test(m)) throw ErroApi('senha', 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.', r.status);
          throw erroDeResposta(r.status, j);
        }
        return true;
      });
    });
  }
  function recuperar(email) {
    // volta para a própria página da área restrita (que trata o link do e-mail)
    var volta = cfg.SITE_URL ? cfg.SITE_URL.replace(/\/?$/, '/') + 'admin/' : raiz.location.origin + raiz.location.pathname;
    return authFetch('/auth/v1/recover?redirect_to=' + encodeURIComponent(volta), { email: email }).then(function (r) {
      if (r.status === 429) throw ErroApi('limite', 'Aguarde alguns minutos antes de pedir outro e-mail.', 429);
      return true;   // sempre "ok": não revela se o e-mail existe
    });
  }
  /* Link do e-mail de recuperação: #access_token=...&refresh_token=...&type=recovery */
  function sessaoDoLink(hash) {
    var p = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) p[a[0]] = decodeURIComponent(a[1] || ''); });
    if (p.type !== 'recovery' || !p.access_token) return false;
    guardar({ access_token: p.access_token, refresh_token: p.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(p.expires_in || 3600), user: null, _lembrar: false }, false);
    return true;
  }
  function definirSenhaNova(nova) {
    return tokenValido().then(function (t) { return authFetch('/auth/v1/user', { password: nova }, t, 'PUT'); }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (!r.ok) {
          var m = (j && (j.msg || j.message)) || '';
          if (/weak|short|least|characters/i.test(m)) throw ErroApi('senha', 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.', r.status);
          throw erroDeResposta(r.status, j);
        }
        return true;
      });
    });
  }
  function usuario() {
    return tokenValido().then(function (t) {
      return authFetch('/auth/v1/user', null, t, 'GET');
    }).then(function (r) {
      return lerJson(r).then(function (j) {
        if (!r.ok) throw erroDeResposta(r.status, j);
        var s = carregar(); if (s) { s.user = j; guardar(s, s._lembrar); }
        return j;
      });
    });
  }
  /* A pessoa logada é administradora? (a regra do banco só mostra a própria linha) */
  function ehAdmin() {
    return rest('admins?select=user_id', {}, true).then(function (x) { return !!(x.dados && x.dados.length); });
  }

  raiz.CrisAPI = {
    configurado: configurado, enviarFicha: enviarFicha, ping: ping,
    entrar: entrar, sair: sair, sessao: carregar, usuario: usuario, ehAdmin: ehAdmin,
    listar: listar, contarNovas: contarNovas, obter: obter, marcarVista: marcarVista, excluir: excluir, integra: integra, exportarTudo: exportarTudo,
    trocarSenha: trocarSenha, recuperar: recuperar, sessaoDoLink: sessaoDoLink, definirSenhaNova: definirSenhaNova,
    aoSair: function (fn) { aoSair = fn; }
  };
})(window);
