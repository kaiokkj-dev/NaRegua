let stylesLoaded=false;
function ensureStyles(){if(stylesLoaded)return;stylesLoaded=true;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/ui-feedback.css';document.head.append(link);}

export function confirmAction({title='Confirmar ação',message,confirmLabel='Confirmar',cancelLabel='Voltar',danger=false}={}){
  ensureStyles();
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='nr-confirm-dialog';
    dialog.innerHTML=`<form method="dialog"><div class="nr-confirm-mark ${danger?'danger':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v5M12 17h.01"/><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/></svg></div><div class="nr-confirm-copy"><small>CONFIRMAÇÃO</small><h2></h2><p></p></div><div class="nr-confirm-actions"><button value="cancel" class="nr-confirm-back"></button><button value="confirm" class="nr-confirm-submit ${danger?'danger':''}"></button></div></form>`;
    dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=message||'';dialog.querySelector('.nr-confirm-back').textContent=cancelLabel;dialog.querySelector('.nr-confirm-submit').textContent=confirmLabel;
    const finish=value=>{resolve(value==='confirm');dialog.remove();};dialog.addEventListener('close',()=>finish(dialog.returnValue),{once:true});dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('cancel')});document.body.append(dialog);dialog.showModal();
  });
}

export function showToast(message,type='error'){
  ensureStyles();document.querySelector('.nr-toast')?.remove();const toast=document.createElement('div');toast.className=`nr-toast ${type}`;toast.setAttribute('role','status');toast.textContent=message;document.body.append(toast);requestAnimationFrame(()=>toast.classList.add('visible'));setTimeout(()=>{toast.classList.remove('visible');setTimeout(()=>toast.remove(),220)},3800);
}
