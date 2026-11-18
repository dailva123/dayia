/* ================= Aprova Fácil · Treinos, Duelo das gêmeas, Troféus e Loja ================= */

/* ---------- conversa com o cofre ---------- */
async function cofre(dados){
  if(!navigator.onLine)throw new Error("Sem internet agora");
  const r=await fetch(COFRE,{method:"POST",body:JSON.stringify(Object.assign({objetivo:OBJETIVOS[D.objetivo].nome,id:D.id},dados))}).then(x=>x.json());
  if(!r.ok)throw new Error(r.mensagem||"Não deu certo agora");
  return r.resultado;
}
const pensando=(t="💭 A professora IA está pensando…")=>`<div class="card centro"><div class="giro">✨</div><p class="sub">${t}</p></div>`;
function voltarTreinos(){return `<button class="fechar" onclick="ir('treinos')" aria-label="Voltar">←</button>`}
function stat(k,n=1){D.stats[k]=(D.stats[k]||0)+n;salvar()}

/* =================== TROFÉUS =================== */
const TROFEUS=[
  {id:"m10",i:"🥉",n:"10 missões",d:"Fez 10 missões do dia",ok:()=>D.dias.length>=10},
  {id:"m30",i:"🥈",n:"30 missões",d:"Fez 30 missões do dia",ok:()=>D.dias.length>=30},
  {id:"m100",i:"🥇",n:"100 missões",d:"Fez 100 missões do dia",ok:()=>D.dias.length>=100},
  {id:"s14",i:"🔥",n:"Duas semanas em chamas",d:"14 dias seguidos",ok:()=>sequencia()>=14},
  {id:"s30",i:"🌋",n:"Mês de fogo",d:"30 dias seguidos",ok:()=>sequencia()>=30},
  {id:"a100",i:"🎯",n:"100 acertos",d:"Acertou 100 questões",ok:()=>totalAcertos()>=100},
  {id:"a500",i:"🏹",n:"500 acertos",d:"Acertou 500 questões",ok:()=>totalAcertos()>=500},
  {id:"r1",i:"✍️",n:"Primeira redação",d:"Mandou a 1ª redação para correção",ok:()=>D.stats.redacoes>=1},
  {id:"r8",i:"📜",n:"Redação nota 8",d:"Tirou 8 ou mais numa redação",ok:()=>D.stats.melhorRedacao>=8},
  {id:"r10",i:"👑",n:"Redação 10 redações",d:"Escreveu 10 redações",ok:()=>D.stats.redacoes>=10},
  {id:"o1",i:"🎤",n:"Primeira banca",d:"Fez o 1º treino de oral",ok:()=>D.stats.orais>=1},
  {id:"d1",i:"🧪",n:"Discursiva na veia",d:"Fez 5 discursivas",ok:()=>D.stats.discursivas>=5},
  {id:"sim1",i:"⏱️",n:"Primeiro simulado",d:"Terminou um simulado",ok:()=>D.stats.simulados>=1},
  {id:"sim70",i:"🚀",n:"Simulado 70%",d:"Acertou 70% num simulado de 20 ou mais",ok:()=>D.stats.melhorSimulado>=70},
  {id:"chef",i:"🐉",n:"Derrotou um chefão",d:"Venceu o chefão de uma região do mapa",ok:()=>D.regiao>=1},
  {id:"chef4",i:"🏰",n:"Metade do caminho",d:"Chegou na região 4 do mapa",ok:()=>D.regiao>=4},
  {id:"rel10",i:"⚡",n:"Raio veloz",d:"Acertou 10 questões relâmpago",ok:()=>D.stats.relampagos>=10},
  {id:"foto1",i:"📸",n:"Detetive de provas",d:"Pediu ajuda numa prova antiga",ok:()=>D.stats.fotos>=1},
  {id:"duelo",i:"⚔️",n:"Vencedora da semana",d:"Fez mais pontos que a irmã numa semana",ok:()=>!!D.stats.venceuSemana},
  {id:"recado",i:"💌",n:"Irmã parceira",d:"Mandou 5 recados para a irmã",ok:()=>D.stats.recados>=5},
  {id:"loja",i:"🛍️",n:"Estilosa",d:"Comprou algo na loja",ok:()=>D.compras.length>2},
  {id:"secreto1",i:"🌙",n:"Coruja estudiosa",d:"Estudou depois das 22h",secreto:true,ok:()=>!!D.stats.coruja},
  {id:"secreto2",i:"🌅",n:"Madrugadora",d:"Estudou antes das 7h",secreto:true,ok:()=>!!D.stats.madrugadora},
  {id:"secreto3",i:"💎",n:"Perfeição",d:"Fez 3 missões perfeitas",secreto:true,ok:()=>D.stats.perfeitas>=3}
];
function conferirTrofeus(){
  const novos=TROFEUS.filter(t=>!D.trofeus.includes(t.id)&&t.ok());
  if(!novos.length)return;
  novos.forEach(t=>D.trofeus.push(t.id));D.moedas+=novos.length*20;salvar();
  setTimeout(()=>mostrarTrofeu(novos[0],novos.length-1),700);
}
function mostrarTrofeu(t,mais){
  palmas();festa(40,["🏆","✨","⭐","🎉","💛"]);
  abrirModal(`<div class="centro trofeu-novo"><div class="trofeu-brilho">${t.i}</div><h2>Troféu conquistado!</h2><h3>${esc(t.n)}</h3><p class="sub">${esc(t.d)}</p>
  <p><span class="mais">+20 🪙</span></p>${mais?`<p class="sub">E mais ${mais} ${mais>1?"troféus":"troféu"} na sua estante! 👀</p>`:""}
  <button class="btn btn-pri btn-bloco" onclick="fecharModal()">Uhuul! 🎉</button></div>`);
}

/* =================== LOJA =================== */
const TEMAS={
  azul:{n:"Azul DayIA",preco:0,topo:"#0E2238",ac:"#F2B705"},
  rosa:{n:"Rosa chiclete",preco:60,topo:"#8E2C63",ac:"#FFB3D9"},
  roxo:{n:"Roxo galáxia",preco:80,topo:"#2D1B69",ac:"#B79CFF"},
  verde:{n:"Verde menta",preco:80,topo:"#0F4C3A",ac:"#7BE0B5"},
  coral:{n:"Pôr do sol",preco:100,topo:"#7A2E1F",ac:"#FFB27A"},
  noite:{n:"Noite estrelada",preco:150,topo:"#000814",ac:"#FFD60A"}
};
const AVATARES=[["🎓",0],["🦋",30],["🌸",30],["🐱",30],["🦊",40],["⚖️",50],["🧠",50],["🔥",80],["🦄",100],["👑",150],["🐉",200],["💎",250]];
function aplicarTema(){const t=TEMAS[D.tema]||TEMAS.azul;const r=document.documentElement.style;r.setProperty("--azul",t.topo);r.setProperty("--amarelo",t.ac);document.querySelector('meta[name="theme-color"]').content=t.topo}
function telaLoja(){
  abrirModal(`<h3>🛍️ Loja</h3><p class="sub">Você tem <b>🪙 ${D.moedas} moedas</b>. Ganhe moedas acertando questões, fazendo missões e conquistando troféus.</p>
  <h3 style="margin-top:14px">🎨 Cores do app</h3><div class="loja">${Object.entries(TEMAS).map(([k,t])=>{const tem=D.compras.includes("tema-"+k);return `<button class="item-loja ${D.tema===k?"sel":""}" data-tema="${k}"><span class="amostra" style="background:${t.topo}"><i style="background:${t.ac}"></i></span><b>${t.n}</b><small>${tem?(D.tema===k?"Usando ✅":"Usar"):"🪙 "+t.preco}</small></button>`}).join("")}</div>
  <h3 style="margin-top:14px">😎 Seu avatar</h3><div class="loja">${AVATARES.map(([a,p])=>{const tem=D.compras.includes("av-"+a);return `<button class="item-loja ${D.avatar===a?"sel":""}" data-av="${a}"><span style="font-size:34px">${a}</span><small>${tem?(D.avatar===a?"Usando ✅":"Usar"):"🪙 "+p}</small></button>`}).join("")}</div>
  <button class="btn btn-sec btn-bloco" onclick="fecharModal()" style="margin-top:14px">Fechar</button>`);
  document.querySelectorAll("[data-tema]").forEach(b=>b.onclick=()=>comprar("tema-"+b.dataset.tema,TEMAS[b.dataset.tema].preco,()=>{D.tema=b.dataset.tema;aplicarTema()}));
  document.querySelectorAll("[data-av]").forEach(b=>b.onclick=()=>comprar("av-"+b.dataset.av,AVATARES.find(x=>x[0]===b.dataset.av)[1],()=>{D.avatar=b.dataset.av}));
}
function comprar(item,preco,usar){
  if(!D.compras.includes(item)){
    if(D.moedas<preco)return toast(`Faltam ${preco-D.moedas} moedas 🪙 Bora treinar!`);
    D.moedas-=preco;D.compras.push(item);palmas();toast("Comprado! 🛍️");
  }
  usar();salvar();conferirTrofeus();render();telaLoja();
}

