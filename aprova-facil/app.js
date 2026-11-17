/* ================= Aprova Fácil by DayIA ================= */
const $=s=>document.querySelector(s);
const CHAVE="aprovafacil-v1";
const OBJETIVOS={
  gv:{nome:"Direito GV",ic:"👩‍⚖️",prova:"2027-10-17",info:"1ª fase: questões objetivas e discursivas · 2ª fase: exame oral",
      foco:["port","lit","filo","cid","hist","geo","mat","ing"]},
  fuvest:{nome:"Psicologia USP",ic:"🧠",prova:"2027-11-21",info:"Fuvest · 1ª fase: 80 questões · 2ª fase: discursivas e redação",
      foco:["port","lit","mat","bio","hist","geo","qui","fis","filo","ing"]}
};
const NIVEIS=["Começo","Ritmo","Foco","Garra","Brilho","Rumo à aprovação","Imparável","Lenda do vestibular"];
const MEDALHAS=[
  {id:"primeira",i:"🌱",n:"Primeira missão",ok:d=>d.dias.length>=1},
  {id:"tres",i:"🔥",n:"3 dias seguidos",ok:()=>sequencia()>=3},
  {id:"sete",i:"⚡",n:"7 dias seguidos",ok:()=>sequencia()>=7},
  {id:"cem",i:"⭐",n:"100 pontos",ok:d=>d.xp>=100},
  {id:"quinhentos",i:"🌟",n:"500 pontos",ok:d=>d.xp>=500},
  {id:"perfeita",i:"🎯",n:"Missão sem erro",ok:d=>!!d.perfeita},
  {id:"revisao",i:"🔁",n:"Acertou um erro antigo",ok:d=>!!d.corrigiu},
  {id:"todas",i:"🗺️",n:"Treinou todas as matérias",ok:d=>Object.keys(MATERIAS).every(m=>Object.keys(d.resp).some(id=>QUESTOES[id]&&QUESTOES[id].m===m))},
  {id:"cinquenta",i:"🏆",n:"50 acertos",ok:d=>totalAcertos()>=50}
];

/* ---------- dados guardados no celular ---------- */
function novo(){return {nome:"",objetivo:"",dataProva:"",xp:0,dias:[],resp:{},erros:[],medalhas:[],missao:null,perfeita:false,corrigiu:false}}
let D;try{D=Object.assign(novo(),JSON.parse(localStorage.getItem(CHAVE))||{})}catch(e){D=novo()}
function salvar(){try{localStorage.setItem(CHAVE,JSON.stringify(D))}catch(e){}}

/* ---------- utilidades ---------- */
const hoje=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const diaMenos=(iso,n)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const negrito=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
const LETRAS="ABCDE";
function embaralhar(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("on"),2600)}
function festa(qtd=28){const f=$("#festa");const em=["🎉","⭐","✨","💛","🎊"];for(let i=0;i<qtd;i++){const s=document.createElement("i");s.textContent=em[i%em.length];s.style.left=Math.random()*100+"vw";s.style.animationDelay=Math.random()*.6+"s";f.appendChild(s);setTimeout(()=>s.remove(),3200)}}
function abrirModal(html){$("#modalCaixa").innerHTML=html;$("#modal").classList.remove("oculto")}
function fecharModal(){$("#modal").classList.add("oculto")}
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")fecharModal()});

