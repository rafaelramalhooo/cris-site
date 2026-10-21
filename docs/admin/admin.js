/* Área restrita: login, lista de fichas, detalhe, PDF e troca de senha. */
(function () {
  'use strict';
  // não abre dentro de outra página (proteção contra "clickjacking")
  try { if (window.top !== window.self) { document.documentElement.innerHTML = ''; return; } } catch (e) { document.documentElement.innerHTML = ''; return; }
  var $ = function (id) { return document.getElementById(id); };
  var C = window.CrisComum, API = window.CrisAPI, esc = C.esc;
  var INATIVIDADE_MS = 15 * 60 * 1000;
  var PAGINA = 20;

  var estado = { itens: [], total: 0, busca: '', atual: null, carregando: false, novas: null };
  var timerInativo = null, timerBusca = null;

  /* ---------- telas ---------- */
  var VISOES = ['v-login', 'v-nova-senha', 'v-lista', 'v-detalhe', 'v-conta'];
  function mostrar(id) {
    VISOES.forEach(function (v) { $(v).hidden = v !== id; });
    $('barra-usuario').hidden = !(id === 'v-lista' || id === 'v-detalhe' || id === 'v-conta');
    var u = API.sessao();
    $('usuario-email').textContent = (u && u.user && u.user.email) || '';
    window.scrollTo(0, 0);
    var h = $(id).querySelector('h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    if (id === 'v-login' || id === 'v-nova-senha') pararInatividade(); else iniciarInatividade();
  }
  function aviso(tipo, texto) {
    var el = $('aviso-geral');
    el.hidden = !texto; el.className = 'status ' + (tipo || ''); el.textContent = texto || '';
  }
  function msg(el, tipo, texto) { el.hidden = !texto; el.className = 'status ' + (tipo || ''); el.textContent = texto || ''; }
  function ocupado(btn, sim, rotulo) {
    if (sim) { btn.dataset.rotulo = btn.textContent; btn.textContent = rotulo || 'Aguarde…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.rotulo || btn.textContent; btn.disabled = false; }
  }

  /* ---------- inatividade ---------- */
  function reiniciar() { clearTimeout(timerInativo); timerInativo = setTimeout(sairPorInatividade, INATIVIDADE_MS); }
  function iniciarInatividade() { reiniciar(); }
  function pararInatividade() { clearTimeout(timerInativo); }
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, function () { if (timerInativo) reiniciar(); }, { passive: true }); });
  function sairPorInatividade() { API.sair(); limparTela(); mostrar('v-login'); aviso('neutra', 'Por segurança, a sessão foi encerrada por inatividade. Entre de novo.'); }

  function limparTela() {
    estado = { itens: [], total: 0, busca: '', atual: null, carregando: false, novas: null };
    $('lista').innerHTML = ''; $('d-corpo').innerHTML = ''; $('d-ass').removeAttribute('src');
    $('busca').value = ''; $('relatorio').innerHTML = '';
    ['l-senha', 'c-atual', 'c-nova', 'c-nova2', 'n-senha', 'n-senha2'].forEach(function (i) { $(i).value = ''; });
  }
  API.aoSair(function () { limparTela(); mostrar('v-login'); });

  /* ---------- login ---------- */
  $('f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('l-email').value.trim(), senha = $('l-senha').value, erro = $('l-erro');
    aviso('', '');
    if (!email || !senha) { msg(erro, 'falha', 'Informe o e-mail e a senha.'); return; }
    msg(erro, '', '');
    var btn = $('l-entrar'); ocupado(btn, true, 'Entrando…');
    API.entrar(email, senha, $('l-lembrar').checked).then(function () {
      return API.ehAdmin();
    }).then(function (ok) {
      if (!ok) { API.sair(); msg($('l-erro'), 'falha', 'Esta conta não tem acesso à área restrita.'); return; }
      $('l-senha').value = '';
      irLista();
    }).catch(function (er) { msg($('l-erro'), 'falha', er.message || 'Não foi possível entrar agora.'); })
      .then(function () { ocupado(btn, false); });
  });
  $('l-esqueci').addEventListener('click', function () {
    var email = $('l-email').value.trim(), erro = $('l-erro');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg(erro, 'falha', 'Digite o seu e-mail no campo acima e toque de novo em "Esqueci minha senha".'); return; }
    msg(erro, '', '');
    API.recuperar(email).then(function () {
      aviso('ok', 'Se este e-mail tiver acesso, enviamos um link para criar uma nova senha. Confira também o spam.');
    }).catch(function (er) { msg(erro, 'falha', er.message); });
  });

  /* ---------- nova senha (link do e-mail) ---------- */
  function validarSenha(nova, repete) {
    if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.';
    if (nova !== repete) return 'As duas senhas não são iguais.';
    return '';
  }
  $('f-nova-senha').addEventListener('submit', function (e) {
    e.preventDefault();
    var erro = $('n-erro'), v = validarSenha($('n-senha').value, $('n-senha2').value);
    if (v) { msg(erro, 'falha', v); return; }
    msg(erro, '', '');
    API.definirSenhaNova($('n-senha').value).then(function () {
      return API.usuario();
    }).then(function () { return API.ehAdmin(); }).then(function (ok) {
      if (!ok) { API.sair(); return; }
      $('n-senha').value = ''; $('n-senha2').value = '';
      irLista(); aviso('ok', 'Senha alterada com sucesso.');
    }).catch(function (er) { msg(erro, 'falha', er.message); });
  });

  /* ---------- lista ---------- */
  function irLista() { mostrar('v-lista'); carregar(true); }

  function cartao(f) {
    var nova = !f.vista_em;
    return '<button type="button" class="cartao' + (nova ? ' nova' : '') + '" data-id="' + esc(f.id) + '">' +
      '<span class="nome">' + esc(f.nome) + '</span>' +
      '<span class="meta">' + esc(C.dataHoraBR(f.criado_em)) + ' · ' + esc(f.servicos || '—') + '</span>' +
      '<span>' + (nova ? '<span class="selo nova">NOVA</span>' : '') +
      (f.alerta ? '<span class="selo atencao">ATENÇÃO NA SAÚDE</span>' : '') +
      (f.menor_de_idade ? '<span class="selo menor">MENOR DE IDADE</span>' : '') + '</span></button>';
  }
  function desenharLista() {
    var l = $('lista');
    l.innerHTML = estado.itens.map(cartao).join('');
    var novas = estado.busca ? 0 : (estado.novas || 0);
    var t = estado.total;
    $('lista-resumo').textContent = estado.carregando ? 'Carregando…' :
      (t === 0 ? (estado.busca ? 'Nenhuma ficha encontrada para essa busca.' : 'Nenhuma ficha recebida ainda.') :
        t + (t === 1 ? ' ficha' : ' fichas') + (estado.busca ? ' encontradas' : '') + (novas ? ' · ' + novas + (novas === 1 ? ' nova' : ' novas') : ''));
    $('mais').hidden = estado.itens.length >= estado.total;
  }
  function carregar(zerar) {
    if (zerar) { estado.itens = []; estado.total = 0; if (!estado.busca) API.contarNovas().then(function (n) { estado.novas = n; desenharLista(); }).catch(function () { /* opcional */ }); }
    estado.carregando = true; desenharLista();
    var pedido = estado.busca;
    return API.listar({ busca: estado.busca, inicio: estado.itens.length, limite: PAGINA }).then(function (r) {
      if (pedido !== estado.busca) return;
      estado.itens = estado.itens.concat(r.itens); estado.total = r.total;
    }).catch(function (er) { aviso('falha', er.message); })
      .then(function () { estado.carregando = false; desenharLista(); });
  }
  $('lista').addEventListener('click', function (e) {
    var b = e.target.closest('.cartao'); if (b) abrir(b.dataset.id);
  });
  $('mais').addEventListener('click', function () { carregar(false); });
  $('busca').addEventListener('input', function () {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(function () { estado.busca = $('busca').value.trim(); carregar(true); }, 300);
  });

  /* ---------- backup ---------- */
  $('exportar').addEventListener('click', function () {
    var m = $('exportar-msg'), btn = this;
    btn.disabled = true; m.hidden = false; m.textContent = 'Preparando a cópia…';
    API.exportarTudo(function (n) { m.textContent = 'Reunindo as fichas… ' + n; }).then(function (todas) {
      todas.forEach(function (f) { delete f.ip_hash; });
      var hoje = new Date().toISOString().slice(0, 10);
      C.baixarBlob(new Blob([JSON.stringify({ geradoEm: new Date().toISOString(), total: todas.length, fichas: todas }, null, 1)], { type: 'application/json' }),
        'fichas-copia-de-seguranca-' + hoje + '.json');
      m.textContent = todas.length + ' fichas salvas no arquivo baixado. Guarde-o em um lugar seguro: ele contém dados de saúde.';
    }).catch(function (er) { m.textContent = er.message; })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- detalhe ---------- */
  function registroDe(f) {
    var d = f.dados || {};
    return { versaoFicha: d.versaoFicha, protocolo: f.protocolo, dataHoraLocal: C.dataHoraBR(f.criado_em), hash: f.hash_sha256,
      identificacao: d.identificacao, saude: d.saude, unhas: d.unhas, historico: d.historico, termos: d.termos, assinatura: f.assinatura };
  }
  function abrir(id) {
    aviso('', '');
    API.obter(id).then(function (f) {
      estado.atual = f;
      var reg = registroDe(f), i = reg.identificacao;
      $('d-titulo').textContent = i.nome;
      $('d-protocolo').textContent = f.protocolo;
      $('d-data').textContent = reg.dataHoraLocal;
      $('d-selos').innerHTML = (f.alerta ? '<span class="selo atencao">ATENÇÃO NA SAÚDE</span>' : '') + (f.menor_de_idade ? '<span class="selo menor">MENOR DE IDADE</span>' : '');
      $('d-corpo').innerHTML = C.secoes(reg).map(function (sec) {
        return '<h4>' + esc(sec[0]) + '</h4><dl>' + sec[1].map(function (l) {
          return '<dt>' + esc(l[0]) + '</dt><dd' + (l[2] ? ' class="sim"' : '') + '>' + esc(l[1]) + '</dd>';
        }).join('') + '</dl>';
      }).join('');
      $('d-termos').innerHTML = reg.termos.map(function (t) { return '<li>' + (t.aceito ? '☑ ' : '☐ ') + esc(t.texto) + '</li>'; }).join('');
      $('d-ass-titulo').textContent = f.menor_de_idade ? 'Assinatura do(a) responsável' : 'Assinatura da cliente';
      if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(f.assinatura)) $('d-ass').src = f.assinatura; else $('d-ass').removeAttribute('src');
      $('d-hash').textContent = f.hash_sha256;
      var dig = String(f.whatsapp || '').replace(/\D/g, '');
      if (dig.length === 10 || dig.length === 11) dig = '55' + dig;
      $('d-whats').href = 'https://wa.me/' + dig;
      msg($('d-status'), '', '');
      msg($('d-integridade'), 'neutra', 'Conferindo a integridade da ficha…');
      mostrar('v-detalhe');
      API.integra(f.id).then(function (ok) {
        if (ok === true) msg($('d-integridade'), 'ok', '✓ Ficha íntegra: nada foi alterado desde o envio.');
        else msg($('d-integridade'), 'falha', '⚠ Atenção: o conteúdo desta ficha não confere com o código registrado no envio.');
      }).catch(function () { msg($('d-integridade'), '', ''); });
      if (!f.vista_em) API.marcarVista(f.id).then(function () {
        f.vista_em = new Date().toISOString();
        if (estado.novas) estado.novas--;
        estado.itens.forEach(function (x) { if (x.id === f.id) x.vista_em = f.vista_em; });
      }).catch(function () { /* não é essencial */ });
    }).catch(function (er) { aviso('falha', er.message); });
  }
  $('d-voltar').addEventListener('click', function () { mostrar('v-lista'); desenharLista(); });

  function prepararRegistro() {
    var reg = registroDe(estado.atual);
    if (/^data:image\/png/.test(reg.assinatura)) {
      return window.CrisPDF.assinaturaParaJpeg(reg.assinatura).then(function (j) { reg.assinatura = j; return reg; });
    }
    return Promise.resolve(reg);
  }
  $('d-pdf').addEventListener('click', function () {
    if (!estado.atual) return;
    var btn = this; ocupado(btn, true, 'Gerando PDF…');
    prepararRegistro().then(function (reg) {
      var bytes = window.CrisPDF.gerar(reg);
      C.baixarBlob(new Blob([bytes], { type: 'application/pdf' }), C.nomeArquivo(reg, 'pdf'));
      msg($('d-status'), 'ok', 'PDF gerado. Procure em "Downloads".');
    }).catch(function () { msg($('d-status'), 'falha', 'Não foi possível gerar o PDF. Use "Imprimir" e escolha "Salvar como PDF".'); })
      .then(function () { ocupado(btn, false); });
  });
  $('d-imprimir').addEventListener('click', function () {
    if (!estado.atual) return;
    prepararRegistro().then(function (reg) {
      $('relatorio').innerHTML = C.htmlRelatorio(reg);
      document.title = C.nomeArquivo(reg, 'pdf').replace(/\.pdf$/, '');
      window.print();
    });
  });
  var tituloOriginal = document.title;
  window.addEventListener('afterprint', function () { document.title = tituloOriginal; $('relatorio').innerHTML = ''; });

  /* ---------- excluir ---------- */
  var dlg = $('dlg-excluir');
  $('d-excluir').addEventListener('click', function () {
    $('dlg-nome').textContent = estado.atual.nome + ' · ' + estado.atual.protocolo;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
  $('dlg-cancelar').addEventListener('click', function () { dlg.close(); });
  $('dlg-confirmar').addEventListener('click', function () {
    var f = estado.atual, btn = this; ocupado(btn, true, 'Excluindo…');
    API.excluir(f.id).then(function () {
      dlg.close();
      estado.atual = null;
      irLista(); aviso('ok', 'Ficha excluída.');
    }).catch(function (er) { dlg.close(); msg($('d-status'), 'falha', er.message); })
      .then(function () { ocupado(btn, false); });
  });

  /* ---------- minha conta ---------- */
  $('f-conta').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('c-msg'), atual = $('c-atual').value, nova = $('c-nova').value;
    if (!atual) { msg(m, 'falha', 'Digite a sua senha atual.'); return; }
    var v = validarSenha(nova, $('c-nova2').value);
    if (v) { msg(m, 'falha', v); return; }
    msg(m, 'neutra', 'Salvando…');
    API.trocarSenha(atual, nova).then(function () {
      ['c-atual', 'c-nova', 'c-nova2'].forEach(function (i) { $(i).value = ''; });
      msg(m, 'ok', 'Senha alterada com sucesso.');
    }).catch(function (er) { msg(m, 'falha', er.message); });
  });

  /* ---------- navegação ---------- */
  $('nav-lista').addEventListener('click', function () { aviso('', ''); mostrar('v-lista'); carregar(true); });
  $('nav-conta').addEventListener('click', function () {
    aviso('', ''); msg($('c-msg'), '', '');
    var s = API.sessao(); $('c-email').textContent = (s && s.user && s.user.email) || '';
    mostrar('v-conta');
  });
  $('nav-sair').addEventListener('click', function () { API.sair(); aviso('neutra', 'Você saiu. Até logo!'); });

  /* ---------- início ---------- */
  function iniciar() {
    if (!API.configurado()) { mostrar('v-login'); aviso('falha', 'O site ainda não foi configurado (arquivo config.js).'); return; }
    if (/type=recovery/.test(location.hash) && API.sessaoDoLink(location.hash)) {
      history.replaceState(null, '', location.pathname);
      mostrar('v-nova-senha'); return;
    }
    if (API.sessao()) {
      API.ehAdmin().then(function (ok) {
        if (!ok) throw new Error('sem acesso');
        return API.usuario().catch(function () { /* e-mail na barra é opcional */ });
      }).then(irLista).catch(function () { API.sair(true); mostrar('v-login'); });
    } else mostrar('v-login');
  }
  window.addEventListener('hashchange', function () { if (/type=recovery/.test(location.hash)) iniciar(); });
  iniciar();
})();
