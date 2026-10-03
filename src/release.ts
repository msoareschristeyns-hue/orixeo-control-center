import { createClient } from '@supabase/supabase-js';
import './release.css';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const apiBase=(import.meta.env.VITE_ORIXEO_API_URL||'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/,'');

async function token(){const {data}=await supabase.auth.getSession();return data.session?.access_token||null;}
async function call(path:string,options:any={}){
  const t=await token(); if(!t) throw new Error('Session expirée');
  const r=await fetch(apiBase+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+t,...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error||('Erreur '+r.status));
  return data;
}
function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string));}
function fmtBytes(v:any){const n=Number(v||0);if(!n)return '—';if(n<1024)return n+' o';if(n<1048576)return (n/1024).toFixed(1)+' Ko';if(n<1073741824)return (n/1048576).toFixed(1)+' Mo';return (n/1073741824).toFixed(1)+' Go';}

function render(data:any){
  const current=data.current_release||{}, backup=data.last_backup||{}, hb=data.heartbeat||{}, releases=data.releases||[], backups=data.backups||[];
  return `
    <div class="or-header"><div><small>ORIXEO LAB</small><h2>Release Center</h2><p>Versions, sauvegardes, santé et historique de déploiement</p></div><button id="or-close">×</button></div>
    <div class="or-kpis">
      <article><span>Version courante</span><b>${esc(current.version||hb.version||'—')}</b></article>
      <article><span>Commit</span><b>${current.git_sha?esc(String(current.git_sha).slice(0,8)):'—'}</b></article>
      <article><span>État</span><b>${esc(current.status||hb.status||'—')}</b></article>
      <article><span>Health</span><b>${current.health_ok===true?'OK':current.health_ok===false?'KO':'—'}</b></article>
      <article><span>Smoke tests</span><b>${current.smoke_ok===true?'OK':current.smoke_ok===false?'KO':'—'}</b></article>
      <article><span>Dernière sauvegarde</span><b>${backup.completed_at?new Date(backup.completed_at).toLocaleString('fr-FR'):'—'}</b></article>
    </div>
    <div class="or-grid">
      <section class="or-card">
        <h3>Service courant</h3>
        <div class="or-current">
          <div><span>Service</span><b>${esc(hb.service_name||'Orixeo API Gateway')}</b></div>
          <div><span>Statut</span><b>${esc(hb.status||'unknown')}</b></div>
          <div><span>Instance</span><b>${esc(hb.instance_id||'—')}</b></div>
          <div><span>Dernier heartbeat</span><b>${hb.last_seen_at?new Date(hb.last_seen_at).toLocaleString('fr-FR'):'—'}</b></div>
        </div>
        <p class="or-note">Les déploiements et rollbacks restent exécutés côté serveur via les scripts DevOps. Le navigateur n'obtient aucun accès shell.</p>
      </section>
      <section class="or-card">
        <h3>Sauvegarde la plus récente</h3>
        <div class="or-current">
          <div><span>Fichier</span><b>${esc(backup.file_name||'—')}</b></div>
          <div><span>Taille</span><b>${fmtBytes(backup.file_size_bytes)}</b></div>
          <div><span>Statut</span><b>${esc(backup.status||'—')}</b></div>
          <div><span>Rétention</span><b>${backup.retention_days?esc(backup.retention_days)+' jours':'—'}</b></div>
        </div>
        <code class="or-hash">${esc(backup.sha256||'Aucun checksum enregistré')}</code>
      </section>
    </div>
    <section class="or-card">
      <h3>Historique des releases</h3>
      <div class="or-table">
        <div class="or-row or-head"><span>Date</span><span>Action</span><span>Version</span><span>Commit</span><span>Statut</span><span>Health</span><span>Smoke</span><span>Déclenché par</span></div>
        ${releases.map((r:any)=>`<div class="or-row">
          <span>${new Date(r.started_at).toLocaleString('fr-FR')}</span>
          <span>${esc(r.action)}</span><span>${esc(r.version||'—')}</span><span><code>${esc(String(r.git_sha||'').slice(0,8))}</code></span>
          <span>${esc(r.status)}</span><span>${r.health_ok===true?'OK':r.health_ok===false?'KO':'—'}</span>
          <span>${r.smoke_ok===true?'OK':r.smoke_ok===false?'KO':'—'}</span><span>${esc(r.triggered_by||'—')}</span>
        </div>`).join('')||'<p class="or-empty">Aucune release historisée pour le moment.</p>'}
      </div>
    </section>
    <section class="or-card">
      <h3>Historique des sauvegardes</h3>
      <div class="or-table">
        <div class="or-row or-backup-head"><span>Date</span><span>Fichier</span><span>Taille</span><span>Statut</span><span>Rétention</span><span>SHA-256</span></div>
        ${backups.map((b:any)=>`<div class="or-row or-backup-row">
          <span>${new Date(b.created_at).toLocaleString('fr-FR')}</span><span>${esc(b.file_name)}</span><span>${fmtBytes(b.file_size_bytes)}</span>
          <span>${esc(b.status)}</span><span>${esc(b.retention_days)} j</span><span><code>${esc((b.sha256||'').slice(0,16))}${b.sha256?'…':''}</code></span>
        </div>`).join('')||'<p class="or-empty">Aucune sauvegarde historisée pour le moment.</p>'}
      </div>
    </section>`;
}

async function openRelease(){
  let overlay=document.getElementById('orixeo-release-overlay') as HTMLElement|null;
  if(!overlay){overlay=document.createElement('div');overlay.id='orixeo-release-overlay';overlay.className='or-overlay';overlay.innerHTML='<div class="or-shell"></div>';document.body.appendChild(overlay);}
  overlay.classList.add('open');
  const shell=overlay.querySelector('.or-shell') as HTMLElement;
  shell.innerHTML='<p class="or-empty">Chargement…</p>';
  try{
    const data=await call('/releases');
    shell.innerHTML=render(data);
    shell.querySelector('#or-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
  }catch(e:any){shell.innerHTML='<p class="or-error">'+esc(e?.message||e)+'</p>';}
}
function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-release-link')) return false;
  const a=document.createElement('a');a.id='orixeo-release-link';a.innerHTML='↻ <span>Release Center</span>';
  a.addEventListener('click',()=>void openRelease());nav.appendChild(a);return true;
}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