/* ---------- pontos, nível e sequência ---------- */
const nivel=()=>Math.floor(D.xp/100);
const nomeNivel=()=>NIVEIS[Math.min(nivel(),NIVEIS.length-1)];
function totalAcertos(){return Object.values(D.resp).reduce((s,r)=>s+r.a,0)}
// Sequência de dias: um dia sem estudar por semana vira "dia de descanso" e não quebra a sequência.
function sequencia(){
  const set=new Set(D.dias);let d=set.has(hoje())?hoje():diaMenos(hoje(),1);
  let n=0,folgas=0,desde=0;
  while(true){
    if(set.has(d)){n++;desde++;d=diaMenos(d,1);continue}
    if(n>0&&folgas<1+Math.floor(desde/7)&&set.has(diaMenos(d,1))){folgas++;d=diaMenos(d,1);continue}
    break;
  }
  return n;
}
function ganhar(pts){const antes=nivel();D.xp+=pts;salvar();placar();if(nivel()>antes){setTimeout(()=>{festa(40);toast("🎉 Subiu de nível: "+nomeNivel()+"!")},400)}}
function conferirMedalhas(){MEDALHAS.forEach(m=>{if(!D.medalhas.includes(m.id)&&m.ok(D)){D.medalhas.push(m.id);salvar();setTimeout(()=>{festa(20);toast("🏅 Nova conquista: "+m.n)},900)}})}
function placar(){$("#placar").innerHTML=D.objetivo?`<span>🔥 ${sequencia()}</span><span class="xp">⭐ ${D.xp}</span>`:""}

/* ---------- navegação ---------- */
let aba="inicio";
function ir(a){aba=a;render();window.scrollTo(0,0)}
document.querySelectorAll(".menu button").forEach(b=>b.onclick=()=>ir(b.dataset.aba));
function render(){
  placar();
  $("#menu").classList.toggle("oculto",!D.objetivo||aba==="quiz");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.toggle("ativo",b.dataset.aba===aba));
  if(!D.objetivo)return telaBoasVindas();
  ({inicio:telaInicio,trilha:telaTrilha,erros:telaErros,progresso:telaProgresso,quiz:telaQuiz}[aba]||telaInicio)();
}

/* ---------- boas-vindas ---------- */
function telaBoasVindas(){
  let esc_obj=D.objetivo||"";
  $("#tela").innerHTML=`<div class="centro"><div class="grande">🎓</div><h2>Bem-vinda ao Aprova Fácil!</h2>
  <p class="sub">Missões curtinhas todo dia, pontos e conquistas. Estudar para o vestibular pode ser leve.</p></div>
  <div class="card"><label for="bvNome">Como você quer ser chamada?</label><input id="bvNome" placeholder="Seu nome ou apelido" autocomplete="off" value="${esc(D.nome)}">
  <label>Qual é o seu objetivo?</label>
  ${Object.entries(OBJETIVOS).map(([k,o])=>`<button class="objetivo" data-obj="${k}"><span class="ic">${o.ic}</span><span><b>${o.nome}</b><span class="sub">${o.info}</span></span></button>`).join("")}
  <button class="btn btn-pri btn-bloco" id="bvComecar" style="margin-top:10px">Começar minha jornada 🚀</button></div>`;
  document.querySelectorAll("[data-obj]").forEach(b=>b.onclick=()=>{esc_obj=b.dataset.obj;document.querySelectorAll("[data-obj]").forEach(x=>x.classList.toggle("sel",x===b))});
  $("#bvComecar").onclick=()=>{
    if(!esc_obj)return toast("Escolha o seu objetivo 😉");
    D.nome=$("#bvNome").value.trim();D.objetivo=esc_obj;D.dataProva=OBJETIVOS[esc_obj].prova;salvar();festa();ir("inicio");
  };
}

