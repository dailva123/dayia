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
