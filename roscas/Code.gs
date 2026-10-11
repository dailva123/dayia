/* =====================================================================
   ROSCA FÁCIL by DayIA  ·  servidor (Google Apps Script)
   ---------------------------------------------------------------------
   Recebe a foto da peça enviada pelo app, pede para uma IA de visão
   medir a rosca (usando o cartão ou a régua da foto como referência)
   e devolve as medidas. A comparação com as tabelas BSP / NPT é feita
   no próprio app.

   A chave da IA fica guardada aqui, escondida. Ela nunca aparece no app.

   Instalação (uma vez só, uns 5 minutos):
   1. Entre em script.google.com com a conta da DayIA > Novo projeto.
   2. Apague o que estiver lá e cole este arquivo inteiro.
   3. Pegue uma chave de IA:
        Gemini (tem uso grátis): aistudio.google.com > "Get API key"
        ou Claude: console.anthropic.com > API Keys
   4. No Apps Script: engrenagem (Configurações do projeto) >
      Propriedades do script > Adicionar propriedade:
        nome  GEMINI_KEY  (ou CLAUDE_KEY)   valor  a chave copiada
   5. Implantar > Nova implantação > tipo "App da Web"
        Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
   6. Copie o endereço que termina em /exec e mande para colocar no app.
   ===================================================================== */

var VERSAO = "1.0";

// Modelos usados (pode trocar aqui se o fornecedor lançar um mais novo)
var MODELO_GEMINI = "gemini-flash-latest";
var MODELO_CLAUDE = "claude-sonnet-5-5";

// Limite de análises por dia, para ninguém gastar sua cota à toa
var LIMITE_DIA = 300;

var PROMPT = [
  "Você é um metrologista especialista em roscas de tubo de conexões hidráulicas e pneumáticas.",
  "A foto mostra uma peça com rosca e um objeto de referência ao lado: normalmente um cartão de banco",
  "(tamanho padrão 85,60 mm x 53,98 mm), ou então uma régua ou um paquímetro (use as marcações deles).",
  "",
  "Tarefa: MEDIR a rosca. Não tente adivinhar a norma, só meça.",
  "Passos:",
  "1. Ache a referência e calcule quantos pixels equivalem a 1 mm. Para o cartão, use o lado que estiver",
  "   mais nítido e reto (o lado maior mede 85,60 mm e o menor 53,98 mm).",
  "2. Rosca macho (filetes por fora): meça o diâmetro externo, de pico a pico dos filetes, perpendicular ao eixo.",
  "   Rosca fêmea (filetes por dentro): meça o diâmetro do furo, nos picos internos dos filetes.",
  "3. Conte quantos filetes (picos) aparecem num trecho de comprimento conhecido e calcule os fios por polegada",
  "   (25,4 mm) e o passo em mm. Se não der para contar com segurança, deixe null.",
  "4. Veja se a rosca é reta (diâmetro igual em todo o comprimento) ou cônica (afunila na ponta).",
  "   Se não der para ter certeza, use \"indefinida\".",
  "5. Considere a perspectiva: se a peça estiver mais alta ou mais perto da câmera que o cartão, ela parece maior.",
  "",
  "O cliente informou que a rosca é: {TIPO}.",
  "",
  "Responda SOMENTE com um JSON neste formato, sem texto fora dele:",
  "{\"referencia\":\"cartao|regua|paquimetro|nenhuma\",",
  " \"rosca_visivel\":true,",
  " \"tipo\":\"macho|femea|indefinido\",",
  " \"diametro_mm\":0.0,",
  " \"fios_por_polegada\":0.0,",
  " \"passo_mm\":0.0,",
  " \"forma\":\"reta|conica|indefinida\",",
  " \"certeza\":0,",
  " \"problemas\":\"\"}",
  "Use null quando não souber um número. \"certeza\" vai de 0 a 100 e diz o quanto você confia no diâmetro.",
  "Em \"problemas\", escreva em português simples, para um leigo, o que atrapalhou a medida",
  "(ex.: cartão cortado, foto tremida, peça longe do cartão). Deixe vazio se a foto estiver boa."
].join("\n");

/* ---------------- entrada ---------------- */
function doGet() {
  return json_({ ok: true, app: "Rosca Fácil by DayIA", versao: VERSAO, ia: provedor_() || "não configurada" });
}

function doPost(e) {
  try {
    var corpo = JSON.parse(e.postData.contents || "{}");
    if (corpo.acao !== "analisar") return json_({ ok: false, erro: "Ação desconhecida." });
    if (!corpo.imagem) return json_({ ok: false, erro: "Nenhuma foto recebida." });
    if (!provedor_()) return json_({ ok: false, erro: "A IA ainda não foi configurada." });
    if (!dentroDoLimite_()) return json_({ ok: false, erro: "O limite de análises de hoje acabou. Tente amanhã ou use a medida manual." });

    var tipo = corpo.tipo === "femea" ? "fêmea (filetes por dentro)" : "macho (filetes por fora)";
    var texto = PROMPT.replace("{TIPO}", tipo);
    var mime = corpo.mime || "image/jpeg";

    var bruto = provedor_() === "gemini"
      ? gemini_(texto, corpo.imagem, mime)
      : claude_(texto, corpo.imagem, mime);

    var medida = extrairJson_(bruto);
    if (!medida) return json_({ ok: false, erro: "A IA não conseguiu ler a foto. Tente outra foto." });
    return json_({ ok: true, medida: medida });
  } catch (err) {
    return json_({ ok: false, erro: "Erro no servidor: " + err.message });
  }
}

/* ---------------- IAs ---------------- */
function provedor_() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty("GEMINI_KEY")) return "gemini";
  if (p.getProperty("CLAUDE_KEY")) return "claude";
  return "";
}

function gemini_(texto, b64, mime) {
  var chave = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY");
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO_GEMINI + ":generateContent";
  var r = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": chave },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: texto }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" }
    })
  });
  var d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((d.error && d.error.message) || ("Gemini " + r.getResponseCode()));
  var partes = (((d.candidates || [])[0] || {}).content || {}).parts || [];
  return partes.map(function (p) { return p.text || ""; }).join("");
}

function claude_(texto, b64, mime) {
  var chave = PropertiesService.getScriptProperties().getProperty("CLAUDE_KEY");
  var r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01" },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: MODELO_CLAUDE,
      max_tokens: 1024,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
        { type: "text", text: texto }
      ] }]
    })
  });
  var d = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error((d.error && d.error.message) || ("Claude " + r.getResponseCode()));
  return (d.content || []).map(function (c) { return c.text || ""; }).join("");
}

/* ---------------- utilidades ---------------- */
function extrairJson_(t) {
  if (!t) return null;
  var i = t.indexOf("{"), f = t.lastIndexOf("}");
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(t.slice(i, f + 1)); } catch (e) { return null; }
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