/* ---------- início ---------- */
function telaInicio(){
  const o=OBJETIVOS[D.objetivo];
  const faltam=Math.max(0,Math.ceil((new Date(D.dataProva+"T12:00:00")-new Date())/864e5));
  const feita=D.missao&&D.missao.data===hoje()&&D.missao.fim;
  const h=new Date().getHours(),saud=h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";
  const xpNivel=D.xp%100;
  $("#tela").innerHTML=`<p class="ola">${saud}${D.nome?", "+esc(D.nome):""}! 👋</p>
  <div class="card contagem"><div class="sub">${o.ic} ${o.nome}</div><div class="num">${faltam}</div><div class="sub">dias para a prova (${new Date(D.dataProva+"T12:00:00").toLocaleDateString("pt-BR")})</div></div>
  <div class="stats"><div class="stat"><b>🔥 ${sequencia()}</b><small>dias seguidos</small></div><div class="stat"><b>⭐ ${D.xp}</b><small>pontos</small></div><div class="stat"><b>🏅 ${D.medalhas.length}</b><small>conquistas</small></div></div>
  <div class="card"><b>Nível ${nivel()+1}: ${nomeNivel()}</b><div class="barra"><i style="width:${xpNivel}%"></i></div><div class="sub">Faltam ${100-xpNivel} pontos para o próximo nível</div></div>
  <div class="card missao ${feita?"feita":""}">${feita?`<h3>✅ Missão de hoje concluída!</h3><p class="sub">Você acertou ${D.missao.acertos} de ${D.missao.ids.length}. Amanhã tem mais. Se quiser, treine mais um pouco na Trilha.</p><button class="btn btn-sec btn-bloco" id="btnExtra">Fazer uma missão extra ✨</button>`
   :`<h3>🎯 Missão do dia</h3><p class="sub">5 questões · uns 10 minutos · até 70 pontos</p><button class="btn btn-pri btn-bloco" id="btnMissao">${D.missao&&D.missao.data===hoje()?"Continuar a missão":"Começar a missão"}</button>`}</div>
  <h3 style="margin-top:20px">Vem aí 👀</h3>
  <div class="embreve">
    <div>✍️ Redação com IA<small>Nota e dicas no padrão ${D.objetivo==="gv"?"da GV":"da Fuvest"}</small><span class="selo">em breve</span></div>
    ${D.objetivo==="gv"?`<div>🎤 Treino de oral<small>A IA faz o papel da banca</small><span class="selo">em breve</span></div>`:`<div>🧪 Discursivas<small>Correção explicada</small><span class="selo">em breve</span></div>`}
    <div>⏱️ Simulado<small>Com cronômetro, como no dia</small><span class="selo">em breve</span></div>
    <div>👯 Desafio entre amigas<small>Quem acerta mais?</small><span class="selo">em breve</span></div>
  </div>
  <button class="btn btn-sec btn-bloco" id="btnAjustes" style="margin-top:16px">⚙️ Ajustes</button>`;
  const b=$("#btnMissao");if(b)b.onclick=()=>comecarMissao(false);
  const x=$("#btnExtra");if(x)x.onclick=()=>comecarMissao(true);
  $("#btnAjustes").onclick=ajustes;
}

