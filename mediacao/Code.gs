/* =====================================================================
   Mediação Fácil by DayIA — serviço de IA (Google Apps Script)

   COMO LIGAR (uma vez só, na conta Google da DayIA: dayaraujoia@gmail.com)
   1. Abra script.google.com > Novo projeto. Apague o que estiver lá e cole este arquivo inteiro.
   2. Pegue a chave da IA:
        Claude (recomendado, não usa os dados para treinar a IA):
        console.anthropic.com > API Keys > Create Key
   3. No Apps Script: Configurações do projeto (engrenagem) > Propriedades do script >
        Adicionar propriedade:  nome  CLAUDE_KEY   valor  a chave copiada
      (Também aceita GEMINI_KEY, do aistudio.google.com, como reserva.
       Atenção: na chave gratuita do Gemini o Google pode usar os textos para treinar a IA.
       Por causa do sigilo da mediação, prefira o Claude.)
   4. Implantar > Nova implantação > tipo "App da Web"
        Executar como: Eu     Quem pode acessar: Qualquer pessoa
   5. Copie o endereço que termina em /exec e mande para a DayIA colocar no app.
   ===================================================================== */

var LIMITE_DIA = 400;                                   // pedidos por dia (protege contra gasto alto)
// Haiku (bem barato) no dia a dia; Sonnet só no termo de acordo, roteiro, ideias de acordo e leis do caso
var MODELOS_CLAUDE = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-sonnet-5-5" };
var RESERVA_CLAUDE = "claude-haiku-5-5";
// Voz do ElevenLabs: propriedades ELEVEN_KEY (chave) e ELEVEN_VOZ (id da voz escolhida)
var ELEVEN_MODELO = "eleven_multilingual_v2";   // mesma qualidade do site do ElevenLabs (respeita pontuação e pausas)
var MODELOS_GEMINI = ["gemini-flash-lite-latest", "gemini-flash-lite-latest"];   // o "lite" responde em menos de 1 segundo; tenta 2 vezes se falhar

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || "{}");
    if (d.tipo === "lei") return json_(lei_(String(d.id || ""), String(d.url || "")));
    if (d.tipo === "voz") return json_(voz_(String(d.texto || "").slice(0, 1500)));
    var msgs = (d.mensagens || []).filter(function (m) { return m && m.content; }).slice(-20);
    if (!msgs.length) return json_({ erro: "Pergunta vazia." });
    if (!dentroDoLimite_()) return json_({ erro: "Limite do dia atingido.", codigo: "limite" });
    var p = PropertiesService.getScriptProperties();
    var texto = "", ultimo = null;
    if (p.getProperty("CLAUDE_KEY")) {
      var fila = [MODELOS_CLAUDE[d.nivel] || MODELOS_CLAUDE["default"], RESERVA_CLAUDE];
      for (var i = 0; i < fila.length && !texto; i++) {
        try { texto = claude_(msgs, fila[i]); } catch (err) { ultimo = err; }
      }
    }
    if (!texto && p.getProperty("GEMINI_KEY")) {
      for (var j = 0; j < MODELOS_GEMINI.length && !texto; j++) {
        try { texto = gemini_(msgs, MODELOS_GEMINI[j]); } catch (err) { ultimo = err; if (j < MODELOS_GEMINI.length - 1) Utilities.sleep(800); }
      }
    }
    if (!texto) return json_({ erro: ultimo ? String(ultimo.message || ultimo) : "IA sem chave configurada.", codigo: "erro" });
    return json_({ texto: texto });
  } catch (err) {
    return json_({ erro: String(err.message || err), codigo: "erro" });
  }
}

function doGet() { return json_({ ok: true, app: "Mediação Fácil" }); }

function claude_(msgs, modelo) {
  var chave = PropertiesService.getScriptProperties().getProperty("CLAUDE_KEY");
  var lista = [];
  msgs.forEach(function (m) {
    var role = m.role === "assistant" ? "assistant" : "user";
    if (lista.length && lista[lista.length - 1].role === role) lista[lista.length - 1].content += "\n\n" + m.content;
    else lista.push({ role: role, content: String(m.content) });
  });
  if (lista[0].role !== "user") lista.shift();
  var r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({ model: modelo, max_tokens: 2500, messages: lista })
  });
  var d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((d.error && d.error.message) || ("Claude " + r.getResponseCode()));
  return (d.content || []).map(function (c) { return c.text || ""; }).join("");
}

function gemini_(msgs, modelo) {
  var chave = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY");
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent";
  var contents = msgs.map(function (m) { return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }; });
  var r = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-goog-api-key": chave },
    payload: JSON.stringify({ contents: contents, generationConfig: { temperature: 0.4 } })
  });
  var d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((d.error && d.error.message) || ("Gemini " + r.getResponseCode()));
  var partes = (((d.candidates || [])[0] || {}).content || {}).parts || [];
  return partes.filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ""; }).join("");
}

