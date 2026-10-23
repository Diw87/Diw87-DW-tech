/* Autoescola Vale do Pindaré — Sistema de gestão local, sem bibliotecas externas.
   Dados de exemplo são fictícios. Não armazene dados pessoais reais em computadores compartilhados.
*/
(() => {
  'use strict';
  const KEY = 'autoescola_vale_pindare_v1';
  const $ = (selector, base = document) => base.querySelector(selector);
  const $$ = (selector, base = document) => [...base.querySelectorAll(selector)];
  const main = $('#main-content');
  const modalRoot = $('#modal-root');
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escapeHTML = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const today = () => { const d = new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateAdd = (days) => {const d = new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const monthsAgo = (m, day=10) => {const d = new Date();d.setDate(1);d.setMonth(d.getMonth()-m);d.setDate(day);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const dateBR = s => {if (!s) return '—'; const [y,m,d] = s.slice(0,10).split('-');return y&&m&&d ? `${d}/${m}/${y}` : s;};
  const monthLabel = s => new Date(`${s}-01T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
  const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(n)||0);
  const num = n => new Intl.NumberFormat('pt-BR').format(n || 0);
  const sum = (arr, k = 'amount') => arr.reduce((s,x)=> s+(Number(x[k])||0),0);
  const digits = s => String(s||'').replace(/\D/g,'');
  const moneyInput = n => Number(n||0).toFixed(2);
  const initials = name => String(name||'A').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const student = i => state.students.find(x => x.id === i);
  const enrollment = i => state.enrollments.find(x => x.id === i);
  const teacher = i => state.instructors.find(x => x.id === i);
  const vehicle = i => state.vehicles.find(x => x.id === i);
  const nameOf = i => student(i)?.name || 'Aluno não localizado';
  const paidStatus = p => p.status === 'Pago' ? 'Pago' : p.dueDate && p.dueDate < today() ? 'Atrasado' : 'Pendente';
  const tone = s => ({Ativo:'success',Concluído:'success',Concluída:'success',Realizada:'success',Pago:'success',Agendada:'blue',Agendado:'blue',Confirmada:'blue',Em_andamento:'blue',Pendente:'warn',Atrasado:'danger',Cancelada:'danger',Cancelado:'danger',Trancada:'neutral',Inativo:'neutral',Não_realizada:'danger'})[String(s).replaceAll(' ','_')] || 'neutral';
  const pill = s => `<span class="pill ${tone(s)}">${escapeHTML(s)}</span>`;
  const blank = () => ({version:1,demo:false,students:[],enrollments:[],lessons:[],payments:[],instructors:[],vehicles:[],settings:{name:'Autoescola Vale do Pindaré',phone:'',email:'',address:'',city:'',manager:''}});
  // This one-time reset was explicitly requested by the school owner.
  // Keep this marker unchanged in future releases to preserve new registrations.
  const CLEAN_START_KEY='autoescola_vale_pindare_clean_start';
  const CLEAN_START_VERSION='20261021-zerar-registros-v1';

  function normalize(o){
    if(!o || typeof o!=='object'|| !Array.isArray(o.students)) throw Error('Estrutura de cadastros inválida');
    const b=blank();
    for(const k of ['students','enrollments','lessons','payments','instructors','vehicles']) b[k]=Array.isArray(o[k])?o[k]:[];
    b.settings={...b.settings,...(o.settings||{})};
    b.demo=Boolean(o.demo);
    return b;
  }
  const cloud=window.AutoescolaCloud;
  const collections=['students','enrollments','lessons','payments','instructors','vehicles'];
  const deepCopy=value=>JSON.parse(JSON.stringify(value));
  let state=blank(),view='dashboard',filters={query:'',status:''},chartRange='6';
  let tracked=deepCopy(state),pending=[],sending=false,syncReady=false,checking=false;
  let localSnapshot=null,lastSyncError='',lastRemoteRevision=0;
  function statusCloud(message,type='ok'){
    const el=document.getElementById('cloud-status');
    if(!el)return;
    el.textContent=message;
    el.className='cloud-status '+type;
    el.title=type==='error'?'Conexão falhou: dados pendentes NÃO estão salvos na nuvem.':message;
  }
  function diffStates(before,after){
    const ops=[];
    for(const key of collections){
      const a=new Map(before[key].map(x=>[x.id,x]));
      const b=new Map(after[key].map(x=>[x.id,x]));
      for(const [ident,item] of b)if(JSON.stringify(a.get(ident))!==JSON.stringify(item))
        ops.push({type:'put',key,id:ident,value:deepCopy(item)});
      for(const ident of a.keys())if(!b.has(ident))ops.push({type:'delete',key,id:ident});
    }
    const settingChanges={};
    for(const [key,value] of Object.entries(after.settings||{}))
      if(JSON.stringify(before.settings?.[key])!==JSON.stringify(value))
        settingChanges[key]=value;
    if(Object.keys(settingChanges).length)ops.push({type:'settings',values:settingChanges});
    return ops;
  }
  function applyOperations(remote,ops){
    const result=deepCopy(remote);
    for(const op of ops){
      if(op.type==='settings'){result.settings={...result.settings,...op.values};continue;}
      if(!collections.includes(op.key))continue;
      const records=result[op.key];
      const ix=records.findIndex(x=>x.id===op.id);
      if(op.type==='delete'){if(ix>=0)records.splice(ix,1);}
      if(op.type==='put'){if(ix>=0)records[ix]=deepCopy(op.value);else records.push(deepCopy(op.value));}
    }
    result.demo=false;
    return result;
  }
  function save(){
    if(!syncReady || !cloud.getToken()){
      toast('Sem acesso à nuvem. Faça login novamente antes de salvar.',true);
      return false;
    }
    const operations=diffStates(tracked,state);
    tracked=deepCopy(state);
    if(!operations.length)return true;
    pending.push(...operations);
    statusCloud('Enviando '+pending.length+' alteração(ões)…','pending');
    void flush();
    return true;
  }
  async function flush(){
    if(sending||!syncReady||!cloud.getToken()||pending.length===0)return;
    sending=true;
    while(pending.length&&syncReady&&cloud.getToken()){
      const batch=pending.splice(0);
      let done=false;
      try{
        for(let attempt=0;attempt<6;attempt++){
          const remote=await cloud.call('read');
          const latest=remote.exists?normalize(remote.payload):blank();
          const merged=applyOperations(latest,batch);
          try{
            const stored=await cloud.call('save',{payload:merged,expected_revision:Number(remote.revision)||0});
            lastRemoteRevision=Number(stored.revision)||0;
            state=applyOperations(merged,pending);
            tracked=deepCopy(state);
            lastSyncError='';
            statusCloud(pending.length?'Sincronizando…':'Sincronizado na nuvem',pending.length?'pending':'ok');
            if(syncReady)render();
            done=true;
            break;
          }catch(err){
            if(err.status===409)continue;
            throw err;
          }
        }
        if(!done)throw Error('Outro aparelho alterou os dados. Tente novamente.');
      }catch(err){
        pending.unshift(...batch);
        lastSyncError=err.message||'Conexão indisponível';
        statusCloud('Não sincronizado · '+pending.length+' pendente(s)','error');
        toast('Não foi possível salvar na nuvem. Não feche o programa até reconectar.',true);
        break;
      }
    }
    sending=false;
  }
  async function pollCloud(){
    if(!syncReady||!cloud.getToken()||pending.length||sending||checking)return;
    checking=true;
    try{
      const remote=await cloud.call('read');
      const revision=Number(remote.revision)||0;
      if(revision!==lastRemoteRevision){
        const latest=remote.exists?normalize(remote.payload):blank();
        state=latest;
        tracked=deepCopy(latest);
        lastRemoteRevision=revision;
        render();
      }
      lastSyncError='';
      statusCloud('Sincronizado na nuvem','ok');
    }catch(err){
      lastSyncError=err.message||'Sem internet';
      statusCloud('Sem conexão · tente atualizar','error');
    }finally{checking=false;}
  }
  function oldLocalSnapshot(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw)return null;
      const o=normalize(JSON.parse(raw));
      const count=collections.reduce((sum,key)=>sum+o[key].length,0);
      return count?o:null;
    }catch(_){return null;}
  }
  function importPreviousLocal(){
    if(!syncReady)return;
    const old=oldLocalSnapshot();
    if(!old){toast('Não encontrei cadastros antigos neste navegador.',true);return;}
    const amounts=collections.map(k=>old[k].length).join(', ');
    if(!confirm('Importar os cadastros deste aparelho para a nuvem?\n\nDados encontrados (alunos, matrículas, aulas, pagamentos, instrutores, veículos): '+amounts+'.\n\nOs registros já existentes na nuvem serão preservados.'))return;
    for(const key of collections){
      const known=new Set(state[key].map(x=>x.id));
      for(const item of old[key])if(!known.has(item.id)){state[key].push(deepCopy(item));known.add(item.id);}
    }
    for(const [k,v] of Object.entries(old.settings||{}))if(!state.settings[k])state.settings[k]=v;
    state.demo=false;
    if(save()){closeModal();page('dashboard');toast('Importação enviada para sincronização. Confira o indicador no topo.');}
  }
  document.addEventListener('autoescola:connected',event=>{
    const remote=event.detail;
    state=remote?.exists?normalize(remote.payload):blank();
    tracked=deepCopy(state);
    lastRemoteRevision=Number(remote?.revision)||0;
    pending=[];sending=false;syncReady=true;
    statusCloud('Sincronizado na nuvem','ok');
    page('dashboard');
    localSnapshot=oldLocalSnapshot();
    if(localSnapshot&&!remote?.exists){
      setTimeout(()=>{
        if(!syncReady)return;
        const old=oldLocalSnapshot();
        if(!old)return;
        modal('Cadastros antigos encontrados',
          '<div class="modal-body"><p>Este navegador contém cadastros da versão antiga. Eles NÃO foram apagados.</p><p style="margin-top:12px">Importe-os para a nuvem para que também apareçam no celular. Isso não apagará cadastros online.</p></div>',
          btn('Agora não','close-modal')+btn('Importar para a nuvem','import-local','btn-primary'));
      },150);
    }
  });
  document.addEventListener('autoescola:disconnected',()=>{
    syncReady=false;pending=[];lastRemoteRevision=0;
    state=blank();tracked=deepCopy(state);
    statusCloud('Desconectado','error');
  });
  window.AutoescolaApp=Object.freeze({hasPending:()=>sending||pending.length>0});
  setInterval(()=>{if(pending.length)void flush();else void pollCloud();},8000);
  window.addEventListener('online',()=>{if(pending.length)void flush();else void pollCloud();});
  window.addEventListener('beforeunload',event=>{
    if(syncReady&&(sending||pending.length)){
      event.preventDefault();
      event.returnValue='';
    }
  });
  const actions = {
    dashboard: ['Visão geral','Acompanhe os resultados e a rotina da sua autoescola.','home'],
    students: ['Alunos','Cadastre, encontre e acompanhe seus alunos.','users'],
    enrollments: ['Matrículas','Gerencie serviços, categorias e andamento dos processos.','id'],
    lessons: ['Aulas e agenda','Organize as aulas práticas e teóricas.','calendar'],
    finance: ['Financeiro','Controle parcelas, recebimentos e pendências.','wallet'],
    reports: ['Relatórios','Analise indicadores e exporte os registros.','chart'],
    settings: ['Configurações','Personalize a escola e gerencie os dados online.','settings']
  };
  const btn = (text,action,variant='btn-light',additional='')=> `<button type="button" class="btn ${variant}" data-action="${action}" ${additional}>${text}</button>`;
  const head = (v, actionsHTML='') => `<div class="page-head"><div><div class="eyebrow">AUTOESCOLA VALE DO PINDARÉ</div><h1>${actions[v][0]}</h1><p class="subhead">${actions[v][1]}</p></div>${actionsHTML?`<div class="head-actions">${actionsHTML}</div>`:''}</div>`;
  const searchBox = placeholder => `<label class="search-box">${icon('search')}<input id="table-search" type="search" placeholder="${placeholder}" autocomplete="off" value="${escapeHTML(filters.query)}" aria-label="Pesquisar"></label>`;
  const statusSelect = options => `<select class="select-input filter" id="status-filter" aria-label="Filtrar por situação"><option value="">Todas as situações</option>${options.map(x=>`<option value="${escapeHTML(x)}" ${filters.status===x?'selected':''}>${escapeHTML(x)}</option>`).join('')}</select>`;
  const table = (ths, trs, emptyText='Nenhum registro encontrado.') => `<div class="table-scroll"><table class="data-table"><thead><tr>${ths.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${trs || `<tr><td colspan="${ths.length}">${empty('search',emptyText,true)}</td></tr>`}</tbody></table></div>`;
  const empty = (symbol,title,compact=false,desc='') => `<div class="empty-state ${compact?'compact':''}">${icon(symbol)}<h3>${escapeHTML(title)}</h3>${desc?`<p>${escapeHTML(desc)}</p>`:''}</div>`;
  const detailValue = (label,value) => `<div class="detail-item"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value??'—')||'—'}</strong></div>`;
  const safePhoto = value => typeof value==='string' && value.length<=300000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
  const studentAvatar = (s,big=false) => safePhoto(s.photo) ? `<div class="${big?'big-avatar':'mini-avatar'} has-photo"><img src="${safePhoto(s.photo)}" alt="Foto de ${escapeHTML(s.name)}"></div>` : big ? `<div class="big-avatar">${icon('users')}</div>` : avatar(s.name);
  function photoEditor(x){const photo=safePhoto(x.photo);return `<div class="photo-editor"><div id="student-photo-preview" class="photo-preview">${photo?`<img src="${photo}" alt="Foto do aluno">`:icon('users')}</div><div class="photo-controls"><label for="student-photo-file">Foto do aluno</label><input id="student-photo-file" type="file" accept="image/jpeg,image/png,image/webp"><input id="f-photo" type="hidden" name="photo" value="${photo}"><small>Selecione uma foto JPG, PNG ou WebP (até 12 MB). A imagem será reduzida para o cadastro.</small>${btn('Remover foto','remove-student-photo','btn-light btn-small')}</div></div>`;}
  async function loadStudentPhoto(input){
    const form=input.closest('form'),file=input.files?.[0];if(!form||!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024){toast('Escolha uma foto JPG, PNG ou WebP de até 12 MB.',true);input.value='';return;}
    const token=String(Number(form.dataset.photoRequest||0)+1);form.dataset.photoRequest=token;
    const submit=$('button[type="submit"]',form);submit.disabled=true;
    const url=URL.createObjectURL(file);
    try{
      const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Foto inválida'));img.src=url;});
      if(!image.naturalWidth||!image.naturalHeight)throw Error('Foto inválida');
      const scale=Math.min(1,480/image.naturalWidth,640/image.naturalHeight),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Sem suporte a imagem');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let photo=canvas.toDataURL('image/jpeg',.85);if(photo.length>240000)photo=canvas.toDataURL('image/jpeg',.6);if(!safePhoto(photo))throw Error('Foto muito grande');
      if(!form.isConnected||form.dataset.photoRequest!==token)return;
      $('[name="photo"]',form).value=photo;$('#student-photo-preview',form).innerHTML=`<img src="${photo}" alt="Foto do aluno">`;
    }catch(e){if(form.isConnected&&form.dataset.photoRequest===token)toast('Não foi possível abrir esta foto. Tente outra imagem.',true);}
    finally{URL.revokeObjectURL(url);if(form.dataset.photoRequest===token)submit.disabled=false;}
  }
  const avatar = (name,alt=false) => `<div class="mini-avatar ${alt?'alt':''}">${escapeHTML(initials(name))}</div>`;
  const rowActions = (entity,key) => `<div class="table-actions">${entity==='student'?`<button class="icon-button" type="button" title="Imprimir ficha" aria-label="Imprimir ficha" data-action="print-student" data-id="${escapeHTML(key)}">${icon('print')}</button>`:''}<button class="icon-button" type="button" title="Visualizar" aria-label="Visualizar" data-action="detail" data-entity="${entity}" data-id="${escapeHTML(key)}">${icon('eye')}</button><button class="icon-button" type="button" title="Editar" aria-label="Editar" data-action="edit" data-entity="${entity}" data-id="${escapeHTML(key)}">${icon('edit')}</button><button class="icon-button danger" type="button" title="Excluir" aria-label="Excluir" data-action="delete" data-entity="${entity}" data-id="${escapeHTML(key)}">${icon('trash')}</button></div>`;
  const matching = (text) => String(text||'').toLocaleLowerCase('pt-BR').includes(filters.query.toLocaleLowerCase('pt-BR').trim());
  const filterList = (arr, matchingFn, statusFn) => arr.filter(x=>(!filters.query || matchingFn(x)) && (!filters.status || statusFn(x)===filters.status));
  const isEmpty = s => !s || String(s).trim()==='';
  function page(v){view=v;filters={query:'',status:''};render();$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#breadcrumb-page').textContent=actions[v][0];$('#sidebar').classList.remove('open');$('#mobile-shade').classList.remove('show');window.scrollTo(0,0);}
  function render(){
    main.innerHTML = ({dashboard:renderDashboard,students:renderStudents,enrollments:renderEnrollments,lessons:renderLessons,finance:renderFinance,reports:renderReports,settings:renderSettings})[view]();
  }
  function demoBanner(){return state.demo?`<div class="banner-demo">${icon('info')}<div><strong>Modo demonstração</strong> — Os registros exibidos são inteiramente fictícios. Você pode testar o sistema, limpar os exemplos ou começar do zero.</div><button type="button" data-action="clear-demo">Começar do zero</button></div>`:'';}
  function metric(label,value,description,symbol,color){return `<div class="metric"><div class="metric-header"><span class="metric-label">${label}</span><div class="metric-icon ${color}">${icon(symbol)}</div></div><div class="metric-value">${value}</div><div class="metric-desc">${description}</div></div>`;}
  function chartSVG(){
    const n=Number(chartRange),months=Array.from({length:n},(_,i)=>monthsAgo(n-i-1,1).slice(0,7));
    const vals=months.map(m=>state.enrollments.filter(x=>x.startDate?.startsWith(m)).length);
    const max=Math.max(3,...vals), W=640,H=205,base=173,top=22,step=W/n,barW=Math.min(48,step*.48);
    const lines=[0,1,2,3].map(i=>{const yy=base-i*(base-top)/3;return `<line class="gridline" x1="43" y1="${yy}" x2="625" y2="${yy}"/><text x="31" y="${yy+4}" text-anchor="end">${Math.round(i*max/3)}</text>`;}).join('');
    const bars=vals.map((v,i)=>{const x=43+(i+.5)*(W-60)/n, bh=Math.max(v?5:2,v/max*(base-top));return `<rect class="bar" x="${x-barW/2}" y="${base-bh}" width="${barW}" height="${bh}" rx="5"><title>${monthLabel(months[i])}: ${v} matrícula(s)</title></rect><text x="${x}" y="${base-bh-9}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:#76561a">${v||''}</text><text x="${x}" y="${base+19}" text-anchor="middle">${monthLabel(months[i])}</text>`;}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gráfico de matrículas nos últimos ${n} meses">${lines}${bars}</svg>`;
  }
  function renderDashboard(){
    const active=state.enrollments.filter(x=>x.status==='Em andamento').length;
    const pending=state.payments.filter(x=>paidStatus(x)!=='Pago');
    const received=state.payments.filter(x=>x.status==='Pago' && (x.paidDate||'').startsWith(today().slice(0,7)));
    const lessons=state.lessons.filter(x=>x.status==='Agendada' && `${x.date}T${x.time||'00:00'}`>=`${today()}T00:00`).sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)).slice(0,5);
    const latest=[...state.students].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5);
    const categoryCounts=['A','B','AB','C','D','E'].map(c=>({name:c,qty:state.enrollments.filter(x=>x.category===c).length})).filter(x=>x.qty);
    const totalC=Math.max(1,state.enrollments.length);
    return head('dashboard',btn(`${icon('plus')} Novo aluno`,'add-student','btn-primary')+btn(`${icon('calendar')} Agendar aula`,'add-lesson'))+demoBanner()+
      `<div class="metrics-grid">${metric('Alunos cadastrados',num(state.students.length),'Total de pessoas registradas','users','blue')}${metric('Matrículas em andamento',num(active),'Processos ativos','id','gold')}${metric('Recebido neste mês',money(sum(received)),'Pagamentos registrados','wallet','green')}${metric('Valores pendentes',money(sum(pending)),'A receber e em atraso','alert','red')}</div>`+
      `<div class="grid-dash"><section class="panel"><div class="panel-head"><div><h2>Evolução de matrículas</h2><p>Novos processos registrados por mês</p></div><select id="chart-range" class="select-input filter" aria-label="Período do gráfico"><option value="6" ${chartRange==='6'?'selected':''}>Últimos 6 meses</option><option value="12" ${chartRange==='12'?'selected':''}>Últimos 12 meses</option></select></div><div class="panel-body"><div class="chart-wrap">${chartSVG()}</div><div class="chart-legend"><span class="legend-dot"></span> Novas matrículas</div></div></section><section class="panel"><div class="panel-head"><div><h2>Categorias de habilitação</h2><p>Distribuição das matrículas</p></div></div><div class="panel-body"><div class="stat-lines">${categoryCounts.length? categoryCounts.map((c,i)=>`<div><div class="stat-line-top"><span>Categoria ${c.name}</span><strong>${c.qty} <span class="text-muted">(${Math.round(c.qty/totalC*100)}%)</span></strong></div><div class="track ${['','blue','green','red'][i%4]}"><div style="width:${c.qty/totalC*100}%"></div></div></div>`).join(''):empty('id','Sem matrículas',true)}<div class="stat-foot">${num(state.enrollments.length)} matrícula(s) registradas no total</div></div></div></section></div>`+
      `<div class="grid-dash"><section class="panel"><div class="panel-head"><div><h2>Próximas aulas</h2><p>Compromissos agendados</p></div><button class="panel-action" data-view="lessons">Ver agenda completa →</button></div><div class="panel-body"><div class="upcoming">${lessons.length?lessons.map(l=>`<div class="upcoming-item"><div class="date-tile"><strong>${l.date.slice(8,10)}</strong><small>${monthLabel(l.date.slice(0,7))}</small></div><div><div class="upcoming-title">${escapeHTML(nameOf(l.studentId))}</div><div class="upcoming-sub">${escapeHTML(l.kind)} · ${escapeHTML(teacher(l.instructorId)?.name||'Sem instrutor')}</div></div><span class="upcoming-time">${escapeHTML(l.time)}</span></div>`).join(''):empty('calendar','Nenhuma aula futura agendada',true)}</div></div></section><section class="panel"><div class="panel-head"><div><h2>Alunos recentes</h2><p>Últimos cadastros</p></div><button class="panel-action" data-view="students">Ver todos →</button></div><div class="panel-body"><div class="upcoming">${latest.length?latest.map(s=>`<div class="upcoming-item">${studentAvatar(s)}<div><div class="upcoming-title">${escapeHTML(s.name)}</div><div class="upcoming-sub">${escapeHTML(s.phone||'Sem telefone')}</div></div><small class="upcoming-time">${dateBR(s.createdAt)}</small></div>`).join(''):empty('users','Nenhum aluno cadastrado',true)}</div></div></section></div>`+
      `<div class="quick-actions">${btn(`${icon('plus')} Nova matrícula`,'add-enrollment')}${btn(`${icon('wallet')} Lançar pagamento`,'add-payment')}${btn(`${icon('download')} Fazer backup`,'export-json')}</div>`;
  }
  function renderStudents(){const list=filterList(state.students,s=>matching(`${s.name} ${s.cpf} ${s.phone} ${s.email}`),()=> '');const trs=list.map(s=>{
    const m=state.enrollments.filter(x=>x.studentId===s.id), last=m[m.length-1];
    return `<tr><td><div class="person-cell">${studentAvatar(s)}<div class="main-cell">${escapeHTML(s.name)}<div class="small-sub">${escapeHTML(s.email||'Sem e-mail')}</div></div></div></td><td>${escapeHTML(s.cpf||'—')}</td><td>${escapeHTML(s.phone||'—')}</td><td>${last?`Cat. ${escapeHTML(last.category)}`:'—'}</td><td>${last?pill(last.status):pill('Sem matrícula')}</td><td>${dateBR(s.createdAt)}</td><td>${rowActions('student',s.id)}</td></tr>`;
  }).join('');return head('students',btn(`${icon('download')} Exportar CSV`,'csv-students')+btn(`${icon('plus')} Novo aluno`,'add-student','btn-primary'))+demoBanner()+`<section class="table-panel"><div class="table-tools">${searchBox('Nome, CPF, telefone ou e-mail...')}<span class="table-meta">${list.length} de ${state.students.length} aluno(s)</span></div>${table(['Aluno','CPF','Telefone','Categoria','Situação','Cadastro','Ações'],trs,'Nenhum aluno corresponde à pesquisa.')}<div class="table-bottom">Os cadastros ficam salvos somente neste navegador.</div></section>`;}
  function renderEnrollments(){const list=filterList(state.enrollments,x=>matching(`${nameOf(x.studentId)} ${x.category} ${x.service}`),x=>x.status).slice().sort((a,b)=>b.startDate.localeCompare(a.startDate));const trs=list.map(x=>`<tr><td><div class="main-cell">${escapeHTML(nameOf(x.studentId))}<div class="small-sub">${escapeHTML(x.service)}</div></div></td><td><strong>Categoria ${escapeHTML(x.category)}</strong></td><td>${dateBR(x.startDate)}</td><td>${money(x.price)}</td><td>${pill(x.status)}</td><td>${rowActions('enrollment',x.id)}</td></tr>`).join('');return head('enrollments',btn(`${icon('plus')} Nova matrícula`,'add-enrollment','btn-primary'))+demoBanner()+`<div class="section-cards"><div class="mini-card"><div class="accent"></div><div class="label">Total de matrículas</div><div class="amount">${num(state.enrollments.length)}</div><div class="hint">Todos os processos</div></div><div class="mini-card green"><div class="accent"></div><div class="label">Em andamento</div><div class="amount">${num(state.enrollments.filter(x=>x.status==='Em andamento').length)}</div><div class="hint">Matrículas ativas</div></div><div class="mini-card red"><div class="accent"></div><div class="label">Concluídas</div><div class="amount">${num(state.enrollments.filter(x=>x.status==='Concluído').length)}</div><div class="hint">Processos finalizados</div></div></div><section class="table-panel"><div class="table-tools">${searchBox('Pesquisar por aluno, serviço ou categoria...')}${statusSelect(['Em andamento','Concluído','Trancada','Cancelada'])}<span class="table-meta">${list.length} registro(s)</span></div>${table(['Aluno / serviço','Categoria','Início','Valor acordado','Situação','Ações'],trs)}</section>`;}
  function renderLessons(){const list=filterList(state.lessons,x=>matching(`${nameOf(x.studentId)} ${teacher(x.instructorId)?.name||''} ${x.kind} ${vehicle(x.vehicleId)?.plate||''}`),x=>x.status).slice().sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));const trs=list.map(x=>`<tr><td class="main-cell">${dateBR(x.date)}<div class="small-sub">${escapeHTML(x.time)} · ${escapeHTML(x.duration||50)} min</div></td><td><div class="main-cell">${escapeHTML(nameOf(x.studentId))}</div></td><td>${escapeHTML(x.kind)}</td><td>${escapeHTML(teacher(x.instructorId)?.name||'Não definido')}</td><td>${escapeHTML(vehicle(x.vehicleId)?.model||'—')}<div class="small-sub">${escapeHTML(vehicle(x.vehicleId)?.plate||'')}</div></td><td>${pill(x.status)}</td><td>${rowActions('lesson',x.id)}</td></tr>`).join('');return head('lessons',btn(`${icon('plus')} Agendar aula`,'add-lesson','btn-primary'))+demoBanner()+`<div class="section-cards"><div class="mini-card"><div class="accent"></div><div class="label">Total de aulas</div><div class="amount">${num(state.lessons.length)}</div><div class="hint">Agendadas e realizadas</div></div><div class="mini-card green"><div class="accent"></div><div class="label">Aulas realizadas</div><div class="amount">${num(state.lessons.filter(x=>x.status==='Realizada').length)}</div><div class="hint">Concluídas</div></div><div class="mini-card"><div class="accent"></div><div class="label">Agendamentos futuros</div><div class="amount">${num(state.lessons.filter(x=>x.status==='Agendada'&&x.date>=today()).length)}</div><div class="hint">A partir de hoje</div></div></div><section class="table-panel"><div class="table-tools">${searchBox('Pesquisar aluno, instrutor ou veículo...')}${statusSelect(['Agendada','Realizada','Cancelada','Não realizada'])}<span class="table-meta">${list.length} aula(s)</span></div>${table(['Data / horário','Aluno','Tipo','Instrutor','Veículo','Situação','Ações'],trs)}</section>`;}
  function renderFinance(){const pending=state.payments.filter(x=>paidStatus(x)!=='Pago'), paid=state.payments.filter(x=>x.status==='Pago');const late=state.payments.filter(x=>paidStatus(x)==='Atrasado');const list=filterList(state.payments,x=>matching(`${nameOf(x.studentId)} ${x.description} ${x.method||''}`),paidStatus).slice().sort((a,b)=>b.dueDate.localeCompare(a.dueDate));const trs=list.map(x=>`<tr><td><div class="main-cell">${escapeHTML(nameOf(x.studentId))}</div><div class="small-sub">${escapeHTML(x.description)}</div></td><td>${x.installmentsTotal?`${escapeHTML(x.installmentNumber||1)} de ${escapeHTML(x.installmentsTotal)}`:'Não informado'}</td><td class="strong mono">${money(x.amount)}</td><td>${dateBR(x.dueDate)}</td><td>${paidStatus(x)==='Pago'?dateBR(x.paidDate):'—'}</td><td>${pill(paidStatus(x))}</td><td>${paidStatus(x)!=='Pago'?btn(`${icon('check')} Receber`,'receive-payment','btn-light btn-small',`data-id="${escapeHTML(x.id)}"`):`<span class="text-muted">${escapeHTML(x.method||'—')}</span>`}</td><td>${rowActions('payment',x.id)}</td></tr>`).join('');return head('finance',btn(`${icon('download')} Exportar CSV`,'csv-finance')+btn(`${icon('plus')} Novo parcelamento`,'add-payment','btn-primary'))+demoBanner()+`<div class="section-cards"><div class="mini-card green"><div class="accent"></div><div class="label">Total recebido</div><div class="amount">${money(sum(paid))}</div><div class="hint">Todos os pagamentos</div></div><div class="mini-card"><div class="accent"></div><div class="label">A receber</div><div class="amount">${money(sum(pending))}</div><div class="hint">Valores pendentes</div></div><div class="mini-card red"><div class="accent"></div><div class="label">Em atraso</div><div class="amount">${money(sum(late))}</div><div class="hint">Parcelas vencidas</div></div></div><section class="table-panel"><div class="table-tools">${searchBox('Pesquisar aluno ou descrição...')}${statusSelect(['Pago','Pendente','Atrasado'])}<span class="table-meta">${list.length} lançamento(s)</span></div>${table(['Aluno / descrição','Número de parcelas','Valor','Vencimento','Recebimento','Situação','Receber','Ações'],trs)}</section>`;}
  function renderReports(){const total=state.enrollments.length, done=state.enrollments.filter(x=>x.status==='Concluído').length, receivables=state.payments.filter(x=>paidStatus(x)!=='Pago');const totals=[['Alunos cadastrados',state.students.length],['Matrículas abertas',total],['Matrículas concluídas',done],['Percentual de conclusão',total?Math.round(done/total*100)+'%':'0%'],['Aulas realizadas',state.lessons.filter(x=>x.status==='Realizada').length],['Aulas agendadas',state.lessons.filter(x=>x.status==='Agendada').length]];const financial=[['Valor total contratado',money(sum(state.enrollments,'price'))],['Recebimentos confirmados',money(sum(state.payments.filter(p=>p.status==='Pago')))],['Pagamentos pendentes',money(sum(receivables))],['Pagamentos vencidos',money(sum(state.payments.filter(p=>paidStatus(p)==='Atrasado')))],['Lançamentos financeiros',state.payments.length]];return head('reports',btn(`${icon('print')} Imprimir`,'print')+btn(`${icon('download')} Backup completo`,'export-json','btn-primary'))+demoBanner()+`<div class="reports-summary"><section class="panel"><div class="panel-head"><div><h2>Indicadores operacionais</h2><p>Resumo geral dos cadastros</p></div></div><div class="report-rows">${totals.map(x=>`<div class="report-row"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><h2>Resumo financeiro</h2><p>Valores dos lançamentos registrados</p></div></div><div class="report-rows">${financial.map(x=>`<div class="report-row"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div></section></div><section class="panel"><div class="panel-head"><div><h2>Matrículas por categoria</h2><p>Distribuição de todas as categorias</p></div></div><div class="panel-body">${['A','B','AB','C','D','E'].map(c=>{const v=state.enrollments.filter(x=>x.category===c).length;return `<div class="report-category"><strong>Categoria ${c}</strong><div class="track"><div style="width:${total?v/total*100:0}%"></div></div><small>${v}</small></div>`;}).join('')}</div></section><div class="quick-actions">${btn(`${icon('download')} Exportar alunos`,'csv-students')}${btn(`${icon('download')} Exportar matrículas`,'csv-enrollments')}${btn(`${icon('download')} Exportar aulas`,'csv-lessons')}${btn(`${icon('download')} Exportar financeiro`,'csv-finance')}</div>`;}
  function renderSettings(){return head('settings')+demoBanner()+`<div class="settings-grid"><section class="panel settings-panel"><h2>Dados da autoescola</h2><p class="subhead">Informações exibidas na gestão e nos relatórios.</p><form id="settings-form"><div class="form-grid">${field('Nome da autoescola','name',state.settings.name,{required:true,span:true})}${field('Responsável','manager',state.settings.manager)}${field('Telefone','phone',state.settings.phone,{type:'tel'})}${field('E-mail','email',state.settings.email,{type:'email'})}${field('Cidade / UF','city',state.settings.city)}${field('Endereço','address',state.settings.address,{span:true})}</div><div class="quick-actions"><button type="submit" class="btn btn-primary">${icon('check')} Salvar alterações</button></div></form></section><section class="panel settings-panel"><h2>Nuvem, backup e segurança</h2><p class="subhead">Os dados são compartilhados entre notebook e celular. Guarde também um backup periódico.</p><div class="quick-actions">${btn(`${icon('download')} Baixar backup JSON`,'export-json','btn-primary')}${btn(`${icon('upload')} Restaurar backup`,'import-json')+btn(`${icon('upload')} Importar cadastros antigos deste aparelho`,'import-local')}</div><hr class="setting-divider"><h3>Cadastros auxiliares</h3><p class="subhead">Instrutores e veículos usados no agendamento.</p><div class="quick-actions">${btn(`${icon('plus')} Novo instrutor`,'add-instructor')}${btn(`${icon('plus')} Novo veículo`,'add-vehicle')}</div><div class="danger-zone"><h3>Apagar registros da nuvem</h3><p>Apaga permanentemente os cadastros de TODOS os aparelhos. Faça um backup antes de continuar.</p>${btn(`${icon('trash')} Apagar todos os dados`,'wipe','btn-danger')}</div></section></div><div class="reports-summary" style="margin-top:19px"><section class="panel"><div class="panel-head"><div><h2>Instrutores</h2><p>${state.instructors.length} cadastrado(s)</p></div></div><div class="panel-body"><div class="small-list">${state.instructors.length?state.instructors.map(i=>`<div class="small-list-item"><div><strong>${escapeHTML(i.name)}</strong><div><small>Categoria ${escapeHTML(i.category||'—')} · ${i.active!==false?'Ativo':'Inativo'}</small></div></div>${rowActions('instructor',i.id)}</div>`).join(''):empty('users','Nenhum instrutor',true)}</div></div></section><section class="panel"><div class="panel-head"><div><h2>Veículos</h2><p>${state.vehicles.length} cadastrado(s)</p></div></div><div class="panel-body"><div class="small-list">${state.vehicles.length?state.vehicles.map(v=>`<div class="small-list-item"><div><strong>${escapeHTML(v.model)}</strong><div><small>${escapeHTML(v.plate||'Sem placa')} · Categoria ${escapeHTML(v.category||'—')} · ${v.active!==false?'Ativo':'Inativo'}</small></div></div>${rowActions('vehicle',v.id)}</div>`).join(''):empty('car','Nenhum veículo',true)}</div></div></section></div><div class="info-strip" style="margin-top:18px">${icon('alert')} Os cadastros são salvos no Supabase e sincronizados automaticamente entre aparelhos, com acesso administrativo. É necessário internet para salvar alterações. O backup JSON continua disponível.</div>`;}
  function field(label,name,val='',options={}){const {required=false,type='text',span=false,placeholder='',textarea=false,options:opts=null,min='',max='',note='',step='any',readonly=false}=options;const attrs=`name="${name}" id="f-${name}" ${required?'required':''} ${readonly?'readonly':''} ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''}`;let input=opts?`<select class="select-input" ${attrs}>${opts.map(x=>{const key=Array.isArray(x)?x[0]:x, txt=Array.isArray(x)?x[1]:x;return `<option value="${escapeHTML(key)}" ${String(val)===String(key)?'selected':''}>${escapeHTML(txt)}</option>`;}).join('')}</select>`:textarea?`<textarea class="text-area" ${attrs} placeholder="${escapeHTML(placeholder)}">${escapeHTML(val)}</textarea>`:`<input class="${type==='date'?'date-input':'text-input'}" type="${type}" ${attrs} value="${escapeHTML(val)}" placeholder="${escapeHTML(placeholder)}" ${type==='number'?'step="${escapeHTML(step)}"':''}>`;return `<div class="field ${span?'span-2':''}"><label for="f-${name}">${escapeHTML(label)}${required?'<span class="required"> *</span>':''}</label>${input}${note?`<small class="field-note">${note}</small>`:''}</div>`;}
  const optionStudents = (current='') => [['','Selecione o aluno...'],...state.students.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x=>[x.id,x.name])];
  const optionEnrollments = (studentId='',current='') => [['','Nenhuma / não vincular'],...state.enrollments.filter(x=>!studentId||x.studentId===studentId).map(x=>[x.id,`${nameOf(x.studentId)} — Cat. ${x.category}`])];
  const optionTeacher = () => [['','Não definido'],...state.instructors.map(x=>[x.id,`${x.name}${x.active===false?' (inativo)':''}`])];
  const optionVehicle = () => [['','Não definido'],...state.vehicles.map(x=>[x.id,`${x.model} • ${x.plate||'sem placa'}`])];
  const forms = {
    student:x=>`${photoEditor(x)}<div class="modal-section-title">Dados pessoais</div><div class="form-grid">${field('Nome completo','name',x.name,{required:true,span:true,placeholder:'Nome do aluno'})}${field('CPF','cpf',x.cpf,{placeholder:'000.000.000-00',note:'CPF opcional nesta demonstração'})}${field('Data de nascimento','birth',x.birth,{type:'date'})}${field('Telefone / WhatsApp','phone',x.phone,{type:'tel',required:true,placeholder:'(99) 99999-9999'})}${field('E-mail','email',x.email,{type:'email'})}${field('Endereço','address',x.address,{span:true})}${field('Bairro','neighborhood',x.neighborhood)}${field('Cidade / UF','city',x.city)}${field('Observações','notes',x.notes,{textarea:true,span:true})}</div>`,
    enrollment:x=>`<div class="modal-section-title">Dados da matrícula</div><div class="form-grid">${field('Aluno','studentId',x.studentId,{options:optionStudents(),required:true,span:true})}${field('Serviço','service',x.service||'Primeira habilitação',{options:['Primeira habilitação','Adição de categoria','Mudança de categoria','Renovação de CNH','Reciclagem','Aulas avulsas','Outro']})}${field('Categoria','category',x.category||'B',{options:['A','B','AB','C','D','E','AC','AD','AE']})}${field('Data da matrícula','startDate',x.startDate||today(),{type:'date',required:true})}${field('Valor contratado (R$)','price',x.price||0,{type:'number',required:true,min:0})}${field('Situação','status',x.status||'Em andamento',{options:['Em andamento','Concluído','Trancada','Cancelada']})}</div>`,
    lesson:x=>`<div class="modal-section-title">Detalhes da aula</div><div class="form-grid">${field('Aluno','studentId',x.studentId,{options:optionStudents(),required:true,span:true})}${field('Matrícula','enrollmentId',x.enrollmentId,{options:optionEnrollments()})}${field('Tipo','kind',x.kind||'Prática',{options:['Prática','Teórica','Simulado','Reforço']})}${field('Data','date',x.date||today(),{type:'date',required:true})}${field('Horário','time',x.time||'08:00',{type:'time',required:true})}${field('Duração em minutos','duration',x.duration||50,{type:'number',required:true,min:15,max:360})}${field('Instrutor','instructorId',x.instructorId,{options:optionTeacher()})}${field('Veículo','vehicleId',x.vehicleId,{options:optionVehicle()})}${field('Situação','status',x.status||'Agendada',{options:['Agendada','Realizada','Cancelada','Não realizada']})}${field('Observações','notes',x.notes,{textarea:true,span:true})}</div>`,
    payment:x=>`<div class="modal-section-title">Dados do lançamento</div><div class="form-grid">${field('Aluno','studentId',x.studentId,{options:optionStudents(),required:true,span:true})}${field('Matrícula','enrollmentId',x.enrollmentId,{options:optionEnrollments()})}${field('Número de parcelas','installments',x.installmentsTotal||1,{type:'number',required:true,min:1,max:120,step:1,readonly:Boolean(x.installmentGroupId),note:x.installmentGroupId?`Parcela ${Number(x.installmentNumber)||1} de ${Number(x.installmentsTotal)||1}. O plano já está gerado; esta edição altera somente a cobrança selecionada.`:'Informe a quantidade de parcelas. O valor abaixo é de cada parcela; os vencimentos são mensais.'})}${x.id?field('Descrição','description',x.description||'Parcela do curso',{required:true}):''}${field(x.id?'Valor (R$)':'Valor de cada parcela (R$)','amount',x.amount||0,{type:'number',required:true,min:0.01})}${field(x.id?'Vencimento':'Primeiro vencimento','dueDate',x.dueDate||today(),{type:'date',required:true})}${field('Situação','status',x.status||'Pendente',{options:['Pendente','Pago']})}${field('Data do pagamento','paidDate',x.paidDate,{type:'date'})}${field('Forma de pagamento','method',x.method,{options:['','PIX','Dinheiro','Cartão de crédito','Cartão de débito','Boleto','Transferência','Outro']})}${field('Observações','notes',x.notes,{textarea:true,span:true})}</div>`,
    instructor:x=>`<div class="modal-section-title">Dados do instrutor</div><div class="form-grid">${field('Nome completo','name',x.name,{span:true,required:true})}${field('Telefone','phone',x.phone,{type:'tel'})}${field('Categorias','category',x.category||'B',{options:['A','B','A / B','C','D','E','Todas']})}${field('Situação','active',String(x.active!==false),{options:[['true','Ativo'],['false','Inativo']]})}</div>`,
    vehicle:x=>`<div class="modal-section-title">Dados do veículo</div><div class="form-grid">${field('Modelo / identificação','model',x.model,{required:true,span:true})}${field('Placa','plate',x.plate,{required:true,placeholder:'ABC1D23'})}${field('Categoria','category',x.category||'B',{options:['A','B','C','D','E']})}${field('Situação','active',String(x.active!==false),{options:[['true','Ativo'],['false','Inativo']]})}</div>`
  };
  const collection = {student:'students',enrollment:'enrollments',lesson:'lessons',payment:'payments',instructor:'instructors',vehicle:'vehicles'};
  const entityNames = {student:'aluno',enrollment:'matrícula',lesson:'aula',payment:'lançamento',instructor:'instrutor',vehicle:'veículo'};
  function modal(title,body,buttons='',wide=false,subtitle=''){modalRoot.innerHTML=`<div class="modal-overlay" id="modal-overlay"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-top"><div><h2 id="modal-title">${escapeHTML(title)}</h2>${subtitle?`<p>${escapeHTML(subtitle)}</p>`:''}</div><button class="icon-button" type="button" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>${body}${buttons?`<div class="modal-bottom">${buttons}</div>`:''}</div></div>`;$('.modal button,.modal input,.modal select',modalRoot)?.focus();}
  function closeModal(){modalRoot.innerHTML='';}
  function openForm(entity, itemId=''){
    if (['enrollment','lesson','payment'].includes(entity) && !state.students.length){toast('Cadastre um aluno antes de continuar.',true);openForm('student');return;}
    const existing=itemId ? state[collection[entity]].find(x=>x.id===itemId) : null;
    if(itemId && !existing){toast('Registro não encontrado.',true);return;}
    const x= existing || {};
    const title=`${existing?'Editar':(['enrollment','lesson'].includes(entity)?'Nova':'Novo')} ${entityNames[entity]}`;
    modal(title,`<form id="entity-form" data-entity="${entity}" data-id="${escapeHTML(itemId)}"><div class="modal-body">${forms[entity](x)}</div><div class="modal-bottom"><button type="button" class="btn btn-light" data-action="close-modal">Cancelar</button><button type="submit" class="btn btn-primary">${icon('check')} Salvar ${entityNames[entity]}</button></div></form>`,'',true,'Preencha as informações e confirme para salvar.');
    $('#f-cpf')?.addEventListener('input',e=>{const p=digits(e.target.value).slice(0,11);e.target.value=p.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');});
    const f=$('#entity-form');if(f && ['lesson','payment'].includes(entity)){const st=$('[name=studentId]',f),en=$('[name=enrollmentId]',f);if(st && en){const saved=x.enrollmentId||'';function sync(){en.innerHTML=optionEnrollments(st.value).map(([k,t])=>`<option value="${escapeHTML(k)}" ${k===saved?'selected':''}>${escapeHTML(t)}</option>`).join('');if(saved&&!en.value)en.value='';}st.addEventListener('change',sync);sync();}}
  }
  function validCPF(cpf){const s=digits(cpf);if(!s)return true;if(s.length!==11||/^(\d)\1+$/.test(s))return false;const digit=(length)=>{const total=s.slice(0,length).split('').reduce((acc,d,i)=>acc+Number(d)*(length+1-i),0);return ((total*10)%11)%10;};return digit(9)===Number(s[9])&&digit(10)===Number(s[10]);}
  function buildPaymentPlan(data,total,firstId=''){
    const group=id(),{installments,id:previousId,...base}=data;
    return Array.from({length:total},(_,index)=>{
      const [year,month,day]=data.dueDate.split('-').map(Number),date=new Date(year,month-1+index,1,12);
      const lastDay=new Date(date.getFullYear(),date.getMonth()+1,0,12).getDate();date.setDate(Math.min(day,lastDay));
      const dueDate=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const description=total===1&&base.description?base.description:base.description&&!/^Parcela(?: \d+ de \d+)? do curso$/.test(base.description)?`${base.description} — ${index+1} de ${total}`:`Parcela ${index+1} de ${total} do curso`;
      return {...base,id:index===0&&firstId?firstId:id(),description,installmentNumber:index+1,installmentsTotal:total,installmentGroupId:group,dueDate,status:index===0?data.status:'Pendente',paidDate:index===0?data.paidDate:'',method:index===0?data.method:''};
    });
  }
  function submitEntity(form){const type=form.dataset.entity,oldId=form.dataset.id;const data=Object.fromEntries(new FormData(form).entries());for(const k in data)data[k]=String(data[k]).trim();
    if(type==='student'){if(form.dataset.photoRequest && $('button[type="submit"]',form)?.disabled){toast('Aguarde a foto terminar de carregar.',true);return;}data.photo=safePhoto(data.photo);if(data.cpf && !validCPF(data.cpf)){toast('CPF inválido. Corrija o número ou deixe em branco.',true);return;}if(data.cpf && state.students.some(s=>s.id!==oldId&&digits(s.cpf)===digits(data.cpf))){toast('Este CPF já está cadastrado.',true);return;}data.createdAt=oldId?state.students.find(x=>x.id===oldId)?.createdAt:today();}
    if(type==='enrollment')data.price=Math.round(Number(data.price)*100)/100;
    if(type==='payment'){data.amount=Math.round(Number(data.amount)*100)/100;if(!Number.isFinite(data.amount)||data.amount<=0){toast('Informe um valor de parcela maior que zero.',true);return;}if(!oldId||!state.payments.find(p=>p.id===oldId)?.installmentGroupId){data.installments=Number(data.installments||1);if(!Number.isInteger(data.installments)||data.installments<1||data.installments>120){toast('Informe um número inteiro de parcelas entre 1 e 120.',true);return;}if(!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)||Number.isNaN(new Date(data.dueDate+'T12:00:00').getTime())){toast('Informe o primeiro vencimento.',true);return;}}if(data.status==='Pago'&&!data.paidDate)data.paidDate=today();if(data.status==='Pendente')data.paidDate='';}
    if(type==='lesson'){
      data.duration=Number(data.duration);
      const currentFrom=data.date+'T'+data.time;
      const now=new Date(currentFrom+':00');
      const conflict=state.lessons.find(l=>l.id!==oldId && l.date===data.date && !['Cancelada','Não realizada'].includes(l.status) && !['Cancelada','Não realizada'].includes(data.status) && (()=>{const start=new Date(l.date+'T'+l.time+':00');const end=new Date(start.getTime()+Number(l.duration||50)*60000);const newEnd=new Date(now.getTime()+data.duration*60000);return now<end && newEnd>start && ((data.instructorId && data.instructorId===l.instructorId)||(data.vehicleId && data.vehicleId===l.vehicleId));})());
      if(conflict){toast('Conflito de horário: instrutor ou veículo já utilizado neste período.',true);return;}
    }
    if(['instructor','vehicle'].includes(type))data.active=data.active==='true';
    if(type==='vehicle'&&state.vehicles.some(v=>v.id!==oldId && v.plate && v.plate.toLowerCase()===data.plate.toLowerCase())){toast('Já existe um veículo com essa placa.',true);return;}
    if(['enrollment','lesson','payment'].includes(type)&&!student(data.studentId)){toast('Selecione um aluno válido.',true);return;}
    if((type==='lesson'||type==='payment')&&data.enrollmentId && enrollment(data.enrollmentId)?.studentId!==data.studentId){toast('A matrícula selecionada não pertence a este aluno.',true);return;}
    const previous=JSON.stringify(state),items=state[collection[type]];
    if(oldId){
      const i=items.findIndex(x=>x.id===oldId);if(i<0)return;
      if(type==='payment'&&!items[i].installmentGroupId&&data.installments>=1){
        const plan=buildPaymentPlan({...items[i],...data},data.installments,oldId);items[i]=plan[0];items.push(...plan.slice(1));
      }else{
        if(type==='payment')delete data.installments;
        items[i]={...items[i],...data};
      }
    }else if(type==='payment'){items.push(...buildPaymentPlan(data,data.installments));}
    else items.push({id:id(),...data});
    state.demo=false; if(save()){closeModal();render();toast(`${entityNames[type][0].toUpperCase()+entityNames[type].slice(1)} ${oldId?'alterado(a)':'cadastrado(a)'}. Enviando à nuvem…`);}else{state=JSON.parse(previous);}
  }
  function showDetail(entity,itemId){const x=state[collection[entity]].find(s=>s.id===itemId);if(!x)return;
    const fields={
      student:[['Nome completo',x.name],['CPF',x.cpf],['Telefone',x.phone],['E-mail',x.email],['Nascimento',dateBR(x.birth)],['Cidade',x.city],['Bairro',x.neighborhood],['Endereço',x.address],['Cadastro',dateBR(x.createdAt)],['Observações',x.notes]],
      enrollment:[['Aluno',nameOf(x.studentId)],['Serviço',x.service],['Categoria',x.category],['Data da matrícula',dateBR(x.startDate)],['Valor',money(x.price)],['Situação',x.status]],
      lesson:[['Aluno',nameOf(x.studentId)],['Tipo',x.kind],['Data',dateBR(x.date)],['Horário',x.time],['Duração',(x.duration||50)+' minutos'],['Instrutor',teacher(x.instructorId)?.name],['Veículo',vehicle(x.vehicleId)?.model],['Situação',x.status],['Observações',x.notes]],
      payment:[['Aluno',nameOf(x.studentId)],['Descrição',x.description],['Número de parcelas',x.installmentsTotal||'Não informado'],['Parcela atual',x.installmentNumber||'—'],['Valor',money(x.amount)],['Vencimento',dateBR(x.dueDate)],['Data do pagamento',dateBR(x.paidDate)],['Forma de pagamento',x.method],['Situação',paidStatus(x)],['Observações',x.notes]],
      instructor:[['Nome',x.name],['Telefone',x.phone],['Categorias',x.category],['Situação',x.active===false?'Inativo':'Ativo']],
      vehicle:[['Modelo',x.model],['Placa',x.plate],['Categoria',x.category],['Situação',x.active===false?'Inativo':'Ativo']]
    };
    const rows=fields[entity].map(([a,b])=>detailValue(a,b)).join('');let extra='';
    if(entity==='student'){
      const relatedE=state.enrollments.filter(e=>e.studentId===x.id), relatedL=state.lessons.filter(l=>l.studentId===x.id), relatedP=state.payments.filter(p=>p.studentId===x.id);
      extra=`<div class="detail-section"><h3>Histórico do aluno</h3><div class="detail-log"><div class="detail-log-item"><span>Matrículas cadastradas</span><strong>${relatedE.length}</strong></div><div class="detail-log-item"><span>Aulas registradas</span><strong>${relatedL.length}</strong></div><div class="detail-log-item"><span>Valor recebido</span><strong>${money(sum(relatedP.filter(p=>p.status==='Pago')))}</strong></div><div class="detail-log-item"><span>Saldo em aberto</span><strong>${money(sum(relatedP.filter(p=>paidStatus(p)!=='Pago')))}</strong></div></div></div>`;
    }
    modal(`Detalhes do ${entityNames[entity]}`,`<div class="modal-body"><div class="detail-header">${entity==='student'?studentAvatar(x,true):`<div class="big-avatar">${icon(entity==='vehicle'?'car':entity==='payment'?'wallet':'users')}</div>`}<div><h2>${escapeHTML(entity==='student'?x.name:entity==='enrollment'?nameOf(x.studentId):entity==='lesson'?nameOf(x.studentId):entity==='payment'?x.description:entity==='vehicle'?x.model:x.name)}</h2><p>Registro da autoescola</p></div></div><div class="detail-grid">${rows}</div>${extra}</div>`,`${btn('Fechar','close-modal')}${entity==='student'?btn(`${icon('print')} Imprimir ficha`,'print-student','btn-light',`data-id="${escapeHTML(x.id)}"`):''}${btn(`${icon('edit')} Editar`,'edit','btn-primary',`data-entity="${entity}" data-id="${escapeHTML(x.id)}"`)}`,true);
  }
  function deleteEntity(type,itemId){const x=state[collection[type]].find(i=>i.id===itemId);if(!x)return;
    if(type==='student' && (state.enrollments.some(e=>e.studentId===itemId)||state.lessons.some(e=>e.studentId===itemId)||state.payments.some(e=>e.studentId===itemId))){toast('Este aluno tem matrícula, aula ou pagamento vinculado. Exclua os registros relacionados primeiro.',true);return;}
    if(type==='enrollment'&&(state.lessons.some(e=>e.enrollmentId===itemId)||state.payments.some(e=>e.enrollmentId===itemId))){toast('Esta matrícula possui aulas ou pagamentos vinculados. Exclua-os primeiro.',true);return;}
    if(type==='instructor'&&state.lessons.some(e=>e.instructorId===itemId)){toast('Este instrutor está associado a aulas. Edite as aulas antes de excluí-lo.',true);return;}
    if(type==='vehicle'&&state.lessons.some(e=>e.vehicleId===itemId)){toast('Este veículo está associado a aulas. Edite as aulas antes de excluí-lo.',true);return;}
    modal('Confirmar exclusão',`<div class="modal-body"><div class="info-strip">${icon('alert')} Essa operação não pode ser desfeita. Faça um backup se necessário.</div><p>Deseja realmente excluir este ${entityNames[type]}?</p></div>`,`${btn('Cancelar','close-modal')}${btn(`${icon('trash')} Excluir definitivamente`,'confirm-delete','btn-danger',`data-entity="${type}" data-id="${escapeHTML(itemId)}"`)}`);
  }
  function toast(message,error=false){let root=$('#toast-root');root.innerHTML=`<div class="toast ${error?'error':''}">${icon(error?'alert':'check')}<span>${escapeHTML(message)}</span></div>`;clearTimeout(toast._timer);toast._timer=setTimeout(()=>{root.innerHTML='';},4100);}
  function downloadFile(name,content,mime){const blob=new Blob([content],{type:mime}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);}
  function exportJSON(){downloadFile(`backup-autoescola-vale-do-pindare-${today()}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json;charset=utf-8');toast('Backup completo exportado. Guarde-o em local seguro.');}
  function exportCSV(category){let rows=[],filename='';
    if(category==='students'){filename='alunos';rows=[['Nome','CPF','Telefone','E-mail','Nascimento','Bairro','Cidade','Endereço','Cadastro','Observações'],...state.students.map(x=>[x.name,x.cpf,x.phone,x.email,dateBR(x.birth),x.neighborhood,x.city,x.address,dateBR(x.createdAt),x.notes])];}
    if(category==='enrollments'){filename='matriculas';rows=[['Aluno','Serviço','Categoria','Data','Valor','Situação'],...state.enrollments.map(x=>[nameOf(x.studentId),x.service,x.category,dateBR(x.startDate),x.price,x.status])];}
    if(category==='lessons'){filename='aulas';rows=[['Aluno','Tipo','Data','Horário','Duração(min)','Instrutor','Veículo','Situação'],...state.lessons.map(x=>[nameOf(x.studentId),x.kind,dateBR(x.date),x.time,x.duration,teacher(x.instructorId)?.name,vehicle(x.vehicleId)?.model,x.status])];}
    if(category==='finance'){filename='financeiro';rows=[['Aluno','Descrição','Valor','Vencimento','Pagamento','Forma','Situação'],...state.payments.map(x=>[nameOf(x.studentId),x.description,x.amount,dateBR(x.dueDate),dateBR(x.paidDate),x.method,paidStatus(x)])];}
    const safeCell=v=>{let str=String(v??'');if(/^[\s]*[=+@\-]/.test(str) && isNaN(Number(str)))str="'"+str;return `"${str.replaceAll('"','""')}"`;};
    downloadFile(`${filename}-vale-do-pindare-${today()}.csv`,'\ufeff'+rows.map(row=>row.map(safeCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');toast('Planilha CSV exportada com sucesso!');
  }
  function importJSON(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const raw=JSON.parse(reader.result);const next=normalize(raw);if(!confirm('Restaurar este backup? Ele substituirá TODOS os dados da autoescola na NUVEM e em todos os aparelhos.'))return;state=next;state.demo=false;save();closeModal();page('dashboard');toast('Backup preparado para envio à nuvem. Confira o indicador no topo.');}catch(e){toast('Este arquivo não é um backup válido do sistema.',true);}};reader.readAsText(file);}
  function confirmation(action){if(action==='clear-demo'){modal('Começar do zero',`<div class="modal-body"><p>Isso apagará os exemplos fictícios e iniciará uma base vazia. Se você cadastrou alguma informação durante o teste, ela também será removida.</p></div>`,`${btn('Cancelar','close-modal')}${btn('Sim, começar do zero','confirm-wipe','btn-danger')}`);}else{modal('Apagar todos os dados',`<div class="modal-body"><p>Todos os alunos, matrículas, aulas, pagamentos, instrutores e veículos na nuvem serão apagados permanentemente, inclusive em outros aparelhos.</p><div class="info-strip" style="margin-top:16px">${icon('alert')} Faça um backup JSON antes se quiser conservar os dados.</div></div>`,`${btn('Cancelar','close-modal')}${btn('Sim, apagar tudo','confirm-wipe','btn-danger')}`);}}
  function receivePayment(itemId){const p=state.payments.find(x=>x.id===itemId);if(!p)return;modal('Confirmar recebimento',`<div class="modal-body"><p>Registrar recebimento de <strong>${money(p.amount)}</strong> de <strong>${escapeHTML(nameOf(p.studentId))}</strong>?</p><div class="form-grid" style="margin-top:19px">${field('Data do recebimento','paidDate',today(),{type:'date',required:true})}${field('Forma de pagamento','method','PIX',{options:['PIX','Dinheiro','Cartão de crédito','Cartão de débito','Boleto','Transferência','Outro']})}</div></div>`,`${btn('Cancelar','close-modal')}${btn(`${icon('check')} Confirmar recebimento`,'confirm-receive','btn-primary',`data-id="${escapeHTML(itemId)}"`)}`);}
  function printReport(){const win=window.open('','_blank');if(!win){toast('Autorize janelas pop-up para imprimir.',true);return;}const d=new Date().toLocaleString('pt-BR');const rows=[['Alunos',state.students.length],['Matrículas',state.enrollments.length],['Em andamento',state.enrollments.filter(x=>x.status==='Em andamento').length],['Aulas agendadas',state.lessons.filter(x=>x.status==='Agendada').length],['Aulas realizadas',state.lessons.filter(x=>x.status==='Realizada').length],['Total recebido',money(sum(state.payments.filter(x=>x.status==='Pago')))],['Total em aberto',money(sum(state.payments.filter(x=>paidStatus(x)!=='Pago')))]];
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - Vale do Pindaré</title><style>body{font:15px Arial,sans-serif;max-width:760px;margin:32px auto;color:#233044}header{border-bottom:3px solid #e9b12a;padding:12px 0 20px;margin-bottom:24px}h1{margin:0;font-size:25px}p{color:#687684}table{width:100%;border-collapse:collapse}td{padding:13px;border-bottom:1px solid #e5e7eb}td:last-child{text-align:right;font-weight:bold}footer{margin-top:26px;color:#8b96a4;font-size:12px}</style></head><body><header><h1>Autoescola Vale do Pindaré</h1><p>Relatório gerencial · ${escapeHTML(d)}</p></header><table>${rows.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><footer>Gerado pelo sistema de gestão local. ${state.demo?'Dados fictícios para demonstração.':''}</footer><script>window.onload=()=>window.print();<\/script></body></html>`);win.document.close();}
  function printStudent(itemId){
    const s=student(itemId);if(!s){toast('Aluno não encontrado.',true);return;}
    const win=window.open('','_blank');if(!win){toast('Autorize janelas pop-up para imprimir a ficha.',true);return;}
    const es=state.enrollments.filter(e=>e.studentId===s.id),ps=state.payments.filter(p=>p.studentId===s.id),settings=state.settings;
    const info=[['Nome completo',s.name],['CPF',s.cpf],['Data de nascimento',dateBR(s.birth)],['Telefone / WhatsApp',s.phone],['E-mail',s.email],['Endereço',s.address],['Bairro',s.neighborhood],['Cidade / UF',s.city],['Data de cadastro',dateBR(s.createdAt)]];
    const photo=safePhoto(s.photo),logo=$('.brand-logo')?.src||'';
    win.addEventListener('load',()=>{win.focus();win.print();},{once:true});
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ficha do aluno - ${escapeHTML(s.name)}</title><style>
      @page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#202c3d;margin:25px auto;max-width:760px;line-height:1.45}header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #efb627;padding-bottom:16px;margin-bottom:22px}header img{width:82px;height:82px;object-fit:contain}h1{font-size:21px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 12px;padding-bottom:6px;border-bottom:1px solid #dce1e8}p{margin:4px 0}.identity{display:flex;gap:24px;align-items:flex-start}.student-photo{width:90px;height:120px;border:1px solid #dce1e8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#8692a0;flex-shrink:0}.student-photo img{width:100%;height:100%;object-fit:cover;border-radius:5px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:13px 20px;flex:1;min-width:0}.field{break-inside:avoid;overflow-wrap:anywhere}.field:first-child{grid-column:1/-1}.field small{display:block;color:#667384;font-size:10px}.field strong{font-size:12px;font-weight:600}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px 7px;text-align:left;border-bottom:1px solid #dce1e8;overflow-wrap:anywhere}th{background:#f2f4f7}thead{display:table-header-group}tr{break-inside:avoid}.notes{white-space:pre-wrap;overflow-wrap:anywhere}.totals{display:flex;gap:25px;flex-wrap:wrap}.signatures{display:flex;gap:45px;margin-top:65px;break-inside:avoid}.signatures div{flex:1;border-top:1px solid #6b7480;text-align:center;padding-top:8px}footer{margin-top:25px;font-size:10px;color:#788493}.print-tools{margin-bottom:20px;text-align:right}.print-tools button{padding:9px 16px;cursor:pointer}@media print{body{margin:0;max-width:none}.print-tools{display:none}h2{break-after:avoid}}
    </style></head><body><div class="print-tools"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div><header>${logo?`<img src="${escapeHTML(logo)}" alt="Logo da autoescola">`:''}<div><h1>${escapeHTML(settings.name||'Autoescola Vale do Pindaré')}</h1><p>Ficha de cadastro do aluno</p>${[settings.address,settings.city,[settings.phone,settings.email].filter(Boolean).join(' · ')].filter(Boolean).map(v=>`<p>${escapeHTML(v)}</p>`).join('')}</div></header><div class="identity"><div class="fields">${info.map(([k,v])=>`<div class="field"><small>${escapeHTML(k)}</small><strong>${escapeHTML(v||'—')}</strong></div>`).join('')}</div><div class="student-photo">${photo?`<img src="${photo}" alt="Foto do aluno">`:'Sem foto'}</div></div><h2>Matrículas</h2>${es.length?`<table><thead><tr><th>Serviço / categoria</th><th>Data</th><th>Valor contratado</th><th>Situação</th></tr></thead><tbody>${es.map(e=>`<tr><td>${escapeHTML(e.service)} / ${escapeHTML(e.category)}</td><td>${escapeHTML(dateBR(e.startDate))}</td><td>${money(e.price)}</td><td>${escapeHTML(e.status||'—')}</td></tr>`).join('')}</tbody></table>`:'<p>Nenhuma matrícula cadastrada.</p>'}<h2>Resumo financeiro</h2><div class="totals"><p>Recebido: <strong>${money(sum(ps.filter(p=>p.status==='Pago')))}</strong></p><p>Em aberto: <strong>${money(sum(ps.filter(p=>paidStatus(p)!=='Pago')))}</strong></p></div>${ps.length?`<h2>Parcelas e pagamentos</h2><table><thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${ps.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(p=>`<tr><td>${escapeHTML(p.description)}</td><td>${escapeHTML(dateBR(p.dueDate))}</td><td>${money(p.amount)}</td><td>${escapeHTML(paidStatus(p))}</td></tr>`).join('')}</tbody></table>`:''}<h2>Observações</h2><p class="notes">${escapeHTML(s.notes||'—')}</p><div class="signatures"><div>Assinatura do aluno</div><div>Responsável pela autoescola</div></div><footer>Emitido em ${escapeHTML(new Date().toLocaleString('pt-BR'))}. ${state.demo?'Dados fictícios para demonstração.':''}</footer></body></html>`);
    win.document.close();
  }
  function execute(action,el){
    if(action==='print-student')return printStudent(el.dataset.id);
    if(action==='remove-student-photo'){const form=$('#entity-form');if(!form)return;form.dataset.photoRequest=String(Number(form.dataset.photoRequest||0)+1);$('[name="photo"]',form).value='';$('#student-photo-file',form).value='';$('#student-photo-preview',form).innerHTML=icon('users');$('button[type="submit"]',form).disabled=false;return;}

    if(action==='close-modal'){closeModal();return;}
    if(action==='add-student')return openForm('student');
    if(action==='add-enrollment')return openForm('enrollment');
    if(action==='add-lesson')return openForm('lesson');
    if(action==='add-payment')return openForm('payment');
    if(action==='add-instructor')return openForm('instructor');
    if(action==='add-vehicle')return openForm('vehicle');
    if(action==='edit')return openForm(el.dataset.entity,el.dataset.id);
    if(action==='detail')return showDetail(el.dataset.entity,el.dataset.id);
    if(action==='delete')return deleteEntity(el.dataset.entity,el.dataset.id);
    if(action==='confirm-delete'){const key=collection[el.dataset.entity];state[key]=state[key].filter(x=>x.id!==el.dataset.id);state.demo=false;save();closeModal();render();toast('Registro excluído.');return;}
    if(action==='receive-payment')return receivePayment(el.dataset.id);
    if(action==='confirm-receive'){const p=state.payments.find(x=>x.id===el.dataset.id);if(p){const dt=$('#f-paidDate')?.value,method=$('#f-method')?.value;if(!dt){toast('Informe a data de recebimento.',true);return;}p.paidDate=dt;p.status='Pago';p.method=method||'PIX';state.demo=false;save();closeModal();render();toast('Recebimento registrado. Aguarde a sincronização online.');}return;}
    if(action==='export-json')return exportJSON();
    if(action.startsWith('csv-'))return exportCSV(action.slice(4));
    if(action==='import-json'){$('#backup-file').click();return;}
    if(action==='import-local')return importPreviousLocal();
    if(action==='wipe'||action==='clear-demo')return confirmation(action);
    if(action==='confirm-wipe'){state=blank();save();closeModal();page('dashboard');toast('Exclusão enviada à nuvem. Confira o indicador de sincronização.');return;}
    if(action==='print')return printReport();
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view]');if(nav){page(nav.dataset.view);return;}
    const a=e.target.closest('[data-action]');if(a){execute(a.dataset.action,a);return;}
    if(e.target.id==='modal-overlay')closeModal();
  });
  document.addEventListener('submit',e=>{if(e.target.id==='entity-form'){e.preventDefault();submitEntity(e.target);}if(e.target.id==='settings-form'){e.preventDefault();state.settings=Object.fromEntries(new FormData(e.target).entries());save();toast('Configurações preparadas para sincronização.');}});
  document.addEventListener('input',e=>{if(e.target.id==='table-search'){const position=e.target.selectionStart;filters.query=e.target.value;render();const next=$('#table-search');if(next){next.focus();try{next.setSelectionRange(position,position);}catch(_){}}}});
  document.addEventListener('change',e=>{if(e.target.id==='student-photo-file'){loadStudentPhoto(e.target);return;}if(e.target.id==='status-filter'){filters.status=e.target.value;render();}if(e.target.id==='chart-range'){chartRange=e.target.value;render();}if(e.target.id==='backup-file')importJSON(e.target.files?.[0]);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal-overlay'))closeModal();});
  $('#mobile-menu').addEventListener('click',()=>{$('#sidebar').classList.toggle('open');$('#mobile-shade').classList.toggle('show');});
  $('#mobile-shade').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#mobile-shade').classList.remove('show');});
  $('#today-label').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('#foot-year').textContent=new Date().getFullYear();
  const backupInput=document.createElement('input');backupInput.type='file';backupInput.accept='.json,application/json';backupInput.id='backup-file';backupInput.hidden=true;document.body.appendChild(backupInput);
  page('dashboard');
})();