/* ---------- missão / quiz ---------- */
let Q=null; // quiz em andamento: {ids,idx,acertos,modo,respondida}
function escolherQuestoes(n,materia){
  const foco=materia?[materia]:OBJETIVOS[D.objetivo].foco;
  const ids=QUESTOES.map((q,i)=>i).filter(i=>foco.includes(QUESTOES[i].m));
  const nunca=embaralhar(ids.filter(i=>!D.resp[i])),errou=embaralhar(ids.filter(i=>D.erros.includes(i))),resto=embaralhar(ids.filter(i=>D.resp[i]&&!D.erros.includes(i)));
  const lista=[...errou.slice(0,2),...nunca,...errou.slice(2),...resto];
  return [...new Set(lista)].slice(0,n);
}
function comecarMissao(extra){
  if(!extra&&D.missao&&D.missao.data===hoje()&&!D.missao.fim){Q=D.missao;}
  else{Q={data:hoje(),ids:escolherQuestoes(5),idx:0,acertos:0,modo:extra?"extra":"missao",fim:false};if(!extra){D.missao=Q;salvar()}}
  ir("quiz");
}
function treinar(ids,modo){Q={data:hoje(),ids,idx:0,acertos:0,modo,fim:false};ir("quiz")}
function telaQuiz(){
  if(!Q)return ir("inicio");
  if(Q.idx>=Q.ids.length)return fimQuiz();
  const id=Q.ids[Q.idx],q=QUESTOES[id],mat=MATERIAS[q.m];
  $("#tela").innerHTML=`<div class="topoq"><button class="fechar" id="sair" aria-label="Sair">✕</button><div class="barra"><i style="width:${Q.idx/Q.ids.length*100}%"></i></div><b>${Q.idx+1}/${Q.ids.length}</b></div>
  <span class="tagm">${mat.i} ${mat.n}</span><p class="enun">${esc(q.e)}</p>
  <div id="alts">${q.a.map((t,i)=>`<button class="alt" data-i="${i}"><span class="l">${LETRAS[i]}</span><span>${esc(t)}</span></button>`).join("")}</div><div id="volta"></div>`;
  $("#sair").onclick=()=>{if(Q.modo==="missao"){D.missao=Q;salvar()}Q=null;ir("inicio")};
  document.querySelectorAll(".alt").forEach(b=>b.onclick=()=>responder(id,+b.dataset.i));
}
function responder(id,i){
  const q=QUESTOES[id],certo=i===q.c;
  document.querySelectorAll(".alt").forEach(b=>{b.disabled=true;const k=+b.dataset.i;if(k===q.c)b.classList.add("certa");else if(k===i)b.classList.add("errada")});
  const r=D.resp[id]||{a:0,e:0};
  if(certo){r.a++;Q.acertos++;if(D.erros.includes(id)){D.erros=D.erros.filter(x=>x!==id);D.corrigiu=true}}
  else{r.e++;if(!D.erros.includes(id))D.erros.push(id)}
  D.resp[id]=r;const pts=certo?10:2;ganhar(pts);
  const elogios=["Isso aí! 🎉","Mandou bem! 💪","Arrasou! ✨","Perfeito! 🎯","Que orgulho! 💛"],calmas=["Quase! Bora entender 💡","Tudo bem errar aqui 😉","Agora você não esquece mais 💡"];
  $("#volta").innerHTML=`<div class="explica ${certo?"ok":"nao"}"><h3>${certo?elogios[Math.floor(Math.random()*elogios.length)]:calmas[Math.floor(Math.random()*calmas.length)]} <span class="mais">+${pts}</span></h3>
  ${certo?"":`<p class="sub">A resposta certa é a <b>${LETRAS[q.c]}</b>.</p>`}<p>${negrito(q.x)}</p>
  <button class="btn btn-pri btn-bloco" id="prox">${Q.idx+1<Q.ids.length?"Próxima →":"Ver resultado 🏁"}</button></div>`;
  if(Q.modo==="missao"){D.missao=Q}
  salvar();
  $("#prox").onclick=()=>{Q.idx++;if(Q.modo==="missao"){D.missao=Q;salvar()}render();window.scrollTo(0,0)};
  $("#volta").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function fimQuiz(){
  const n=Q.ids.length,a=Q.acertos;let bonus=0;
  if(Q.modo==="missao"&&!Q.fim){Q.fim=true;D.missao=Q;if(!D.dias.includes(hoje()))D.dias.push(hoje());bonus=20;if(a===n)D.perfeita=true;salvar();ganhar(bonus)}
  conferirMedalhas();placar();festa(a>=n-1?40:18);
  const msg=a===n?"Missão perfeita! Você está voando 🚀":a>=n*.6?"Muito bem! Cada missão te deixa mais perto da aprovação 💛":"Hoje foi dia de aprender com os erros, e isso conta muito! 💪";
  $("#tela").innerHTML=`<div class="card centro"><div class="grande">${a===n?"🏆":a>=n*.6?"🎉":"🌱"}</div><h2>${a} de ${n} certas</h2><p>${msg}</p>
  ${bonus?`<p><span class="mais">+${bonus}</span> bônus por concluir a missão do dia</p>`:""}
  <p class="sub">🔥 Sequência: ${sequencia()} ${sequencia()===1?"dia":"dias"} · ⭐ ${D.xp} pontos</p>
  <button class="btn btn-pri btn-bloco" id="fimOk">Voltar ao início</button>
  ${D.erros.length?`<button class="btn btn-sec btn-bloco" id="fimRev" style="margin-top:10px">🔁 Revisar meus erros</button>`:""}</div>`;
  Q=null;
  $("#fimOk").onclick=()=>ir("inicio");const r=$("#fimRev");if(r)r.onclick=()=>ir("erros");
}

/* ---------- trilha ---------- */
function telaTrilha(){
  const foco=OBJETIVOS[D.objetivo].foco,todas=[...foco,...Object.keys(MATERIAS).filter(m=>!foco.includes(m))];
  $("#tela").innerHTML=`<h2>🗺️ Sua trilha</h2><p class="sub">Escolha uma matéria e faça uma fase. Cada acerto acende um pedacinho do caminho.</p>
  <div class="lupa"><input id="busca" placeholder="Procurar matéria" autocomplete="off"></div><div id="lista"></div>`;
  const desenhar=()=>{const t=$("#busca").value.trim().toLowerCase();
    $("#lista").innerHTML=todas.filter(m=>MATERIAS[m].n.toLowerCase().includes(t)).map(m=>{
      const ids=QUESTOES.map((q,i)=>i).filter(i=>QUESTOES[i].m===m),ok=ids.filter(i=>D.resp[i]&&D.resp[i].a>0&&!D.erros.includes(i)).length;
      return `<button class="materia" data-m="${m}"><span class="ic">${MATERIAS[m].i}</span><span class="info"><b>${MATERIAS[m].n}${foco.includes(m)?"":` <small class="sub">· extra</small>`}</b><span class="sub">${ok} de ${ids.length} dominadas</span><span class="fases">${ids.map((_,k)=>`<i class="${k<ok?"ok":""}"></i>`).join("")}</span></span><span>▶️</span></button>`}).join("")||`<p class="sub">Nenhuma matéria com esse nome.</p>`;
    document.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>treinar(escolherQuestoes(5,b.dataset.m),"treino"));};
  $("#busca").oninput=desenhar;desenhar();
}