/* =================== MAPA COM CHEFÕES =================== */
const REGIOES={
  gv:["Largada","Vila da Leitura","Vale da Argumentação","Cidade dos Números","Floresta da História","Torre da Atualidade","Ponte da Redação","Portão da GV ⚖️"],
  fuvest:["Largada","Vila da Leitura","Rio da Biologia","Cidade dos Números","Floresta da História","Laboratório","Ponte da Redação","Portão da USP 🧠"]
};
const ACERTOS_POR_REGIAO=25;
function htmlMapa(){
  const regs=REGIOES[D.objetivo],ac=totalAcertos(),r=D.regiao;
  const precisa=(r+1)*ACERTOS_POR_REGIAO,falta=Math.max(0,precisa-ac),liberado=falta===0&&r<regs.length-1;
  return `<div class="card mapa"><h3>🗺️ Caminho até ${D.objetivo==="gv"?"a GV":"a USP"}</h3>
  ${regs.map((n,i)=>`<div class="no ${i<r?"feito":i===r?"atual":"trancado"}"><span class="bolinha">${i<r?"✅":i===r?D.avatar:"🔒"}</span><span>${n}${i===r+1&&r<regs.length-1?` <small class="sub">· chefão 🐉</small>`:""}</span></div>`).join("")}
  ${r>=regs.length-1?`<p class="centro"><b>🎉 Você chegou ao portão! Agora é manter o ritmo até a prova.</b></p>`
   :liberado?`<button class="btn btn-pri btn-bloco" id="btnChefao">🐉 Enfrentar o chefão de "${regs[r+1]}"</button><p class="sub centro">10 questões · acerte 6 para passar</p>`
   :`<p class="sub centro">Faltam <b>${falta} acertos</b> para enfrentar o chefão de "${regs[r+1]}" 🐉</p><div class="barra"><i style="width:${Math.min(100,(ac-r*ACERTOS_POR_REGIAO)/ACERTOS_POR_REGIAO*100)}%"></i></div>`}
  </div>`;
}
function ligarMapa(){const b=$("#btnChefao");if(b)b.onclick=()=>comecarSimulado(10,"chefao")}

/* =================== TELA DE TREINOS =================== */
function telaTreinos(){
  const gv=D.objetivo==="gv";
  const itens=[
    ["⚡","Questão relâmpago","1 questão, 60 segundos. Valendo pontos em dobro!","relampago"],
    ["⏱️","Simulado","Prova com cronômetro, como no dia","simulado"],
    ["✍️","Redação com IA",`Tema no estilo ${gv?"da GV":"da Fuvest"}, nota e dicas`,"redacao"],
    gv?["🎤","Treino de oral","A IA faz o papel da banca da GV. Responda falando!","oral"]:null,
    ["🧪","Discursivas",`Questões da 2ª fase ${gv?"":"da Fuvest "}com correção`,"discursiva"],
    ["📄","Provas antigas com IA",`Leia as provas ${gv?"da GV":"da Fuvest"} aqui dentro e peça ajuda`,"provas"],
    ["📸","Foto de questão","Tire foto de qualquer questão e a IA explica","foto"],
    ["👯","Desafio com código","Mesmas 5 questões para quem tiver o código","desafio"],
    ["🔁",`Revisar erros (${D.erros.length})`,"As questões que você errou voltam aqui","erros"]
  ].filter(Boolean);
  $("#tela").innerHTML=`<h2>🧠 Treinos</h2><p class="sub">Escolha o seu treino de hoje. Tudo vale pontos e moedas 🪙</p>
  <div class="grade-treinos">${itens.map(([i,n,d,k])=>`<button class="treino" data-t="${k}"><span class="ic">${i}</span><b>${n}</b><small>${d}</small></button>`).join("")}</div>`;
  document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>({relampago:relampago,simulado:escolherSimulado,redacao:telaRedacao,oral:telaOral,discursiva:telaDiscursiva,provas:telaProvasIA,foto:telaFoto,desafio:telaDesafio,erros:()=>ir("erros")}[b.dataset.t])());
}

