(() => {
  'use strict';
  const cloud=window.AutoescolaCloud;
  const login=document.getElementById('login-screen');
  const app=document.getElementById('app-layout');
  const form=document.getElementById('login-form');
  const username=document.getElementById('login-username');
  const password=document.getElementById('login-password');
  const submit=document.getElementById('login-submit');
  const error=document.getElementById('login-error');
  const toggle=document.getElementById('toggle-password');
  function showSession(active) {
    app.hidden=!active;
    login.hidden=active;
    document.body.classList.toggle('login-mode',!active);
    if(active) {
      error.textContent='';
      password.value='';
      password.type='password';
      toggle.textContent='Mostrar';
      toggle.setAttribute('aria-label','Mostrar senha');
    }
  }
  async function connected() {
    const data=await cloud.call('read');
    showSession(true);
    document.dispatchEvent(new CustomEvent('autoescola:connected',{detail:data}));
    document.getElementById('main-content').focus();
  }
  showSession(false);
  if(cloud.getToken()) {
    error.textContent='Verificando acesso à nuvem…';
    (async()=> {
      try {
        await cloud.call('session');
        await connected();
      } catch(err) {
        if(err.status===401) {
          cloud.setToken('');
          error.textContent='Sua sessão expirou. Entre novamente.';
        } else {
          error.textContent='Sem conexão com a nuvem. Atualize a página quando a internet voltar.';
        }
        showSession(false);
      }
    })();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(submit.disabled)return;
    error.textContent='';
    submit.disabled=true;
    submit.textContent='Conectando…';
    try {
      const result=await cloud.call('login',{
        username:username.value.trim().toLowerCase(),
        password:password.value
      });
      if(!result.token)throw new Error('O servidor não confirmou o acesso');
      cloud.setToken(result.token);
      await connected();
    } catch(err) {
      if(err.status===401) cloud.setToken('');
      error.textContent=err.status===401?'Usuário ou senha incorretos. Confira e tente novamente.':
        'Falha de conexão com o banco online: '+err.message;
      password.focus();
    } finally {
      submit.disabled=false;
      submit.textContent='Entrar no sistema';
    }
  });
  toggle.addEventListener('click',()=>{
    const visible=password.type==='password';
    password.type=visible?'text':'password';
    toggle.textContent=visible?'Ocultar':'Mostrar';
    toggle.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');
  });
  document.getElementById('logout-app').addEventListener('click',async()=>{
    if(window.AutoescolaApp?.hasPending() &&
      !confirm('Há alterações ainda não sincronizadas com a nuvem. Quer sair mesmo assim?'))return;
    try{await cloud.call('logout');}catch(_){}
    cloud.setToken('');
    document.dispatchEvent(new Event('autoescola:disconnected'));
    document.getElementById('modal-root').innerHTML='';
    document.getElementById('toast-root').innerHTML='';
    form.reset();
    showSession(false);
    username.focus();
  });
})();
