(() => {
  'use strict';
  // Public URL only. Password and service-role credentials never appear here.
  const API='https://rmhimlyrbkjzuoqjlpkw.supabase.co/functions/v1/autoescola-gateway';
  const KEY='autoescola_cloud_session_v2';
  let token='';
  try { token=sessionStorage.getItem(KEY)||''; } catch (_) {}
  async function call(action, args={}) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const headers={'Content-Type':'application/json'};
      if(token) headers.Authorization='Bearer '+token;
      const response=await fetch(API,{method:'POST',mode:'cors',cache:'no-store',headers,
        body:JSON.stringify({action,...args}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        const error=new Error(data.error||'Falha de comunicação com a nuvem');
        error.status=response.status;
        throw error;
      }
      return data;
    } finally { clearTimeout(timeout); }
  }
  function setToken(value){
    token=String(value||'');
    try { if(token) sessionStorage.setItem(KEY,token); else sessionStorage.removeItem(KEY); } catch (_) {}
  }
  window.AutoescolaCloud=Object.freeze({call,setToken,getToken:()=>token,endpoint:API});
})();