/* =================== QUESTÃO RELÂMPAGO =================== */
let tempoRel=null;
async function relampago(){
  if(!carregado){toast("Carregando as questões…");await carregando}
  const areas=Object.keys(AREAS),id=sortearDa(areas[Math.floor(Math.random()*areas.length)],[]),q=BANCO[id];
  aba="quiz";$("#menu").classList.add("oculto");
  let s=60;clearInterval(tempoRel);
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<div class="relogio" id="rel">⚡ 60s</div></div>
  <span class="tagm">${q.tag}</span> <span class="fonte">${esc(q.fonte)}</span>
  ${q.t?`<div class="texto-base">${texto(q.t)}</div>`:""}<div class="enun">${texto(q.p)}</div>
  <div id="alts">${q.a.map((t,i)=>`<button class="alt" data-i="${i}"><span class="l">${LETRAS[i]}</span><span>${texto(t)}</span></button>`).join("")}</div><div id="volta"></div>`;
  window.scrollTo(0,0);
  tempoRel=setInterval(()=>{s--;const r=$("#rel");if(!r)return clearInterval(tempoRel);r.textContent="⚡ "+s+"s";r.classList.toggle("pouco",s<=10);if(s<=0){clearInterval(tempoRel);fimRel(id,-1)}},1000);
  document.querySelectorAll(".alt").forEach(b=>b.onclick=()=>{clearInterval(tempoRel);fimRel(id,+b.dataset.i)});
}
function fimRel(id,i){
  const q=BANCO[id],certo=i===q.c;
  document.querySelectorAll(".alt").forEach(b=>{b.disabled=true;const k=+b.dataset.i;if(k===q.c)b.classList.add("certa");else if(k===i)b.classList.add("errada")});
  const r=D.resp[id]||{a:0,e:0};if(certo){r.a++;stat("relampagos")}else{r.e++;if(!D.erros.includes(id))D.erros.push(id)}D.resp[id]=r;
  contarQuestao(certo);const pts=certo?20:i<0?0:2;if(pts)ganhar(pts);if(certo)palmas();
  $("#volta").innerHTML=`<div class="explica ${certo?"ok":"nao"}"><h3>${certo?"Rápida e certeira! ⚡👏":i<0?"O tempo acabou! ⏰":"Quase! 💡"} ${pts?`<span class="mais">+${pts}</span>`:""}</h3>
  ${certo?"":`<p class="sub">A certa é a <b>${LETRAS[q.c]}</b>.</p>`}${q.x?texto(q.x):`<div id="expIA"><button class="btn btn-sec btn-bloco" id="btnIA">💡 Entender com a professora IA</button></div>`}
  <button class="btn btn-pri btn-bloco" id="outraRel" style="margin-top:12px">Mais uma ⚡</button><button class="btn btn-sec btn-bloco" onclick="ir('treinos')" style="margin-top:8px">Voltar aos treinos</button></div>`;
  const bia=$("#btnIA");if(bia)bia.onclick=()=>explicarIA(id,i<0?q.c:i);
  $("#outraRel").onclick=relampago;conferirMedalhas();conferirTrofeus();enviarProgresso("Questão relâmpago",certo?1:0,1);
  $("#volta").scrollIntoView({behavior:"smooth",block:"nearest"});
}

/* =================== SIMULADO =================== */
let SIM=null,tempoSim=null;
function escolherSimulado(){
  abrirModal(`<h3>⏱️ Simulado</h3><p class="sub">Igual ao dia da prova: você só vê as respostas no final. Dá para pausar saindo e voltando.</p>
  <button class="btn btn-sec btn-bloco" data-n="10" style="margin:6px 0">🌱 Rapidinho · 10 questões · 25 min</button>
  <button class="btn btn-sec btn-bloco" data-n="20" style="margin:6px 0">📘 Médio · 20 questões · 50 min</button>
  <button class="btn btn-pri btn-bloco" data-n="45" style="margin:6px 0">🏁 Completo · 45 questões · 2h15</button>
  ${D.sim&&!D.sim.fim?`<button class="btn btn-sec btn-bloco" id="contSim" style="margin-top:10px">▶️ Continuar o simulado que parou</button>`:""}`);
  document.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{fecharModal();comecarSimulado(+b.dataset.n,"simulado")});
  const c=$("#contSim");if(c)c.onclick=()=>{fecharModal();SIM=D.sim;telaSimulado()};
}
async function comecarSimulado(n,modo){
  if(!carregado){toast("Carregando as questões…");await carregando}
  const ids=[],areas=OBJETIVOS[D.objetivo].missao;
  for(let k=0;k<n;k++){const id=sortearDa(areas[k%areas.length],ids);if(id)ids.push(id)}
  SIM={ids:embaralhar(ids),resp:{},idx:0,modo,fim:false,inicio:Date.now(),limite:n*150};D.sim=SIM;salvar();telaSimulado();
}
function telaSimulado(){
  aba="quiz";$("#menu").classList.add("oculto");clearInterval(tempoSim);
  const id=SIM.ids[SIM.idx],q=BANCO[id];
  $("#tela").innerHTML=`<div class="topoq"><button class="fechar" id="pausa" aria-label="Pausar">⏸</button><div class="barra"><i style="width:${SIM.idx/SIM.ids.length*100}%"></i></div><b>${SIM.idx+1}/${SIM.ids.length}</b></div>
  <div class="relogio" id="relSim"></div>
  <span class="tagm">${q.tag}</span> <span class="fonte">${esc(q.fonte)}</span>
  ${q.t?`<div class="texto-base">${texto(q.t)}</div>`:""}<div class="enun">${texto(q.p)}</div>
  <div id="alts">${q.a.map((t,i)=>`<button class="alt ${SIM.resp[id]===i?"marcada":""}" data-i="${i}"><span class="l">${LETRAS[i]}</span><span>${texto(t)}</span></button>`).join("")}</div>
  <div class="nav-sim"><button class="btn btn-sec" id="ant" ${SIM.idx?"":"disabled"}>← Anterior</button><button class="btn btn-pri" id="prx">${SIM.idx+1<SIM.ids.length?"Próxima →":"Entregar 🏁"}</button></div>`;
  window.scrollTo(0,0);
  const tick=()=>{const rest=SIM.limite-Math.floor((Date.now()-SIM.inicio)/1000),el=$("#relSim");if(!el)return clearInterval(tempoSim);
    if(rest<=0){clearInterval(tempoSim);toast("⏰ O tempo acabou!");return fimSimulado()}
    el.textContent=`⏱️ ${Math.floor(rest/3600)?Math.floor(rest/3600)+"h ":""}${String(Math.floor(rest%3600/60)).padStart(2,"0")}min ${String(rest%60).padStart(2,"0")}s`;el.classList.toggle("pouco",rest<300)};
  tick();tempoSim=setInterval(tick,1000);
  document.querySelectorAll(".alt").forEach(b=>b.onclick=()=>{SIM.resp[id]=+b.dataset.i;D.sim=SIM;salvar();document.querySelectorAll(".alt").forEach(x=>x.classList.toggle("marcada",x===b))});
  $("#ant").onclick=()=>{SIM.idx--;telaSimulado()};
  $("#prx").onclick=()=>{if(SIM.idx+1<SIM.ids.length){SIM.idx++;D.sim=SIM;salvar();telaSimulado()}else{const vaz=SIM.ids.filter(x=>SIM.resp[x]===undefined).length;if(vaz&&!confirm(`Faltam ${vaz} questões sem resposta. Entregar assim mesmo?`))return;fimSimulado()}};
  $("#pausa").onclick=()=>{clearInterval(tempoSim);D.sim=SIM;salvar();toast("Simulado pausado. Continue em Treinos ⏸");ir("treinos")};
}
function fimSimulado(){
  clearInterval(tempoSim);SIM.fim=true;D.sim=null;
  let a=0;const porArea={};
  SIM.ids.forEach(id=>{const q=BANCO[id],m=SIM.resp[id],certo=m===q.c;const r=D.resp[id]||{a:0,e:0};if(certo){a++;r.a++;D.erros=D.erros.filter(x=>x!==id)}else{r.e++;if(!D.erros.includes(id))D.erros.push(id)}D.resp[id]=r;contarQuestao(certo);
    porArea[q.area]=porArea[q.area]||{a:0,n:0};porArea[q.area].n++;if(certo)porArea[q.area].a++});
  const n=SIM.ids.length,pct=Math.round(a/n*100),chefao=SIM.modo==="chefao",venceu=chefao&&a>=6;
  if(chefao&&venceu)D.regiao++;
  if(!chefao){stat("simulados");if(n>=20)D.stats.melhorSimulado=Math.max(D.stats.melhorSimulado||0,pct)}
  ganhar(a*5+(venceu?50:0));salvar();
  enviarProgresso(chefao?`Chefão do mapa (${venceu?"venceu":"tentou"})`:`Simulado de ${n} questões`,a,n);
  $("#tela").innerHTML=`<div class="card centro"><div class="grande">${chefao?(venceu?"🐉⚔️":"🛡️"):pct>=70?"🏆":pct>=50?"🎉":"🌱"}</div>
  <h2>${a} de ${n} certas (${pct}%)</h2>
  <p>${chefao?(venceu?`Você derrotou o chefão e chegou em <b>${REGIOES[D.objetivo][D.regiao]}</b>! 🎉`:"O chefão resistiu desta vez. Treine mais um pouco e volte para a revanche! 💪"):pct>=70?"Desempenho de aprovada! 🚀":pct>=50?"Muito bom! Está no caminho certo 💛":"Simulado é para aprender. Veja onde errou e bora! 💪"}</p>
  ${Object.entries(porArea).map(([k,v])=>`<div class="linhamat"><span class="nome">${AREAS[k].i} ${AREAS[k].n}</span><div class="barra"><i style="width:${v.a/v.n*100}%"></i></div><small>${v.a}/${v.n}</small></div>`).join("")}
  <button class="btn btn-pri btn-bloco" id="verSim" style="margin-top:12px">Ver as respostas 👀</button>
  <button class="btn btn-sec btn-bloco" onclick="ir('inicio')" style="margin-top:8px">Voltar ao início</button></div>`;
  if(pct>=60||venceu)palmas();festa(pct>=60?40:15);
  const sim=SIM;$("#verSim").onclick=()=>revisarSimulado(sim);
  conferirMedalhas();conferirTrofeus();
}
function revisarSimulado(sim){
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">Respostas do simulado</h2></div>`+sim.ids.map((id,k)=>{const q=BANCO[id],m=sim.resp[id];return `<button class="materia" data-rv="${id}" data-m="${m===undefined?-1:m}"><span class="ic">${m===q.c?"✅":"❌"}</span><span class="info"><b>Questão ${k+1} · ${AREAS[q.area].n}</b><span class="sub">Você: ${m===undefined?"em branco":LETRAS[m]} · Certa: ${LETRAS[q.c]}</span></span><span>▶️</span></button>`}).join("");
  document.querySelectorAll("[data-rv]").forEach(b=>b.onclick=()=>treinar([b.dataset.rv],"revisao"));
}