/* ---------- revisar erros ---------- */
function telaErros(){
  $("#tela").innerHTML=`<h2>🔁 Revisar</h2><p class="sub">As questões que você errou ficam aqui. Acertou de novo? Ela sai da lista e você ganha uma conquista.</p>
  ${D.erros.length?`<button class="btn btn-pri btn-bloco" id="refazTodas" style="margin-bottom:12px">Refazer ${Math.min(5,D.erros.length)} questões agora</button><div class="lupa"><input id="busca" placeholder="Procurar nos erros" autocomplete="off"></div><div id="lista"></div>`
  :`<div class="card centro"><div class="grande">✨</div><p>Nenhum erro para revisar. Continue assim!</p></div>`}`;
  if(!D.erros.length)return;
  $("#refazTodas").onclick=()=>treinar(embaralhar(D.erros).slice(0,5),"revisao");
  const desenhar=()=>{const t=$("#busca").value.trim().toLowerCase();
    $("#lista").innerHTML=D.erros.filter(id=>(QUESTOES[id].e+" "+MATERIAS[QUESTOES[id].m].n).toLowerCase().includes(t)).map(id=>`<button class="materia" data-q="${id}"><span class="ic">${MATERIAS[QUESTOES[id].m].i}</span><span class="info"><b>${MATERIAS[QUESTOES[id].m].n}</b><span class="sub">${esc(QUESTOES[id].e.slice(0,90))}${QUESTOES[id].e.length>90?"…":""}</span></span><span>▶️</span></button>`).join("")||`<p class="sub">Nada encontrado.</p>`;
    document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>treinar([+b.dataset.q],"revisao"));};
  $("#busca").oninput=desenhar;desenhar();
}

/* ---------- conquistas e progresso ---------- */
function telaProgresso(){
  const porMat=Object.keys(MATERIAS).map(m=>{let a=0,e=0;Object.entries(D.resp).forEach(([id,r])=>{if(QUESTOES[id]&&QUESTOES[id].m===m){a+=r.a;e+=r.e}});return {m,a,e,p:a+e?Math.round(a/(a+e)*100):null}});
  const feitas=porMat.filter(x=>x.p!==null).sort((x,y)=>y.p-x.p);
  const forte=feitas.filter(x=>x.p>=70).slice(0,2),treinar_=feitas.filter(x=>x.p<60).slice(-2);
  $("#tela").innerHTML=`<h2>🏅 Conquistas</h2>
  <div class="medalhas">${MEDALHAS.map(m=>`<div class="medalha ${D.medalhas.includes(m.id)?"":"bloq"}"><span>${m.i}</span>${m.n}</div>`).join("")}</div>
  <div class="card" style="margin-top:14px"><h3>📊 Como você está</h3>
  ${feitas.length?`${forte.length?`<p>💪 Forte em: <b>${forte.map(x=>MATERIAS[x.m].n).join(" e ")}</b></p>`:""}${treinar_.length?`<p>💡 Vale treinar: <b>${treinar_.map(x=>MATERIAS[x.m].n).join(" e ")}</b></p>`:""}
  ${porMat.map(x=>`<div class="linhamat"><span class="nome">${MATERIAS[x.m].i} ${MATERIAS[x.m].n}</span><div class="barra"><i style="width:${x.p||0}%"></i></div><small>${x.p===null?"–":x.p+"%"}</small></div>`).join("")}`
  :`<p class="sub">Faça a primeira missão para ver aqui as matérias em que você brilha. ✨</p>`}</div>`;
}

