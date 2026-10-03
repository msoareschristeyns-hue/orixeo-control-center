import { createClient } from '@supabase/supabase-js';
import './product-adoption.css';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const apiBase=(import.meta.env.VITE_ORIXEO_API_URL||'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/,'');

async function token(){const {data}=await supabase.auth.getSession();return data.session?.access_token||null;}
async function call(path:string){
  const t=await token(); if(!t) throw new Error('Session expirée');
  const r=await fetch(apiBase+path,{headers:{Authorization:'Bearer '+t}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error||('Erreur '+r.status));
  return data;
}
function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string));}

function render(data:any){
  const s=data.summary||{}, clients=data.clients||[];
  return `
    <div class="pa-header">
      <div><small>ORIXEO LAB</small><h2>Product & Feature Adoption Center</h2><p>Usage réel, fonctions dormantes et recommandations</p></div>
      <button id="pa-close">×</button>
    </div>

    <div class="pa-kpis">
      <article><span>Clients</span><b>${esc(s.clients??0)}</b></article>
      <article><span>Score adoption moyen</span><b>${esc(s.avg_adoption_score??100)}/100</b></article>
      <article><span>Fonctions activées</span><b>${esc(s.enabled_features??0)}</b></article>
      <article><span>Fonctions saines</span><b>${esc(s.healthy_features??0)}</b></article>
      <article><span>Fonctions inutilisées</span><b>${esc(s.unused_features??0)}</b></article>
      <article><span>Recommandations</span><b>${esc(s.recommendations??0)}</b></article>
    </div>

    <div class="pa-clients">
      ${clients.map((c:any)=>`
        <section class="pa-card">
          <div class="pa-client-head">
            <div><h3>${esc(c.name)}</h3><span>${esc(c.healthy)} saines · ${esc(c.activated)} activées · ${esc(c.unused)} inutilisées</span></div>
            <strong class="${Number(c.adoption_score)<40?'risk':Number(c.adoption_score)<75?'watch':'healthy'}">${esc(c.adoption_score)}/100</strong>
          </div>
          <div class="pa-progress"><i style="width:${Math.max(0,Math.min(100,Number(c.adoption_score||0)))}%"></i></div>
          <div class="pa-features">
            ${c.features.map((f:any)=>`
              <article class="pa-feature pa-${esc(f.adoption_status)}">
                <div>
                  <b>${esc(f.name)}</b>
                  <span>${esc(f.module_key)} · ${esc(f.adoption_status)}</span>
                </div>
                <div class="pa-feature-metrics">
                  <span>Usage 30j : ${esc(f.usage_30d)}</span>
                  <span>Seuil activation : ${esc(f.activation_threshold_30d)}</span>
                  <span>Seuil sain : ${esc(f.healthy_threshold_30d)}</span>
                </div>
                <p>${esc(f.description||'')}</p>
                <small>Recommandation : ${esc(f.recommendation)}</small>
              </article>`).join('')}
          </div>
        </section>`).join('')||'<p class="pa-empty">Aucun client.</p>'}
    </div>`;
}

async function openProductAdoption(){
  let overlay=document.getElementById('orixeo-product-adoption-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-product-adoption-overlay';
    overlay.className='pa-overlay';
    overlay.innerHTML='<div class="pa-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.pa-shell') as HTMLElement;
  shell.innerHTML='<p class="pa-empty">Chargement…</p>';
  try{
    const data=await call('/product-adoption');
    shell.innerHTML=render(data);
    shell.querySelector('#pa-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
  }catch(e:any){
    shell.innerHTML='<p class="pa-error">'+esc(e?.message||e)+'</p>';
  }
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-product-adoption-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-product-adoption-link';
  a.innerHTML='▤ <span>Product Adoption</span>';
  a.addEventListener('click',()=>void openProductAdoption());
  nav.appendChild(a);
  return true;
}
if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