/* =================== REDAÇÃO =================== */
function telaRedacao(){
  aba="redacao";render0();
  const R=D.redacaoAtual;
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">✍️ Redação</h2></div>
  ${R?`<div class="card"><span class="tagm">Tema</span><h3>${esc(R.titulo)}</h3>${(R.coletanea||[]).map((t,i)=>`<div class="texto-base"><b>Texto ${i+1}</b><br>${texto(t)}</div>`).join("")}<p><b>Proposta:</b> ${texto(R.instrucao)}</p></div>
   <div class="card"><textarea id="redTxt" rows="16" placeholder="Escreva aqui a sua redação. Dica: dê um título, faça introdução, 2 parágrafos de argumentos e conclusão.">${esc(R.texto||"")}</textarea>
   <p class="sub" id="redConta"></p><button class="btn btn-pri btn-bloco" id="redEnviar">Corrigir minha redação ✨</button>
   <button class="btn btn-sec btn-bloco" id="redNovo" style="margin-top:8px">Trocar de tema</button></div><div id="redRes"></div>`
  :`<div class="card centro"><div class="grande">✍️</div><p>A professora IA cria um tema inédito no estilo ${D.objetivo==="gv"?"da GV":"da Fuvest"}, com textos de apoio. Você escreve e recebe nota, comentários e um exemplo de como melhorar.</p>
   <button class="btn btn-pri btn-bloco" id="redNovo">Quero um tema 🎲</button></div>`}
  ${D.redacoes.length?`<h3 style="margin-top:18px">📚 Minhas redações</h3><div class="lupa"><input id="bRed" placeholder="Procurar redação" autocomplete="off"></div><div id="lRed"></div>`:""}`;
  $("#redNovo").onclick=async()=>{if(R&&R.texto&&!confirm("Trocar de tema? O texto que você escreveu será apagado."))return;$("#tela").innerHTML=pensando("✍️ Criando um tema bem caprichado…");
    try{const t=await cofre({tipo:"redacao_tema",evitar:D.redacoes.map(r=>r.titulo).slice(-8).join("; ")});D.redacaoAtual=Object.assign(t,{texto:""});salvar()}catch(e){toast(e.message)}telaRedacao()};
  if(R){const ta=$("#redTxt"),conta=()=>{const t=ta.value.trim(),p=t?t.split(/\s+/).length:0;$("#redConta").textContent=`${p} palavras · mais ou menos ${Math.max(0,Math.round(t.length/75))} linhas de caderno (o ideal é de 25 a 30)`;R.texto=ta.value;salvar()};ta.oninput=conta;conta();
    $("#redEnviar").onclick=async()=>{if(ta.value.trim().split(/\s+/).length<80)return toast("Escreva um pouco mais antes de corrigir (pelo menos 80 palavras) ✍️");
      $("#redRes").innerHTML=pensando("📝 A professora IA está corrigindo com carinho…");$("#redRes").scrollIntoView({behavior:"smooth"});
      try{const c=await cofre({tipo:"redacao_corrigir",tema:R.titulo,instrucao:R.instrucao,texto:ta.value});mostrarCorrecao(c,R)}catch(e){$("#redRes").innerHTML=`<p class="sub">${esc(e.message)}. Tente de novo.</p>`}}}
  const lr=$("#lRed");if(lr){const des=()=>{const t=$("#bRed").value.toLowerCase();lr.innerHTML=D.redacoes.slice().reverse().filter(r=>r.titulo.toLowerCase().includes(t)).map(r=>`<div class="materia"><span class="ic">${r.nota>=8?"🌟":"📝"}</span><span class="info"><b>${esc(r.titulo)}</b><span class="sub">${new Date(r.data).toLocaleDateString("pt-BR")} · nota ${r.nota}</span></span></div>`).join("")||`<p class="sub">Nada encontrado.</p>`};$("#bRed").oninput=des;des()}
}
function mostrarCorrecao(c,R){
  const nota=Math.max(0,Math.min(10,+c.nota||0));
  stat("redacoes");D.stats.melhorRedacao=Math.max(D.stats.melhorRedacao||0,nota);
  D.redacoes.push({data:Date.now(),titulo:R.titulo,nota});D.redacaoAtual=null;salvar();
  ganhar(30+Math.round(nota*3));if(nota>=7)palmas();festa(nota>=8?40:15);
  enviarProgresso(`Redação: ${R.titulo.slice(0,60)} (nota ${nota})`,Math.round(nota),10);
  $("#redRes").innerHTML=`<div class="card"><div class="centro"><div class="nota-grande">${nota.toFixed(1).replace(".",",")}</div><p class="sub">nota da sua redação</p><p>💛 ${esc(c.elogio||"")}</p></div>
  ${(c.criterios||[]).map(k=>`<div class="linhamat"><span class="nome">${esc(k.nome)}</span><div class="barra"><i style="width:${(+k.nota||0)*10}%"></i></div><small>${k.nota}</small></div><p class="sub" style="margin:0 0 10px">${esc(k.comentario||"")}</p>`).join("")}
  <h3>🚀 Para a próxima</h3><ul>${(c.melhorar||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
  ${c.exemplo&&c.exemplo.original?`<h3>✏️ Antes e depois</h3><div class="texto-base"><b>Você escreveu:</b><br><i>${esc(c.exemplo.original)}</i></div><div class="texto-base"><b>Que tal assim:</b><br>${esc(c.exemplo.melhorado)}</div>`:""}
  <button class="btn btn-pri btn-bloco" onclick="telaRedacao()">Escrever outra ✍️</button></div>`;
  conferirTrofeus();
}

/* =================== ORAL (GV) =================== */
let ORAL=null;
function melhorVoz(){const vs=speechSynthesis.getVoices().filter(x=>/^pt[-_]BR/i.test(x.lang));if(!vs.length)return null;
  const nota=v=>{const n=v.name;let p=0;if(/natural|neural|online/i.test(n))p+=50;if(/premium|enhanced|aprimorad|melhorad/i.test(n))p+=40;if(/google/i.test(n))p+=30;if(/francisca|thalita|luciana|fernanda|vit[oó]ria|camila|maria/i.test(n))p+=15;if(/espeak|compact/i.test(n))p-=60;if(!v.localService)p+=5;return p};
  return vs.sort((a,b)=>nota(b)-nota(a))[0]}
function falar(t){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="pt-BR";u.rate=0.95;u.pitch=1.05;const v=melhorVoz();if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices()}catch(e){}
async function telaOral(){
  aba="oral";render0();
  if(!ORAL)ORAL={n:0,historico:[],notas:[]};
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">🎤 Treino de oral</h2></div>`+pensando("🎤 A banca está preparando a pergunta…");
  try{
    const p=await cofre({tipo:"oral_pergunta",historico:ORAL.historico.length?ORAL.historico.join(" | "):"nenhuma ainda. É a primeira pergunta: cumprimente a candidata e pergunte por que ela escolheu Direito."});
    ORAL.atual=p;mostrarPerguntaOral();
  }catch(e){$("#tela").innerHTML+=`<p class="sub">${esc(e.message)}</p>`}
}
let reconhece=null;
function mostrarPerguntaOral(){
  const p=ORAL.atual,temMic=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">🎤 Banca · pergunta ${ORAL.n+1} de 3</h2></div>
  <div class="card banca"><div class="grande">👩‍⚖️</div><p class="enun">${esc(p.pergunta)}</p><button class="btn btn-sec" id="ouvir">🔊 Ouvir de novo</button><p class="sub">💡 ${esc(p.dica||"")}</p></div>
  <div class="card"><textarea id="oralTxt" rows="6" placeholder="${temMic?"Toque no microfone e responda falando, como na banca. Se preferir, escreva aqui.":"Escreva aqui a sua resposta."}"></textarea>
  ${temMic?`<button class="btn btn-sec btn-bloco" id="mic">🎙️ Responder falando</button>`:""}
  <button class="btn btn-pri btn-bloco" id="oralEnviar" style="margin-top:8px">Enviar para a banca</button></div><div id="oralRes"></div>`;
  falar(p.pergunta);$("#ouvir").onclick=()=>falar(p.pergunta);
  const m=$("#mic");if(m)m.onclick=()=>{
    if(reconhece){reconhece.stop();return}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;reconhece=new SR();reconhece.lang="pt-BR";reconhece.continuous=true;reconhece.interimResults=true;
    const base=$("#oralTxt").value;reconhece.onresult=e=>{let t="";for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;$("#oralTxt").value=(base?base+" ":"")+t};
    reconhece.onend=()=>{reconhece=null;m.textContent="🎙️ Responder falando";m.classList.remove("gravando")};
    try{reconhece.start();m.textContent="⏹️ Parar de gravar";m.classList.add("gravando")}catch(e){toast("Não consegui usar o microfone")}};
  $("#oralEnviar").onclick=async()=>{if(reconhece)reconhece.stop();const r=$("#oralTxt").value.trim();if(r.split(/\s+/).length<8)return toast("Responda um pouquinho mais 🙂");
    $("#oralRes").innerHTML=pensando("👩‍⚖️ A banca está avaliando…");
    try{const a=await cofre({tipo:"oral_avaliar",pergunta:p.pergunta,resposta:r});ORAL.n++;ORAL.historico.push(p.pergunta);ORAL.notas.push(+a.nota||0);
      const nota=+a.nota||0;ganhar(15+Math.round(nota*2));if(nota>=7)palmas();
      $("#oralRes").innerHTML=`<div class="card"><div class="centro"><div class="nota-grande">${nota}</div></div><p>💛 ${esc(a.elogio||"")}</p><h3>🚀 Para melhorar</h3><ul>${(a.melhorar||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h3>🌟 Exemplo de resposta</h3><div class="texto-base">${esc(a.resposta_modelo||"")}</div>
      ${ORAL.n<3?`<button class="btn btn-pri btn-bloco" id="oralProx">Próxima pergunta 🎤</button>`:`<p class="centro"><b>Treino completo! Média ${(ORAL.notas.reduce((s,x)=>s+x,0)/ORAL.notas.length).toFixed(1).replace(".",",")} 🎉</b></p><button class="btn btn-pri btn-bloco" id="oralFim">Concluir</button>`}</div>`;
      const px=$("#oralProx");if(px)px.onclick=telaOral;
      const fm=$("#oralFim");if(fm)fm.onclick=()=>{stat("orais");enviarProgresso("Treino de oral (3 perguntas)",Math.round(ORAL.notas.reduce((s,x)=>s+x,0)/3),10);ORAL=null;palmas();conferirTrofeus();ir("treinos")};
    }catch(e){$("#oralRes").innerHTML=`<p class="sub">${esc(e.message)}</p>`}};
}

/* =================== DISCURSIVAS =================== */
function telaDiscursiva(){
  aba="disc";render0();
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">🧪 Discursivas</h2></div><p class="sub">Escolha a área. A IA cria uma questão no estilo da 2ª fase e corrige a sua resposta.</p>
  ${Object.entries(AREAS).map(([k,a])=>`<button class="materia" data-ar="${k}"><span class="ic">${a.i}</span><span class="info"><b>${a.n}</b><span class="sub">${a.sub}</span></span><span>▶️</span></button>`).join("")}`;
  document.querySelectorAll("[data-ar]").forEach(b=>b.onclick=async()=>{
    const area=AREAS[b.dataset.ar].n+" ("+AREAS[b.dataset.ar].sub+")";
    $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">🧪 Discursiva</h2></div>`+pensando("🧪 Criando a questão…");
    try{const q=await cofre({tipo:"disc_pergunta",area});
      $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">🧪 ${esc(q.assunto||"Discursiva")}</h2></div><div class="card"><div class="enun">${texto(q.enunciado)}</div></div>
      <div class="card"><textarea id="discTxt" rows="8" placeholder="Escreva a sua resposta (de 5 a 8 linhas)"></textarea><button class="btn btn-pri btn-bloco" id="discEnviar">Corrigir ✨</button></div><div id="discRes"></div>`;
      $("#discEnviar").onclick=async()=>{const r=$("#discTxt").value.trim();if(r.split(/\s+/).length<10)return toast("Escreva um pouco mais 🙂");$("#discRes").innerHTML=pensando("📝 Corrigindo…");
        try{const c=await cofre({tipo:"disc_corrigir",enunciado:q.enunciado,esperada:q.resposta_esperada,resposta:r});const nota=+c.nota||0;stat("discursivas");ganhar(15+Math.round(nota*2));if(nota>=7)palmas();
          enviarProgresso(`Discursiva: ${q.assunto||area} (nota ${nota})`,Math.round(nota),10);
          $("#discRes").innerHTML=`<div class="card"><div class="centro"><div class="nota-grande">${nota}</div></div><p>${texto(c.comentario||"",true)}</p><h3>🌟 Resposta nota 10</h3><div class="texto-base">${texto(c.resposta_modelo||"",true)}</div><button class="btn btn-pri btn-bloco" onclick="telaDiscursiva()">Outra discursiva 🧪</button></div>`;conferirTrofeus()}
        catch(e){$("#discRes").innerHTML=`<p class="sub">${esc(e.message)}</p>`}}
    }catch(e){toast(e.message);telaDiscursiva()}
  });
}

/* =================== PROVAS ANTIGAS DENTRO DO APP + IA =================== */
const LUPA=`<div class="card lupa-metodo"><h3>🔎 Método LUPA para ler qualquer questão</h3>
<p><b>L — Leia o comando primeiro.</b> Antes do texto, leia a pergunta. Assim você já sabe o que procurar.</p>
<p><b>U — Uma ideia por vez.</b> Em cada parágrafo, pergunte: "qual é a ideia principal aqui?". Resuma em 3 palavras.</p>
<p><b>P — Pistas e pegadinhas.</b> Circule palavras como "exceto", "não", "sempre", "apenas". É ali que a banca prende.</p>
<p><b>A — Alternativas: elimine.</b> Risque as erradas uma a uma. Quase sempre sobram duas: volte no texto e escolha.</p></div>`;
let PDF={doc:null,pag:1,url:"",nome:""};
async function carregarPdfJs(){
  if(window.pdfjsLib)return;
  await new Promise((ok,erro)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=ok;s.onerror=erro;document.head.appendChild(s)});
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}
function telaProvasIA(){
  aba="provas";render0();
  const lista=PROVAS[D.objetivo]||[];
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">📄 Provas antigas</h2></div>
  <p class="sub">Abra a prova aqui dentro, resolva com calma e, em qualquer página, peça para a professora IA explicar uma questão, usando o método LUPA.</p>
  <div class="lupa"><input id="bProva" placeholder="Procurar por ano" autocomplete="off"></div><div id="lProvas"></div>${LUPA}`;
  const des=()=>{const t=$("#bProva").value.trim().toLowerCase();
    $("#lProvas").innerHTML=lista.filter(p=>p.n.toLowerCase().includes(t)).map((p,i)=>`<button class="materia" data-pv="${lista.indexOf(p)}"><span class="ic">${p.gab?"✅":"📄"}</span><span class="info"><b>${esc(p.n)}</b><span class="sub">${esc(p.d)}</span></span><span>▶️</span></button>`).join("")||`<p class="sub">Nada encontrado.</p>`;
    document.querySelectorAll("[data-pv]").forEach(b=>b.onclick=()=>abrirProva(lista[+b.dataset.pv]))};
  $("#bProva").oninput=des;des();
}
async function abrirProva(p){
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">${esc(p.n)}</h2></div>`+pensando("📄 Abrindo a prova… (pode levar uns segundinhos)");
  try{
    await carregarPdfJs();
    const r=await cofre({tipo:"pdf",url:p.u});
    const bin=atob(r.dados),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    PDF={doc:await pdfjsLib.getDocument({data:bytes}).promise,pag:1,url:p.u,nome:p.n};
    const salvo=(D.paginas||{})[p.u];if(salvo&&salvo<=PDF.doc.numPages)PDF.pag=salvo;
    mostrarPagina();
  }catch(e){$("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}</div><div class="card"><p>Não consegui abrir essa prova agora (${esc(e.message)}). Tente de novo daqui a pouco.</p></div>`}
}
async function mostrarPagina(){
  const n=PDF.doc.numPages;D.paginas=D.paginas||{};D.paginas[PDF.url]=PDF.pag;salvar();
  $("#tela").innerHTML=`<div class="topoq"><button class="fechar" onclick="telaProvasIA()" aria-label="Voltar">←</button><b style="flex:1">${esc(PDF.nome)}</b></div>
  <div class="nav-sim"><button class="btn btn-sec" id="pAnt" ${PDF.pag>1?"":"disabled"}>←</button><span><b>Página ${PDF.pag}</b> de ${n}</span><button class="btn btn-sec" id="pPrx" ${PDF.pag<n?"":"disabled"}>→</button></div>
  <div class="folha-pdf"><canvas id="cv"></canvas></div>
  <div class="card ajuda-ia"><h3>💡 Travou numa questão desta página?</h3>
  <label for="pNum">Número da questão</label><input id="pNum" inputmode="numeric" placeholder="Ex.: 12 (ou deixe vazio)">
  <label for="pResp">Sua resposta (opcional)</label><input id="pResp" placeholder="Ex.: C">
  <label for="pDuv">Sua dúvida (opcional)</label><input id="pDuv" placeholder="Ex.: não entendi o gráfico">
  <button class="btn btn-pri btn-bloco" id="pExp" style="margin-top:10px">🔎 Explicar com o método LUPA</button><div id="pRes"></div></div>`;
  const pg=await PDF.doc.getPage(PDF.pag),cv=$("#cv"),larg=Math.min(1400,(document.querySelector("#tela").clientWidth-8)*2);
  const v1=pg.getViewport({scale:1}),vp=pg.getViewport({scale:larg/v1.width});cv.width=vp.width;cv.height=vp.height;
  await pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
  $("#pAnt").onclick=()=>{PDF.pag--;mostrarPagina();window.scrollTo(0,0)};$("#pPrx").onclick=()=>{PDF.pag++;mostrarPagina();window.scrollTo(0,0)};
  $("#pExp").onclick=async()=>{
    $("#pRes").innerHTML=pensando("🔎 Lendo a página com a lupa…");
    try{const img=cv.toDataURL("image/jpeg",0.85);
      const r=await cofre({tipo:"foto_questao",imagem:img,mime:"image/jpeg",numero:$("#pNum").value.trim(),resposta:$("#pResp").value.trim(),duvida:$("#pDuv").value.trim()});
      stat("fotos");ganhar(10);$("#pRes").innerHTML=`<div class="ia">${texto(r,true)}</div>`;conferirTrofeus();enviarProgresso(`Prova antiga: ${PDF.nome}, pág. ${PDF.pag}`,0,0);
    }catch(e){$("#pRes").innerHTML=`<p class="sub">${esc(e.message)}. Tente de novo.</p>`}};
}

/* =================== FOTO DE QUESTÃO =================== */
function telaFoto(){
  aba="foto";render0();
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">📸 Foto de questão</h2></div>
  <p class="sub">Tire foto de uma questão de prova impressa, apostila ou da tela, e a professora IA explica com o método LUPA.</p>
  <div class="card"><label class="btn btn-pri btn-bloco centro" for="fotoArq">📷 Tirar foto ou escolher imagem</label><input id="fotoArq" type="file" accept="image/*" capture="environment" class="oculto">
  <img id="fotoVer" class="oculto" style="width:100%;border-radius:14px;margin-top:10px" alt="Foto da questão">
  <label for="fNum">Número da questão (se tiver mais de uma)</label><input id="fNum" inputmode="numeric" placeholder="Ex.: 7">
  <label for="fResp">Sua resposta (opcional)</label><input id="fResp" placeholder="Ex.: B">
  <button class="btn btn-pri btn-bloco" id="fExp" style="margin-top:10px" disabled>🔎 Explicar</button><div id="fRes"></div></div>${LUPA}`;
  let img="";
  $("#fotoArq").onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{const max=1600,esc_=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=im.width*esc_;c.height=im.height*esc_;c.getContext("2d").drawImage(im,0,0,c.width,c.height);img=c.toDataURL("image/jpeg",0.85);$("#fotoVer").src=img;$("#fotoVer").classList.remove("oculto");$("#fExp").disabled=false};im.src=URL.createObjectURL(f)};
  $("#fExp").onclick=async()=>{$("#fRes").innerHTML=pensando("🔎 Lendo a sua foto…");
    try{const r=await cofre({tipo:"foto_questao",imagem:img,mime:"image/jpeg",numero:$("#fNum").value.trim(),resposta:$("#fResp").value.trim()});stat("fotos");ganhar(10);$("#fRes").innerHTML=`<div class="ia">${texto(r,true)}</div>`;conferirTrofeus();enviarProgresso("Foto de questão explicada",0,0)}
    catch(e){$("#fRes").innerHTML=`<p class="sub">${esc(e.message)}</p>`}};
}

/* =================== DESAFIO COM CÓDIGO =================== */
function rngDe(cod){let h=2166136261;for(const c of cod){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%100000)/100000}}
function questoesDoDesafio(cod){const r=rngDe(cod),ids=Object.keys(BANCO).sort(),esc_=[];while(esc_.length<5){const id=ids[Math.floor(r()*ids.length)];if(!esc_.includes(id))esc_.push(id)}return esc_}
function telaDesafio(){
  aba="desafio";render0();
  $("#tela").innerHTML=`<div class="topoq">${voltarTreinos()}<h2 style="margin:0">👯 Desafio com código</h2></div>
  <div class="card centro"><p>Crie um desafio e mande o código para a sua irmã (ou para quem quiser). Todo mundo responde as <b>mesmas 5 questões</b> e o placar mostra quem acertou mais e mais rápido.</p>
  <button class="btn btn-pri btn-bloco" id="dCriar">Criar desafio novo ⚔️</button></div>
  <div class="card"><label for="dCod">Recebeu um código?</label><input id="dCod" placeholder="Ex.: K7Q2PX" maxlength="8" style="text-transform:uppercase"><button class="btn btn-sec btn-bloco" id="dEntrar" style="margin-top:8px">Entrar no desafio</button></div>`;
  $("#dCriar").onclick=()=>{const L="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let c="";for(let i=0;i<6;i++)c+=L[Math.floor(Math.random()*L.length)];comecarDesafio(c,true)};
  $("#dEntrar").onclick=()=>{const c=$("#dCod").value.toUpperCase().replace(/[^A-Z0-9]/g,"");if(c.length<4)return toast("Confira o código 🙂");comecarDesafio(c,false)};
}
let DES=null;
async function comecarDesafio(cod,novo){
  if(!carregado){toast("Carregando…");await carregando}
  if(novo){const txt=`Te desafio no Aprova Fácil! ⚔️ Código: ${cod}`;
    abrirModal(`<h3>⚔️ Desafio criado!</h3><p>Código do desafio:</p><div class="codigo">${cod}</div><p class="sub">Mande esse código para a sua irmã. Ela entra em Treinos → Desafio com código.</p>
    <button class="btn btn-sec btn-bloco" id="dComp">📤 Compartilhar o código</button><button class="btn btn-pri btn-bloco" id="dJa" style="margin-top:8px">Começar agora ▶️</button>`);
    $("#dComp").onclick=()=>{if(navigator.share)navigator.share({text:txt}).catch(()=>{});else{try{navigator.clipboard.writeText(txt);toast("Código copiado 📋")}catch(e){}}};
    $("#dJa").onclick=()=>{fecharModal();iniciarDes(cod)};return}
  iniciarDes(cod);
}
function iniciarDes(cod){DES={cod,inicio:Date.now()};Q={data:hoje(),ids:questoesDoDesafio(cod),idx:0,acertos:0,modo:"desafio",fim:false};ir("quiz")}
async function fimDesafio(a,n){
  const seg=Math.round((Date.now()-DES.inicio)/1000);stat("desafios");
  $("#tela").innerHTML=pensando("⚔️ Buscando o placar…");
  try{const pl=await cofre({tipo:"desafio",acao:"salvar",codigo:DES.cod,nome:(D.avatar||"")+" "+D.nome,acertos:a,total:n,segundos:seg});
    $("#tela").innerHTML=`<div class="card centro"><div class="grande">⚔️</div><h2>Placar do desafio ${esc(DES.cod)}</h2>
    ${pl.map((p,i)=>`<div class="placar-linha ${p.nome.includes(D.nome)?"eu":""}"><span>${["🥇","🥈","🥉"][i]||"🎖️"}</span><b>${esc(p.nome)}</b><span>${p.acertos}/${p.total} · ${Math.floor(p.segundos/60)}min${String(p.segundos%60).padStart(2,"0")}</span></div>`).join("")}
    <p class="sub">Volte depois para ver se sua irmã já jogou 😏</p><button class="btn btn-sec btn-bloco" id="dAtual">🔄 Atualizar placar</button><button class="btn btn-pri btn-bloco" onclick="ir('treinos')" style="margin-top:8px">Voltar</button></div>`;
    const cod=DES.cod;$("#dAtual").onclick=async()=>{try{const p2=await cofre({tipo:"desafio",acao:"ver",codigo:cod});toast(p2.map(p=>p.nome+": "+p.acertos).join(" · "))}catch(e){toast(e.message)}};
  }catch(e){$("#tela").innerHTML=`<div class="card centro"><h2>${a} de ${n}</h2><p class="sub">Não consegui salvar no placar agora (${esc(e.message)}).</p><button class="btn btn-pri btn-bloco" onclick="ir('treinos')">Voltar</button></div>`}
  DES=null;
}

/* =================== DUELO DAS GÊMEAS =================== */
const RECADOS=["Fiz a minha missão, e você? 😏","Bora estudar juntas hoje? 📚","Tô te passando, hein! 🏃‍♀️💨","Orgulho de você, irmã! 💛","Hoje é dia de revanche ⚔️","Vamos bater a meta do mês! 🎯","Quem acertar mais escolhe o filme 🍿"];
let GRUPO=null;
async function atualizarGrupo(acao,texto_){
  if(!D.grupo||!navigator.onLine)return null;
  try{GRUPO=await cofre({tipo:"grupo",grupo:D.grupo,acao:acao||"ver",texto:texto_||"",nome:(D.avatar||"")+" "+D.nome});return GRUPO}catch(e){return null}
}
async function telaDuelo(){
  if(!D.grupo){
    $("#tela").innerHTML=`<h2>⚔️ Duelo das gêmeas</h2><div class="card centro"><div class="grande">👯‍♀️</div><p>Liguem os aplicativos das duas para ver o placar da semana, a meta do mês juntas e trocar recadinhos.</p>
    <button class="btn btn-pri btn-bloco" id="gCriar">Criar o código das gêmeas</button></div>
    <div class="card"><label for="gCod">A sua irmã já criou? Coloque o código dela:</label><input id="gCod" placeholder="Ex.: GEM-4K7Q" style="text-transform:uppercase"><button class="btn btn-sec btn-bloco" id="gEntrar" style="margin-top:8px">Entrar no duelo</button></div>`;
    $("#gCriar").onclick=()=>{const L="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let c="GEM";for(let i=0;i<5;i++)c+=L[Math.floor(Math.random()*L.length)];D.grupo=c;salvar();enviarProgresso("Criou o duelo das gêmeas",0,0);
      abrirModal(`<h3>👯‍♀️ Código das gêmeas</h3><div class="codigo">${c}</div><p class="sub">Mande para a sua irmã. Ela abre ⚔️ Duelo e coloca esse código.</p><button class="btn btn-sec btn-bloco" id="gComp">📤 Compartilhar</button><button class="btn btn-pri btn-bloco" onclick="fecharModal();telaDuelo()" style="margin-top:8px">Pronto</button>`);
      $("#gComp").onclick=()=>{const t=`Entra no meu duelo do Aprova Fácil! ⚔️ Código: ${c}`;if(navigator.share)navigator.share({text:t}).catch(()=>{});else{try{navigator.clipboard.writeText(t);toast("Copiado 📋")}catch(e){}}}};
    $("#gEntrar").onclick=()=>{const c=$("#gCod").value.toUpperCase().replace(/[^A-Z0-9]/g,"");if(c.length<5)return toast("Confira o código 🙂");D.grupo=c;salvar();enviarProgresso("Entrou no duelo das gêmeas",0,0);palmas();setTimeout(telaDuelo,800)};
    return;
  }
  $("#tela").innerHTML=`<h2>⚔️ Duelo das gêmeas</h2>`+pensando("⚔️ Buscando o placar…");
  const g=await atualizarGrupo();
  const sem=semanaAtual(),mes=mesAtual();
  const membros=(g&&g.membros)||[];
  const pontosSem=m=>m.semana===sem?+m.xpSemana||0:0,qMes=m=>m.mes===mes?+m.qMes||0:0;
  const ord=membros.slice().sort((a,b)=>pontosSem(b)-pontosSem(a));
  const somaMes=membros.reduce((s,m)=>s+qMes(m),0),meta=D.metaMes||600;
  if(ord.length>1&&ord[0].eu&&pontosSem(ord[0])>pontosSem(ord[1])){const d=new Date().getDay();if(d===0){D.stats.venceuSemana=1;salvar();conferirTrofeus()}}
  $("#tela").innerHTML=`<h2>⚔️ Duelo das gêmeas</h2>
  <div class="card"><h3>🏁 Placar da semana</h3>${ord.length?ord.map((m,i)=>`<div class="placar-linha ${m.eu?"eu":""}"><span>${i===0&&pontosSem(m)>0?"👑":"⭐"}</span><b>${esc(m.perfil||m.nome)}${m.eu?" (você)":""}</b><span>${pontosSem(m)} pts</span></div>`).join(""):`<p class="sub">${g?"Ninguém no duelo ainda.":"Sem internet agora."}</p>`}
  ${membros.length<2?`<p class="sub">Esperando a sua irmã entrar com o código <b>${esc(D.grupo)}</b> 👀</p>`:""}
  ${ord.length>1?`<p class="sub">${ord[0].eu?"Você está na frente! Não deixa ela passar 😏":`Faltam ${pontosSem(ord[0])-pontosSem(ord.find(x=>x.eu)||{})+1} pontos para você passar a sua irmã! 💪`}</p>`:""}</div>
  <div class="card"><h3>🤝 Meta das gêmeas · ${new Date().toLocaleDateString("pt-BR",{month:"long"})}</h3><p>${somaMes} de ${meta} questões juntas</p><div class="barra grossa"><i style="width:${Math.min(100,somaMes/meta*100)}%"></i></div>
  <p>🎁 Prêmio: <b>${esc(D.premio||"combine um prêmio com a família!")}</b></p><button class="btn btn-sec btn-bloco" id="gPremio">✏️ Mudar meta e prêmio</button></div>
  <div class="card"><h3>💌 Recadinhos</h3><div class="recados">${((g&&g.recados)||[]).slice().reverse().map(r=>`<div class="recado ${r.deMim?"meu":""}"><b>${esc(r.nome)}</b> ${esc(r.texto)}</div>`).join("")||`<p class="sub">Nenhum recado ainda.</p>`}</div>
  <div class="botoes-recado">${RECADOS.map((t,i)=>`<button class="chip" data-rc="${i}">${t}</button>`).join("")}</div></div>
  <div class="card"><h3>👤 Total de cada uma</h3>${membros.map(m=>`<div class="placar-linha"><span>${m.eu?"💛":"💜"}</span><b>${esc(m.perfil||m.nome)}</b><span>⭐ ${m.xp||0} · 🔥 ${m.seq||0}</span></div>`).join("")}
  <p class="sub">Código do duelo: <b>${esc(D.grupo)}</b></p></div>`;
  if(g&&g.recados&&g.recados.length){D.recadoVisto=g.recados.length;salvar()}
  document.querySelectorAll("[data-rc]").forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await atualizarGrupo("recado",RECADOS[+b.dataset.rc]);if(r){stat("recados");toast("Recado enviado 💌");conferirTrofeus();telaDuelo()}else{toast("Não consegui enviar agora");b.disabled=false}});
  $("#gPremio").onclick=()=>{abrirModal(`<h3>🎁 Meta do mês</h3><label for="mMeta">Questões juntas no mês</label><input id="mMeta" inputmode="numeric" value="${meta}"><label for="mPremio">Prêmio se baterem a meta</label><input id="mPremio" value="${esc(D.premio||"")}" placeholder="Ex.: rodízio de pizza 🍕"><p class="sub">Combinem o prêmio com a família. Cada uma vê o que colocou no próprio celular.</p><button class="btn btn-pri btn-bloco" id="mSalvar">Salvar</button>`);
    $("#mSalvar").onclick=()=>{D.metaMes=Math.max(10,+$("#mMeta").value||600);D.premio=$("#mPremio").value.trim().slice(0,80);salvar();fecharModal();telaDuelo()}};
}
async function avisarRecados(){
  const g=await atualizarGrupo();if(!g||!g.recados)return;
  const novos=g.recados.length-(D.recadoVisto||0),ult=g.recados[g.recados.length-1];
  if(novos>0&&ult&&!ult.deMim)toast(`💌 ${ult.nome}: ${ult.texto}`);
}

/* =================== RESUMO DA SEMANA PARA POSTAR =================== */
async function resumoSemana(){
  const w=D.semanas[semanaAtual()]||{xp:0,q:0,a:0},c=document.createElement("canvas");c.width=1080;c.height=1920;const x=c.getContext("2d"),t=TEMAS[D.tema]||TEMAS.azul;
  const g=x.createLinearGradient(0,0,0,1920);g.addColorStop(0,t.topo);g.addColorStop(1,"#24507F");x.fillStyle=g;x.fillRect(0,0,1080,1920);
  x.textAlign="center";x.fillStyle="#fff";x.font="bold 64px Nunito, sans-serif";x.fillText("Minha semana no",540,230);x.fillStyle=t.ac;x.font="900 96px Nunito, sans-serif";x.fillText("Aprova Fácil",540,350);
  x.font="200px serif";x.fillText(D.avatar||"🎓",540,620);
  const linhas=[["📚",w.q+" questões"],["🎯",(w.q?Math.round(w.a/w.q*100):0)+"% de acertos"],["🔥",sequencia()+" dias seguidos"],["⭐",w.xp+" pontos na semana"],["🏆",D.trofeus.length+" troféus"]];
  linhas.forEach(([e,s],i)=>{const y=780+i*170;x.fillStyle="rgba(255,255,255,.12)";x.beginPath();x.roundRect(140,y-95,800,140,40);x.fill();x.fillStyle="#fff";x.font="bold 64px Nunito, sans-serif";x.fillText(e+"  "+s,540,y)});
  x.fillStyle=t.ac;x.font="bold 56px Nunito, sans-serif";x.fillText((OBJETIVOS[D.objetivo].nome)+", estou chegando! 🚀",540,1700);
  try{const im=new Image();im.src="logo-by.png";await im.decode();const h=60,w2=im.width*h/im.height;x.fillStyle="#CFE2F2";x.font="40px Nunito, sans-serif";x.fillText("by",540-w2/2-10,1825);x.drawImage(im,540-w2/2+30,1785,w2,h)}catch(e){}
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));const arq=new File([blob],"minha-semana-aprova-facil.png",{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[arq]})){navigator.share({files:[arq],text:"Minha semana no Aprova Fácil 🚀"}).catch(()=>{})}
  else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=arq.name;a.click();toast("Imagem salva 📸")}
}
