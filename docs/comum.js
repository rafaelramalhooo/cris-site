/* Funções compartilhadas (formulário da cliente e área da Cris). Sem dependências. */
(function (raiz) {
  'use strict';

  var PROFISSIONAL = 'Cris Ferreira';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function dataBR(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : (iso || '');
  }
  /* "21/10/2026, 15:30" no horário de Brasília (mesmo formato gravado pelo servidor) */
  function dataHoraBR(d) {
    var p = {};
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d)).forEach(function (x) { p[x.type] = x.value; });
    return p.day + '/' + p.month + '/' + p.year + ', ' + p.hour + ':' + p.minute;
  }
  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cliente';
  }
  function nomeArquivo(reg, ext) {
    return 'Ficha de Anamnese - ' + reg.identificacao.nome.replace(/[\\/:*?"<>|]+/g, ' ').trim() + ' - ' + reg.protocolo + '.' + ext;
  }

  /* linhas [rótulo, valor, destaque] */
  function secoes(d) {
    var i = d.identificacao;
    var s1 = [['Nome', i.nome], ['Nascimento', dataBR(i.nascimento)], ['WhatsApp', i.whatsapp], ['E-mail', i.email]];
    if (i.instagram) s1.push(['Instagram', i.instagram]);
    if (i.responsavel) {
      s1.push(['Responsável', i.responsavel.nome + ' (' + i.responsavel.parentesco + ')']);
      s1.push(['Telefone do responsável', i.responsavel.telefone]);
    }
    var perg = function (it) {
      var r = it.resposta + (it.resposta === 'Sim' && it.detalhe ? ': ' + it.detalhe : (it.detalhe ? ' (' + it.detalhe + ')' : ''));
      return [it.pergunta, r, it.resposta === 'Sim'];
    };
    var s2 = d.saude.itens.map(perg);
    if (d.saude.outra) s2.push(['Outra informação de saúde', d.saude.outra, true]);
    var s3 = d.unhas.itens.map(perg);
    var h = d.historico;
    var s4 = [
      ['Já fez alongamento ou gel antes?', h.jaFezAlongamentoOuGel],
      ['Contato frequente com água ou químicos?', h.contatoAguaQuimicos],
      ['Serviço desejado', h.servicosDesejados.join(', ')]
    ];
    if (h.preferencias) s4.push(['Preferências', h.preferencias]);
    return [['Seus dados', s1], ['Saúde', s2], ['Mãos e unhas', s3], ['Histórico e preferências', s4]];
  }

  function pontosDeAtencao(d) {
    var out = [];
    secoes(d).slice(1, 3).forEach(function (s) {
      s[1].forEach(function (l) { if (l[2]) out.push(l[0] + ': ' + l[1]); });
    });
    return out;
  }

  /* Versão para impressão do navegador (plano B quando o PDF não puder ser gerado) */
  function htmlRelatorio(reg) {
    var secs = secoes(reg).map(function (sec) {
      return '<div class="rel-sec"><h2>' + esc(sec[0]) + '</h2><table>' + sec[1].map(function (l) {
        return '<tr><td>' + esc(l[0]) + '</td><td' + (l[2] ? ' class="sim"' : '') + '>' + esc(l[1]) + '</td></tr>';
      }).join('') + '</table></div>';
    }).join('');
    var termos = '<div class="rel-sec"><h2>Termos</h2><ul class="rel-termos">' + reg.termos.map(function (t) {
      return '<li>' + (t.aceito ? '☑ ' : '☐ ') + esc(t.texto) + '</li>';
    }).join('') + '</ul></div>';
    var menor = reg.identificacao.menorDeIdade;
    var quem = menor ? 'Assinatura do(a) responsável' : 'Assinatura da cliente';
    var assOk = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(reg.assinatura || '');
    var corpo =
      '<div class="rel-topo"><h1>Ficha de Anamnese</h1><p>' + esc(PROFISSIONAL) + ' · Nail Designer</p></div>' +
      '<div class="rel-meta"><span><strong>Protocolo:</strong> ' + esc(reg.protocolo) + '</span><span><strong>Preenchida em:</strong> ' + esc(reg.dataHoraLocal) + '</span></div>' +
      secs + termos +
      '<div class="rel-ass">' + (assOk ? '<img alt="Assinatura" src="' + reg.assinatura + '">' : '') + '<p>' + quem + ': ' +
      esc(menor ? reg.identificacao.responsavel.nome : reg.identificacao.nome) + '</p></div>' +
      '<div class="rel-rodape">Código de integridade (SHA-256): ' + esc(reg.hash) +
      '<br>Documento gerado eletronicamente. Dados de saúde tratados conforme a LGPD, com acesso restrito à profissional.</div>';
    return '<table class="rel-pagina"><thead><tr><td></td></tr></thead><tbody><tr><td>' +
      corpo + '</td></tr></tbody><tfoot><tr><td></td></tr></tfoot></table>';
  }

  function baixarBlob(blob, nome) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  var API = {
    PROFISSIONAL: PROFISSIONAL, esc: esc, dataBR: dataBR, dataHoraBR: dataHoraBR, slug: slug,
    nomeArquivo: nomeArquivo, secoes: secoes, pontosDeAtencao: pontosDeAtencao,
    htmlRelatorio: htmlRelatorio, baixarBlob: baixarBlob
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.CrisComum = API;
})(typeof window !== 'undefined' ? window : globalThis);