/* ---------- ajustes ---------- */
function ajustes(){
  abrirModal(`<h3>⚙️ Ajustes</h3><label for="jNome">Seu nome</label><input id="jNome" value="${esc(D.nome)}">
  <label for="jObj">Objetivo</label><select id="jObj">${Object.entries(OBJETIVOS).map(([k,o])=>`<option value="${k}" ${k===D.objetivo?"selected":""}>${o.ic} ${o.nome}</option>`).join("")}</select>
  <label for="jData">Data da prova</label><input id="jData" type="text" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" value="${D.dataProva.split("-").reverse().join("/")}">
  <p class="sub">A data já vem com uma previsão. Quando sair o edital, é só colocar a data certa.</p>
  <button class="btn btn-pri btn-bloco" id="jSalvar" style="margin-top:12px">Salvar</button>
  <button class="btn btn-sec btn-bloco" id="jZerar" style="margin-top:10px">Começar do zero</button>`);
  $("#jData").oninput=e=>{let v=e.target.value.replace(/\D/g,"").slice(0,8);if(v.length>4)v=v.slice(0,2)+"/"+v.slice(2,4)+"/"+v.slice(4);else if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);e.target.value=v};
  $("#jSalvar").onclick=()=>{const m=$("#jData").value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return toast("Escreva a data assim: dd/mm/aaaa");
    const nv=$("#jObj").value;D.nome=$("#jNome").value.trim();if(nv!==D.objetivo){D.objetivo=nv}D.dataProva=`${m[3]}-${m[2]}-${m[1]}`;salvar();fecharModal();toast("Ajustes salvos ✅");render()};
  $("#jZerar").onclick=()=>{if(!confirm("Apagar todos os pontos e o progresso deste celular?"))return;D=novo();salvar();fecharModal();ir("inicio")};
}

/* ---------- instalar ---------- */
let pedidoInstalar=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();pedidoInstalar=e});
const instalado=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone;
if(instalado())$("#btnInstalar").classList.add("oculto");
window.addEventListener("appinstalled",()=>{$("#btnInstalar").classList.add("oculto");toast("Aprova Fácil instalado! 🎉")});
$("#btnInstalar").onclick=()=>{
  if(pedidoInstalar){pedidoInstalar.prompt();pedidoInstalar.userChoice.finally(()=>pedidoInstalar=null);return}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  abrirModal(`<h3>⬇️ Instalar o Aprova Fácil</h3>${ios?`<p>No iPhone, pelo Safari:</p><ol><li>Toque em <b>Compartilhar</b> (quadrado com seta para cima).</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol>`:`<p>No Android, pelo Chrome:</p><ol><li>Toque nos <b>três pontinhos ⋮</b> no canto de cima.</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme em <b>Instalar</b>.</li></ol>`}<button class="btn btn-pri btn-bloco" onclick="fecharModal()">Entendi</button>`);
};
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));

/* ---------- abertura ---------- */
(function(){const i=$("#intro");if(!i)return;
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches){i.remove();return}
  setTimeout(()=>i.classList.add("passo2"),1500);setTimeout(()=>i.classList.add("fim"),2700);setTimeout(()=>i.remove(),3400);})();

render();
