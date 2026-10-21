(() => {
  'use strict';
  // This browser-local gate is not server authentication. Records remain local.
  const SESSION='dwtech_autoescola_session_v1';
  const EXPECTED='1450ee6c36aa19d66658d7ec543a27a25f86e7fcb3f950263661fb7cd91751df';
  const login=document.getElementById('login-screen');
  const app=document.getElementById('app-layout');
  const form=document.getElementById('login-form');
  const username=document.getElementById('login-username');
  const password=document.getElementById('login-password');
  const submit=document.getElementById('login-submit');
  const error=document.getElementById('login-error');
  const toggle=document.getElementById('toggle-password');
  function showSession(active){
    app.hidden=!active;login.hidden=active;
    if(active)document.body.classList.remove('login-mode');else document.body.classList.add('login-mode');
    error.textContent='';password.value='';password.type='password';
    toggle.setAttribute('aria-label','Mostrar senha');toggle.textContent='Mostrar';
  }
  let restored=false;
  try{restored=sessionStorage.getItem(SESSION)==='active';}catch{}
  showSession(restored);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(submit.disabled)return;
    error.textContent='';submit.disabled=true;submit.textContent='Entrando…';
    try{
      const input=new TextEncoder().encode(username.value.trim().toLowerCase()+'\0'+password.value);
      const buffer=await crypto.subtle.digest('SHA-256',input);
      const digest=Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(digest!==EXPECTED){error.textContent='Usuário ou senha incorretos. Tente novamente.';password.focus();return;}
      try{sessionStorage.setItem(SESSION,'active');}catch{}
      showSession(true);document.getElementById('main-content').focus();
    }catch{
      error.textContent='Abra o aplicativo pelo endereço HTTPS para entrar.';
    }finally{submit.disabled=false;submit.textContent='Entrar no sistema';}
  });
  toggle.addEventListener('click',()=>{
    const visible=password.type==='password';password.type=visible?'text':'password';
    toggle.textContent=visible?'Ocultar':'Mostrar';toggle.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');
  });
  document.getElementById('logout-app').addEventListener('click',()=>{
    try{sessionStorage.removeItem(SESSION);}catch{}
    document.getElementById('modal-root').innerHTML='';document.getElementById('toast-root').innerHTML='';
    form.reset();showSession(false);username.focus();
  });
})();
