/* Gerador de PDF próprio (sem bibliotecas externas). A4, fontes padrão do PDF.
   Uso: CrisPDF.gerar(registro) -> Uint8Array. A assinatura precisa ser JPEG (use CrisPDF.assinaturaParaJpeg). */
(function (raiz) {
  'use strict';
  var Comum = (typeof module !== 'undefined' && module.exports) ? require('./comum.js') : raiz.CrisComum;

  var LARG = {"H":[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],"HB":[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,611,278,556,500,1000,556,556,333,1000,667,333,1000,611,611,611,611,278,278,500,500,350,556,1000,333,1000,556,333,944,611,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],"T":[250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,761,500,444,333,500,444,1000,500,500,333,1000,556,333,889,444,611,444,444,333,333,444,444,350,500,1000,333,980,389,333,722,444,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500]};

  var MM = 72 / 25.4, PW = 595.28, PH = 841.89;
  var ML = 18 * MM, MR = 18 * MM, MT = 16 * MM, MB = 20 * MM;
  var LARGURA = PW - ML - MR;
  var VERDE = '#2f5233', DOURADO = '#b79b5e', CINZA = '#555555', LINHA = '#e4dfd0', TEXTO = '#333333', ALERTA = '#8a5a00';
  var FONTES = { H: 'F1', HB: 'F2', T: 'F3' };

  /* Unicode -> cp1252 (para as fontes padrão do PDF) */
  var CP = { 8364: 128, 8218: 130, 402: 131, 8222: 132, 8230: 133, 8224: 134, 8225: 135, 710: 136, 8240: 137, 352: 138, 8249: 139, 338: 140, 381: 142,
    8216: 145, 8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151, 732: 152, 8482: 153, 353: 154, 8250: 155, 339: 156, 382: 158, 376: 159 };
  function codigos(s) {
    var out = [];
    s = String(s).replace(/\r/g, '');
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), b;
      if (c === 9) b = 32;
      else if (c >= 32 && c < 127) b = c;
      else if (c >= 160 && c <= 255) b = c;
      else if (CP[c]) b = CP[c];
      else if (c === 0x2610 || c === 0x2611) b = c === 0x2611 ? 120 : 32;
      else b = 63;
      out.push(b);
    }
    return out;
  }
  function larg(s, f, tam) {
    var t = LARG[f], cs = codigos(s), w = 0;
    for (var i = 0; i < cs.length; i++) w += (cs[i] >= 32 ? t[cs[i] - 32] : 0);
    return w * tam / 1000;
  }
  function pdfStr(s) {
    var cs = codigos(s), o = '(';
    for (var i = 0; i < cs.length; i++) {
      var b = cs[i];
      if (b === 40 || b === 41 || b === 92) o += '\\' + String.fromCharCode(b);
      else if (b < 127) o += String.fromCharCode(b);
      else o += '\\' + ('00' + b.toString(8)).slice(-3);
    }
    return o + ')';
  }
  function cor(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(function (x) { return x.toFixed(3); }).join(' ');
  }
  function f2(n) { return n.toFixed(2); }

  /* quebra de linhas por largura */
  function quebrar(texto, f, tam, maxW) {
    var linhas = [];
    String(texto).replace(/\r/g, '').split('\n').forEach(function (par) {
      var atual = '';
      par.split(/ +/).forEach(function (pal) {
        if (pal === '' && atual === '') return;
        var tent = atual ? atual + ' ' + pal : pal;
        if (larg(tent, f, tam) <= maxW) { atual = tent; return; }
        if (atual) { linhas.push(atual); atual = ''; }
        while (larg(pal, f, tam) > maxW) {       // palavra maior que a linha
          var k = pal.length;
          while (k > 1 && larg(pal.slice(0, k), f, tam) > maxW) k--;
          linhas.push(pal.slice(0, k)); pal = pal.slice(k);
        }
        atual = pal;
      });
      linhas.push(atual);
    });
    return linhas;
  }

  /* JPEG: lê largura, altura e componentes */
  function lerJpeg(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('A assinatura precisa ser JPEG.');
    var i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      var m = bytes[i + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      var len = bytes[i + 2] * 256 + bytes[i + 3];
      if ((m >= 0xC0 && m <= 0xCF) && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: bytes[i + 5] * 256 + bytes[i + 6], w: bytes[i + 7] * 256 + bytes[i + 8], n: bytes[i + 9] };
      }
      i += 2 + len;
    }
    throw new Error('JPEG inválido.');
  }
  function b64ParaBytes(b64) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function gerar(reg) {
    var paginas = [], pg = null, y = 0;       // y = distância do topo, em pontos
    var temImg = false;

    function novaPagina() { pg = []; paginas.push(pg); y = MT; }
    function espaco(h) { if (y + h > PH - MB) novaPagina(); }
    function base(topo, tam, lead) { return PH - (topo + (lead - tam) / 2 + tam * 0.8); }

    function texto(x, topo, s, f, tam, lead, c, alinhar, largCx) {
      var w = larg(s, f, tam);
      if (alinhar === 'c') x = x + (largCx - w) / 2;
      else if (alinhar === 'r') x = x + largCx - w;
      pg.push('BT /' + FONTES[f] + ' ' + tam + ' Tf ' + cor(c) + ' rg ' + f2(x) + ' ' + f2(base(topo, tam, lead)) + ' Td ' + pdfStr(s) + ' Tj ET');
    }
    function retangulo(x, topo, w, h, c) { pg.push(cor(c) + ' rg ' + f2(x) + ' ' + f2(PH - topo - h) + ' ' + f2(w) + ' ' + f2(h) + ' re f'); }
    function linha(x1, x2, topo, esp, c) {
      pg.push(cor(c) + ' RG ' + esp + ' w ' + f2(x1) + ' ' + f2(PH - topo) + ' m ' + f2(x2) + ' ' + f2(PH - topo) + ' l S');
    }
    function paragrafo(s, f, tam, lead, c, opc) {
      opc = opc || {};
      var x = opc.x == null ? ML : opc.x, w = opc.w == null ? LARGURA : opc.w;
      quebrar(s, f, tam, w).forEach(function (ln) {
        espaco(lead);
        texto(x, y, ln, f, tam, lead, c, opc.alinhar, w);
        y += lead;
      });
    }
    function titulo2(t) {
      espaco(10 + 16 + 3 + 12 + 6 + 2);        // título + linha + pelo menos uma linha da tabela
      y += 10;
      texto(ML, y, t, 'T', 13, 16, VERDE); y += 16 + 2;
      linha(ML, ML + LARGURA, y, 0.8, DOURADO); y += 0.8 + 1;
    }

    novaPagina();
    /* cabeçalho */
    texto(ML, y, 'Ficha de Anamnese', 'T', 22, 26, VERDE, 'c', LARGURA); y += 26;
    texto(ML, y, 'CRIS FERREIRA - NAIL DESIGNER', 'H', 8.5, 11, CINZA, 'c', LARGURA); y += 11 + 3 * MM;
    linha(ML, ML + LARGURA, y, 1.4, DOURADO); y += 1.4 + 3 * MM;

    /* caixa de protocolo */
    var hMeta = 12 + 10;
    retangulo(ML, y, LARGURA, hMeta, '#f3efe2');
    var lab1 = 'Protocolo: ', lab2 = 'Preenchida em: ';
    texto(ML + 6, y + 5, lab1, 'HB', 9.5, 12, '#000000');
    texto(ML + 6 + larg(lab1, 'HB', 9.5), y + 5, reg.protocolo, 'H', 9.5, 12, TEXTO);
    var xr = ML + LARGURA - 6, wv = larg(reg.dataHoraLocal, 'H', 9.5), wl = larg(lab2, 'HB', 9.5);
    texto(xr - wv - wl, y + 5, lab2, 'HB', 9.5, 12, '#000000');
    texto(xr - wv, y + 5, reg.dataHoraLocal, 'H', 9.5, 12, TEXTO);
    y += hMeta;

    /* seções */
    var c1 = LARGURA * 0.58, c2 = LARGURA * 0.42;
    Comum.secoes(reg).forEach(function (sec) {
      titulo2(sec[0]);
      sec[1].forEach(function (l) {
        var destaque = !!l[2];
        var a = quebrar(l[0], 'H', 9.5, c1 - 4), b = quebrar(l[1], 'HB', 9.5, c2 - 4);
        var n = Math.max(a.length, b.length), h = n * 12 + 6;
        espaco(h);
        a.forEach(function (ln, k) { texto(ML + 2, y + 3 + k * 12, ln, 'H', 9.5, 12, TEXTO); });
        b.forEach(function (ln, k) { texto(ML + c1 + 2, y + 3 + k * 12, ln, 'HB', 9.5, 12, destaque ? ALERTA : '#000000'); });
        linha(ML, ML + LARGURA, y + h, 0.5, LINHA);
        y += h;
      });
    });

    /* termos */
    titulo2('Termos');
    y += 2;
    reg.termos.forEach(function (t) {
      paragrafo('[' + (t.aceito ? 'x' : ' ') + '] ' + t.texto, 'H', 9.5, 12, TEXTO);
      y += 1.5 * MM;
    });

    /* assinatura + rodapé de integridade (mantidos juntos) */
    var menor = !!reg.identificacao.menorDeIdade;
    var quem = menor ? 'Assinatura do(a) responsável' : 'Assinatura da cliente';
    var nomeAss = menor ? reg.identificacao.responsavel.nome : reg.identificacao.nome;
    var m = /^data:image\/jpeg;base64,(.+)$/.exec(reg.assinatura || '');
    if (!m) throw new Error('A assinatura precisa ser JPEG.');
    var jpg = b64ParaBytes(m[1]), info = lerJpeg(jpg);
    var boxW = 70 * MM, boxH = 70 * MM / 3;
    var iw = boxW, ih = iw * info.h / info.w;
    if (ih > boxH) { ih = boxH; iw = ih * info.w / info.h; }
    var rodapeLinhas = quebrar('Código de integridade (SHA-256): ' + reg.hash, 'H', 8, LARGURA)
      .concat(quebrar('Documento gerado eletronicamente. Dados de saúde tratados conforme a LGPD, com acesso restrito à profissional.', 'H', 8, LARGURA));
    var blocoH = boxH + 2 + 3 + 12 + 6 * MM + 3 + 0.5 + rodapeLinhas.length * 10 + 4;
    y += 6 * MM;
    espaco(blocoH);
    pg.push('q ' + f2(iw) + ' 0 0 ' + f2(ih) + ' ' + f2(ML) + ' ' + f2(PH - y - ih) + ' cm /Im1 Do Q');
    temImg = pg;                                  // página que usa a imagem
    var paginaImg = pg;
    y += boxH;
    linha(ML, ML + 72 * MM, y, 0.8, '#000000'); y += 3;
    texto(ML, y, quem + ': ' + nomeAss, 'H', 9.5, 12, TEXTO); y += 12 + 6 * MM;
    linha(ML, ML + LARGURA, y, 0.5, '#d3d3d3'); y += 3;
    rodapeLinhas.forEach(function (ln) { texto(ML, y, ln, 'H', 8, 10, CINZA); y += 10; });

    /* rodapé de cada página */
    paginas.forEach(function (p, k) {
      pg = p;
      texto(ML, PH - 11 * MM - 8, 'Protocolo ' + reg.protocolo, 'H', 8, 8, CINZA);
      texto(ML, PH - 11 * MM - 8, 'Página ' + (k + 1), 'H', 8, 8, CINZA, 'r', LARGURA);
    });

    /* ---- monta o arquivo ---- */
    var partes = [], pos = 0, offs = [];
    function bin(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
    function add(u) { if (typeof u === 'string') u = bin(u); partes.push(u); pos += u.length; }
    function obj(n, corpo) { offs[n] = pos; add(n + ' 0 obj\n'); add(corpo); add('\nendobj\n'); }

    var n = paginas.length;
    // 1 catálogo, 2 páginas, 3-5 fontes, 6 imagem, 7 info, depois (página, conteúdo) por página
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = [];
    for (var k = 0; k < n; k++) kids.push((8 + 2 * k) + ' 0 R');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    ['Helvetica', 'Helvetica-Bold', 'Times-Roman'].forEach(function (nome, i) {
      obj(3 + i, '<< /Type /Font /Subtype /Type1 /BaseFont /' + nome + ' /Encoding /WinAnsiEncoding >>');
    });
    offs[6] = pos;
    add('6 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + info.w + ' /Height ' + info.h + ' /ColorSpace /' + (info.n === 1 ? 'DeviceGray' : 'DeviceRGB') +
      ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
    add(jpg); add('\nendstream\nendobj\n');
    var titulo = 'Ficha de Anamnese - ' + reg.identificacao.nome;
    obj(7, '<< /Title ' + pdfStr(titulo) + ' /Author ' + pdfStr('Cris Ferreira - Nail Designer') + ' /Producer (Site da Cris) >>');
    for (k = 0; k < n; k++) {
      var cont = paginas[k].join('\n');
      var usaImg = paginas[k] === paginaImg;
      obj(8 + 2 * k, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents ' + (9 + 2 * k) + ' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>' +
        (usaImg ? ' /XObject << /Im1 6 0 R >>' : '') + ' >> >>');
      offs[9 + 2 * k] = pos;
      add((9 + 2 * k) + ' 0 obj\n<< /Length ' + cont.length + ' >>\nstream\n'); add(cont); add('\nendstream\nendobj\n');
    }
    var total = 8 + 2 * n;
    var xref = pos;
    add('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (var o = 1; o < total; o++) add(('0000000000' + offs[o]).slice(-10) + ' 00000 n \n');
    add('trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 7 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');

    var saida = new Uint8Array(pos), p = 0;
    partes.forEach(function (u) { saida.set(u, p); p += u.length; });
    return saida;
  }

  /* Navegador: converte qualquer imagem de assinatura (png/jpeg) em JPEG com fundo branco */
  function assinaturaParaJpeg(dataUrl) {
    return new Promise(function (ok, erro) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        var x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
        ok(c.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = function () { erro(new Error('assinatura ilegível')); };
      img.src = dataUrl;
    });
  }

  var API = { gerar: gerar, assinaturaParaJpeg: assinaturaParaJpeg };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.CrisPDF = API;
})(typeof window !== 'undefined' ? window : globalThis);
