/* Ficha de Anamnese · Cris Ferreira Nail Designer
   Versão web: grava a ficha no Supabase pela função enviar_ficha. */
(function () {
  'use strict';

  var VERSAO_FICHA = '1.0';

  var ETAPAS = ['Seus dados', 'Sua saúde', 'Suas mãos e unhas', 'Histórico e preferências', 'Revisão e assinatura'];
  var TOTAL = ETAPAS.length;

  var SAUDE = [
    { id: 'alergia', t: 'Tem alergia a esmalte, gel, acrílico, acetona, látex ou outro produto?', d: 'Qual(is)?' },
    { id: 'reacao', t: 'Já teve reação (coceira, vermelhidão, bolhas ou descamação) após algum serviço de unhas?', d: 'O que aconteceu e com qual produto?' },
    { id: 'pele', t: 'Tem dermatite, psoríase, eczema ou pele muito sensível nas mãos?', d: 'Qual?' },
    { id: 'diabetes', t: 'Tem diabetes?', d: 'Está controlada? Conte um pouco.' },
    { id: 'circulacao', t: 'Tem problema de circulação ou dificuldade de cicatrização?', d: 'Conte um pouco.' },
    { id: 'imunidade', t: 'Está com a imunidade baixa ou em algum tratamento que afete a imunidade?', d: 'Conte um pouco.' },
    { id: 'gestante', t: 'Está gestante ou amamentando?', d: 'Há quanto tempo?', ops: ['Sim', 'Não'] },
    { id: 'medicamento', t: 'Usa algum medicamento de uso contínuo (inclusive anticoagulante)?', d: 'Qual(is)?' }
  ];

  var UNHAS = [
    { id: 'infeccao', t: 'Há suspeita de micose, infecção ou manchas diferentes nas unhas?', d: 'Em qual unha? (opcional)', ops: ['Sim', 'Não'] },
    { id: 'ferida', t: 'Há feridas, cortes, inflamação ou unha encravada nas mãos?', d: 'Onde? (opcional)', ops: ['Sim', 'Não'] },
    { id: 'fragil', t: 'Suas unhas estão muito fracas, descascando ou descoladas?', d: 'Conte um pouco (opcional)', ops: ['Sim', 'Não'] },
    { id: 'habito', t: 'Costuma roer ou arrancar as unhas ou cutículas?', d: 'Conte um pouco (opcional)', ops: ['Sim', 'Não'] }
  ];

  var TERMOS = [
    { id: 'termo_veracidade', obrig: true,
      curto: 'Declaro que as informações que prestei são verdadeiras e completas.',
      texto: 'Vou avisar a Cris sobre qualquer mudança na minha saúde antes dos próximos atendimentos.' },
    { id: 'termo_riscos', obrig: true,
      curto: 'Estou ciente dos riscos e das orientações do serviço e autorizo sua realização.',
      texto: 'Produtos usados em unhas (como géis e acrilatos) podem causar reação alérgica em algumas pessoas, com coceira, vermelhidão, bolhas ou descamação. Vou avisar imediatamente se sentir ardência, calor, coceira ou desconforto durante ou depois do atendimento e seguirei as orientações de cuidado recebidas. Esta ficha não substitui avaliação médica: em caso de reação, procurarei atendimento médico.' },
    { id: 'termo_lgpd', obrig: true,
      curto: 'Autorizo o uso dos meus dados de saúde para o meu atendimento (LGPD).',
      texto: 'As informações de saúde desta ficha são dados pessoais sensíveis. Serão usadas somente para avaliar a segurança do serviço e manter o histórico do meu atendimento, com acesso restrito à Cris, e não serão compartilhadas com terceiros. Posso pedir acesso, correção ou exclusão dos meus dados a qualquer momento, falando diretamente com a Cris.' },
    { id: 'termo_imagem', obrig: false,
      curto: 'Autorizo o uso de fotos das minhas unhas (sem mostrar meu rosto) nas redes sociais da Cris. (opcional)',
      texto: 'Posso retirar esta autorização quando quiser.' }
  ];

  /* ---------- UTILITÁRIOS ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var form = $('ficha');
  var C = window.CrisComum;
  var esc = C.esc, dataBR = C.dataBR;
  var etapaAtual = 1;
  var registro = null;       // ficha enviada (fica só na memória desta tela)
  var enviando = false;
  var primeiraVez = true;
  var tituloOriginal = document.title;

  function attr(s) { return esc(s); }

  function idadeDe(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var p = iso.split('-').map(Number);
    var hoje = new Date();
    var idade = hoje.getFullYear() - p[0];
    var m = hoje.getMonth() + 1 - p[1];
    if (m < 0 || (m === 0 && hoje.getDate() < p[2])) idade--;
    return idade;
  }

  /* ---------- MONTAGEM DAS PERGUNTAS ---------- */
  function renderPerguntas(alvo, lista, detalheObrig) {
    alvo.innerHTML = lista.map(function (p) {
      var ops = p.ops || ['Sim', 'Não', 'Não sei'];
      return '<div class="campo" data-tipo="grupo" data-req="1" data-id="' + p.id + '" data-nome="' + attr(p.t) + '" data-detalhe="' + (detalheObrig ? 'obrig' : 'opc') + '">' +
        '<p class="pergunta" id="q_' + p.id + '">' + esc(p.t) + '</p>' +
        '<div class="opcoes" role="radiogroup" aria-labelledby="q_' + p.id + '">' +
        ops.map(function (o) {
          return '<label class="pill"><input type="radio" name="' + p.id + '" value="' + o + '"><span>' + o + '</span></label>';
        }).join('') +
        '</div>' +
        '<div class="detalhe" hidden><input type="text" name="' + p.id + '_detalhe" maxlength="200" placeholder="' + attr(p.d) + '" aria-label="' + attr(p.d) + '"></div>' +
        '<p class="erro" role="alert"></p></div>';
    }).join('');
  }

  function renderTermos() {
    $('lista-termos').innerHTML = TERMOS.map(function (t) {
      return '<div class="campo termo"' + (t.obrig ? ' data-tipo="aceite" data-req="1"' : '') + ' data-nome="Termo">' +
        '<label class="check"><input type="checkbox" name="' + t.id + '"><span>' + esc(t.curto) + '</span></label>' +
        '<p class="termo-texto">' + esc(t.texto) + '</p>' +
        '<p class="erro" role="alert"></p></div>';
    }).join('');
  }

  /* detalhe aparece quando marca "Sim" */
  form.addEventListener('change', function (e) {
    var el = e.target;
    if (el.type === 'radio') {
      var campo = el.closest('.campo');
      var det = campo && campo.querySelector('.detalhe');
      if (det) {
        det.hidden = el.value !== 'Sim';
        if (el.value === 'Sim') det.querySelector('input').focus();
        else det.querySelector('input').value = '';
      }
    }
    if (el.id === 'nascimento') atualizarMenor();
    // Texto digitado é revalidado em "input" (abaixo), não ao sair do campo:
    // assim a mensagem de erro não some no meio de um toque e não desloca a tela.
    var texto = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(radio|checkbox|date)$/.test(el.type));
    if (!texto && el.closest && el.closest('.campo.invalido')) validarCampo(el.closest('.campo'));
  });
  form.addEventListener('input', function (e) {
    var el = e.target;
    var c = el.closest && el.closest('.campo.invalido');
    if (c && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(radio|checkbox|date)$/.test(el.type)))) validarCampo(c);
  });

  function ehMenor() {
    var i = idadeDe($('nascimento').value);
    return i !== null && i < 18;
  }
  function atualizarMenor() {
    var menor = ehMenor();
    $('bloco-responsavel').hidden = !menor;
    $('ass-quem').textContent = menor ? '(do(a) responsável)' : '';
  }

  /* ---------- MÁSCARAS ---------- */
  function mascaraTel(el) {
    el.addEventListener('input', function () {
      var d = el.value.replace(/\D/g, '').slice(0, 11), s = d;
      if (d.length > 10) s = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
      else if (d.length > 6) s = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      else if (d.length > 2) s = '(' + d.slice(0, 2) + ') ' + d.slice(2);
      else if (d.length > 0) s = '(' + d;
      el.value = s;
    });
  }
  mascaraTel($('whatsapp'));
  mascaraTel($('resp_tel'));
  $('instagram').addEventListener('blur', function () {
    var v = this.value.trim().replace(/^@+/, '').replace(/\s+/g, '');
    this.value = v ? '@' + v : '';
  });
  var hojeISO = new Date().toISOString().slice(0, 10);
  $('nascimento').setAttribute('max', hojeISO);
  $('nascimento').setAttribute('min', '1900-01-01');

  /* ---------- ASSINATURA ---------- */
  var cv = $('assinatura'), ctx = cv.getContext('2d'), desenhando = false, temTinta = false;
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1c2a1f';

  function posCanvas(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
  }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
    desenhando = true; temTinta = true;
    var p = posCanvas(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    var c = cv.closest('.campo'); if (c) { c.classList.remove('invalido'); }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!desenhando) return;
    e.preventDefault();
    var p = posCanvas(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    cv.addEventListener(ev, function () { desenhando = false; });
  });
  function limparAssinatura() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    temTinta = false;
  }
  $('limpar-ass').addEventListener('click', limparAssinatura);

  /* JPEG com fundo branco (a assinatura é desenhada sobre fundo transparente) */
  function assinaturaJpeg() {
    var t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
    var x = t.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, t.width, t.height); x.drawImage(cv, 0, 0);
    return t.toDataURL('image/jpeg', 0.9);
  }

  /* ---------- VALIDAÇÃO ---------- */
  function validarCampo(c) {
    var t = c.dataset.tipo;
    if (!t || c.closest('[hidden]')) return true;
    var msg = '', input = c.querySelector('input:not([type=radio]):not([type=checkbox]), textarea');
    var val = input ? input.value.trim() : '';

    if (t === 'texto') {
      if (!val) msg = 'Preencha este campo.';
    } else if (t === 'email') {
      if (!val) msg = 'Informe seu e-mail.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) msg = 'E-mail inválido. Confira se digitou certo.';
    } else if (t === 'tel') {
      var dig = val.replace(/\D/g, '');
      if (!val) msg = 'Informe o telefone com DDD.';
      else if (dig.length < 10) msg = 'Telefone incompleto. Use DDD + número.';
    } else if (t === 'data') {
      var idade = idadeDe(val);
      if (!val) msg = 'Informe a data de nascimento.';
      else if (idade === null || idade < 0 || idade > 110) msg = 'Data inválida.';
    } else if (t === 'grupo') {
      var marcado = c.querySelector('input[type=radio]:checked');
      if (!marcado) msg = 'Escolha uma opção.';
      else if (marcado.value === 'Sim' && c.dataset.detalhe === 'obrig' && !c.querySelector('.detalhe input').value.trim()) {
        msg = 'Conte um pouco mais, por favor.';
      }
    } else if (t === 'multi') {
      if (!c.querySelector('input[type=checkbox]:checked')) msg = 'Marque pelo menos uma opção.';
    } else if (t === 'aceite') {
      if (!c.querySelector('input[type=checkbox]').checked) msg = 'Este item é necessário para continuar.';
    } else if (t === 'assinatura') {
      if (!temTinta) msg = 'Assine no quadro para concluir.';
    }

    c.classList.toggle('invalido', !!msg);
    var e = c.querySelector(':scope > .erro');
    if (e) e.textContent = msg;
    return !msg;
  }

  function validarEtapa(n) {
    var sec = form.querySelector('.etapa[data-etapa="' + n + '"]');
    var primeiro = null;
    sec.querySelectorAll('.campo').forEach(function (c) {
      if (!validarCampo(c) && !primeiro) primeiro = c;
    });
    if (primeiro) {
      primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var foco = primeiro.querySelector('input:not([type=radio]):not([type=checkbox]), textarea') ||
        primeiro.querySelector('input');
      if (foco && foco.type !== 'radio' && foco.type !== 'checkbox') foco.focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  /* ---------- COLETA DOS DADOS ---------- */
  function valor(nome) { var el = form.elements[nome]; return el && el.value ? el.value.trim() : ''; }

  function itensDe(lista) {
    return lista.map(function (p) {
      return { id: p.id, pergunta: p.t, resposta: valor(p.id), detalhe: valor(p.id + '_detalhe') };
    });
  }

  function coletar() {
    var menor = ehMenor();
    var servicos = Array.prototype.map.call(form.querySelectorAll('input[name=servico]:checked'), function (x) { return x.value; });
    return {
      identificacao: {
        nome: valor('nome'), nascimento: valor('nascimento'), whatsapp: valor('whatsapp'),
        email: valor('email'), instagram: valor('instagram'), menorDeIdade: menor,
        responsavel: menor ? { nome: valor('resp_nome'), parentesco: valor('resp_parentesco'), telefone: valor('resp_tel') } : null
      },
      saude: { itens: itensDe(SAUDE), outra: valor('saude_outra') },
      unhas: { itens: itensDe(UNHAS) },
      historico: { jaFezAlongamentoOuGel: valor('ja_fez'), contatoAguaQuimicos: valor('agua'), servicosDesejados: servicos, preferencias: valor('preferencias') },
      termos: TERMOS.map(function (t) {
        return { id: t.id, texto: t.curto, obrigatorio: t.obrig, aceito: form.elements[t.id].checked };
      })
    };
  }

  var secoes = C.secoes;

  function montarResumo() {
    $('resumo').innerHTML = secoes(coletar()).map(function (sec) {
      return '<h4>' + esc(sec[0]) + '</h4><dl>' + sec[1].map(function (l) {
        return '<dt>' + esc(l[0]) + '</dt><dd' + (l[2] ? ' class="sim"' : '') + '>' + esc(l[1]) + '</dd>';
      }).join('') + '</dl>';
    }).join('');
  }

  /* ---------- NAVEGAÇÃO ---------- */
  function irPara(n) {
    etapaAtual = n;
    form.querySelectorAll('.etapa').forEach(function (s) { s.hidden = Number(s.dataset.etapa) !== n; });
    $('barra-preenchida').style.width = (n / TOTAL * 100) + '%';
    $('progresso-texto').textContent = 'Etapa ' + n + ' de ' + TOTAL + ' · ' + ETAPAS[n - 1];
    $('btn-voltar').hidden = n === 1;
    $('btn-avancar').textContent = n === TOTAL ? 'Concluir e enviar' : 'Continuar';
    mostrarStatusFinal('', '');
    if (n === TOTAL) {
      montarResumo();
      $('carimbo').textContent = 'O protocolo, a data e a hora serão registrados automaticamente ao enviar.';
    }
    if (n !== 1 || !primeiraVez) window.scrollTo({ top: 0, behavior: 'smooth' });
    var h = form.querySelector('.etapa[data-etapa="' + n + '"] h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function avancar() {
    if (!validarEtapa(etapaAtual)) return;
    if (etapaAtual < TOTAL) irPara(etapaAtual + 1);
    else enviar();
  }
  $('btn-avancar').addEventListener('click', avancar);
  $('btn-voltar').addEventListener('click', function () { if (etapaAtual > 1) irPara(etapaAtual - 1); });
  form.addEventListener('submit', function (e) { e.preventDefault(); avancar(); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
      e.preventDefault(); avancar();
    }
  });

  /* ---------- ENVIO ---------- */
  function mostrarStatusFinal(tipo, texto) { pintar($('status-final'), tipo, texto); }
  function pintar(el, tipo, texto) { el.hidden = !texto; el.className = 'status ' + tipo; el.textContent = texto || ''; }

  function enviar() {
    if (enviando) return;
    enviando = true;
    var btn = $('btn-avancar'), voltar = $('btn-voltar');
    btn.disabled = true; voltar.disabled = true;
    btn.textContent = 'Enviando…';
    mostrarStatusFinal('carregando', 'Enviando a sua ficha. Aguarde um instante…');
    var dados = coletar();
    dados.versaoFicha = VERSAO_FICHA;
    dados.site = form.elements.site.value;       // campo-armadilha (deve ir vazio)
    dados.assinatura = assinaturaJpeg();
    window.CrisAPI.enviarFicha(dados).then(function (res) {
      if (!res || !res.ok) throw new Error('resposta');
      registro = {
        versaoFicha: dados.versaoFicha, protocolo: res.protocolo, dataHoraLocal: res.dataHoraLocal, hash: res.hash,
        identificacao: dados.identificacao, saude: dados.saude, unhas: dados.unhas, historico: dados.historico,
        termos: dados.termos, assinatura: dados.assinatura
      };
      $('ok-nome').textContent = dados.identificacao.nome.split(' ')[0];
      $('ok-protocolo').textContent = res.protocolo;
      $('ok-data').textContent = res.dataHoraLocal;
      form.hidden = true;
      $('sucesso').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function (e) {
      btn.textContent = 'Tentar de novo';
      var msg = (e && e.codigo) ? e.message : 'Não foi possível enviar agora. Confira sua internet e toque em "Tentar de novo". Sua ficha continua aqui, nada foi perdido.';
      mostrarStatusFinal('falha', msg);
    }).then(function () {
      enviando = false; btn.disabled = false; voltar.disabled = false;
    });
  }

  /* ---------- CÓPIA DA CLIENTE ---------- */
  function nomeBase() { return C.nomeArquivo(registro, 'pdf'); }

  function imprimir() {
    if (!registro) return;
    $('relatorio').innerHTML = C.htmlRelatorio(registro);
    document.title = nomeBase().replace(/\.pdf$/, '');
    window.print();
  }
  $('btn-imprimir').addEventListener('click', imprimir);
  window.addEventListener('afterprint', function () { document.title = tituloOriginal; $('relatorio').innerHTML = ''; });

  $('btn-pdf').addEventListener('click', function () {
    if (!registro) return;
    var btn = this, rotulo = btn.textContent;
    btn.disabled = true; btn.textContent = 'Gerando PDF…';
    try {
      var bytes = window.CrisPDF.gerar(registro);
      C.baixarBlob(new Blob([bytes], { type: 'application/pdf' }), nomeBase());
      pintar($('status-copia'), 'ok', 'Cópia gerada. Procure o arquivo em "Downloads" (ou na tela de compartilhar do seu celular).');
    } catch (e) {
      pintar($('status-copia'), 'falha', 'Não foi possível gerar o PDF aqui. Vamos abrir a impressão: escolha "Salvar como PDF".');
      imprimir();
    }
    btn.disabled = false; btn.textContent = rotulo;
  });

  /* Limpa tudo da memória e da tela (útil quando o aparelho é compartilhado) */
  $('btn-nova').addEventListener('click', function () {
    form.reset();
    limparAssinatura();
    form.querySelectorAll('.detalhe').forEach(function (d) { d.hidden = true; });
    form.querySelectorAll('.campo.invalido').forEach(function (c) { c.classList.remove('invalido'); });
    atualizarMenor();
    registro = null;
    $('relatorio').innerHTML = '';
    pintar($('status-copia'), '', '');
    $('sucesso').hidden = true;
    form.hidden = true;
    $('boasvindas').hidden = false;
    window.scrollTo(0, 0);
  });

  $('btn-comecar').addEventListener('click', function () {
    $('boasvindas').hidden = true;
    form.hidden = false;
    irPara(1);
    primeiraVez = false;
  });

  /* ---------- INÍCIO ---------- */
  renderPerguntas($('lista-saude'), SAUDE, true);
  renderPerguntas($('lista-unhas'), UNHAS, false);
  renderTermos();
  irPara(1);
  window.scrollTo(0, 0);
})();