function voz_(texto) {
  var p = PropertiesService.getScriptProperties();
  var chave = p.getProperty("ELEVEN_KEY"), vozId = p.getProperty("ELEVEN_VOZ");
  if (!chave || !vozId) return { erro: "Voz não configurada.", codigo: "semvoz" };
  if (!texto) return { erro: "Texto vazio." };
  if (!dentroDoLimite_()) return { erro: "Limite do dia atingido.", codigo: "limite" };
  var r = UrlFetchApp.fetch("https://api.elevenlabs.io/v1/text-to-speech/" + vozId + "?output_format=mp3_44100_64", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "xi-api-key": chave, "accept": "audio/mpeg" },
    payload: JSON.stringify({ text: texto, model_id: ELEVEN_MODELO, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.95 } })
  });
  if (r.getResponseCode() !== 200) return { erro: "ElevenLabs " + r.getResponseCode() + ": " + r.getContentText().slice(0, 200), codigo: "erro" };
  return { audio: Utilities.base64Encode(r.getBlob().getBytes()) };
}

/* Leis completas, sempre do site oficial do Planalto (texto em vigor, sem os trechos riscados) */
var LEIS = {
  med: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13140.htm",
  cpc: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
  cc: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
  cf: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  alim: "https://www.planalto.gov.br/ccivil_03/leis/l5478.htm",
  eca: "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm",
  idoso: "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741.htm",
  inq: "https://www.planalto.gov.br/ccivil_03/leis/l8245.htm",
  cdc: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
  arb: "https://www.planalto.gov.br/ccivil_03/leis/l9307.htm",
  jec: "https://www.planalto.gov.br/ccivil_03/leis/l9099.htm",
  div: "https://www.planalto.gov.br/ccivil_03/leis/l6515.htm",
  inv: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/lei/l11441.htm",
  ue: "https://www.planalto.gov.br/ccivil_03/leis/l9278.htm",
  ap: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12318.htm",
  pat: "https://www.planalto.gov.br/ccivil_03/leis/l8560.htm",
  bf: "https://www.planalto.gov.br/ccivil_03/leis/l8009.htm",
  mp: "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm",
  pcd: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm",
  reg: "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
  cond: "https://www.planalto.gov.br/ccivil_03/leis/l4591.htm",
  lindb: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm",
  lgpd: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
  clt: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm",
  cp: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
  cpp: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm",
  ctn: "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm",
  ctb: "https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm",
  cnj125: "https://atos.cnj.jus.br/atos/detalhar/156"
};
function lei_(id, urlPedida) {
  var url = LEIS[id];
  // Outras leis: só do site oficial do Planalto ou do CNJ
  if (!url && urlPedida && /^https:\/\/(www\.)?(planalto\.gov\.br|atos\.cnj\.jus\.br)\//i.test(urlPedida)) url = urlPedida;
  if (!url) return { erro: "Lei não encontrada." };
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() !== 200) return { erro: "Planalto " + r.getResponseCode(), codigo: "erro" };
  var b = r.getContent(), bruto;
  if (b[0] === -1 && b[1] === -2) bruto = r.getContentText("UTF-16LE");
  else if (b[0] === -2 && b[1] === -1) bruto = r.getContentText("UTF-16BE");
  else {
    bruto = r.getContentText("ISO-8859-1");
    var m = bruto.match(/<meta[^>]+charset=["']?([\w-]+)/i), cab = String((r.getHeaders() || {})["Content-Type"] || "");
    if ((m && /utf-?8/i.test(m[1])) || /utf-?8/i.test(cab) || /\u00c3[\u00a1-\u00bf]/.test(bruto)) bruto = r.getContentText("UTF-8");
  }
  bruto = bruto.replace(/^\uFEFF/, "");
  return { id: id, texto: htmlParaTexto_(bruto), atualizado: Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd") };
}
function htmlParaTexto_(h) {
  h = h.replace(/<head\b[\s\S]*?<\/head>/i, "");
  h = h.replace(/[\r\n]+/g, " ");   // quebras do arquivo dentro do parágrafo viram espaço
  h = h.replace(/<(script|style|strike|s|del)\b[\s\S]*?<\/\1>/gi, "");
  h = h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|h\d|li|table)>/gi, "\n");
  h = h.replace(/<[^>]+>/g, "");
  var ent = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", ordm: "º", ordf: "ª", sect: "§", deg: "°", ccedil: "ç", Ccedil: "Ç",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ", acirc: "â", ecirc: "ê", ocirc: "ô", Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô",
    agrave: "à", Agrave: "À", uuml: "ü", ndash: "–", mdash: "—", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…" };
  h = h.replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
       .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
       .replace(/&([a-z]+);/gi, function (a, n) { return ent.hasOwnProperty(n) ? ent[n] : a; });
  return h.replace(/\u00a0/g, " ").replace(/[ \t\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
}

function dentroDoLimite_() {
  var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
  var p = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var dia = p.getProperty("CONTA_DIA"), n = Number(p.getProperty("CONTA_N") || 0);
    if (dia !== hoje) { dia = hoje; n = 0; }
    if (n >= LIMITE_DIA) return false;
    p.setProperties({ CONTA_DIA: dia, CONTA_N: String(n + 1) });
    return true;
  } finally { lock.releaseLock(); }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
