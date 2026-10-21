(() => {
  'use strict';
  const buttons=[...document.querySelectorAll('[data-install-app]')];
  const guide=document.getElementById('install-guide');
  const platform=document.getElementById('install-platform');
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let installPrompt=null;
  function update(){buttons.forEach(button=>button.hidden=standalone());}
  update();
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();installPrompt=event;update();
  });
  window.addEventListener('appinstalled',()=>{installPrompt=null;buttons.forEach(button=>button.hidden=true);});
  async function requestInstall(){
    if(installPrompt){
      const prompt=installPrompt;installPrompt=null;
      try{await prompt.prompt();await prompt.userChoice;return;}catch{/* Show browser instructions below. */}
    }
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    platform.textContent=ios?'No iPhone ou iPad, abra no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. Confirme em Adicionar.':/Android/i.test(navigator.userAgent)?'No Android, abra no Chrome, toque no menu ⋮ e escolha Instalar app ou Adicionar à tela inicial.':'No computador, abra no Chrome ou Edge e use o ícone de instalação na barra de endereços ou a opção de instalar este site no menu do navegador.';
    guide.showModal();
  }
  buttons.forEach(button=>button.addEventListener('click',requestInstall));
  document.getElementById('close-install-guide').addEventListener('click',()=>guide.close());
  guide.addEventListener('click',event=>{if(event.target===guide)guide.close();});
  if('serviceWorker' in navigator&&window.isSecureContext){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(error=>console.warn('Não foi possível ativar o modo offline.',error));
    });
  }
})();
