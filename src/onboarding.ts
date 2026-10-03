import { createClient } from '@supabase/supabase-js';
import './onboarding.css';

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

function render(data:any){
  const clients=data.clients||[], steps=data.steps||[];
  return `
    <div class="oc-header">
      <div><small>ORIXEO LAB</small><h2>Onboarding Center</h2><p>Mise en service guidée des nouveaux clients</p></div>
      <button id="oc-close">×</button>
    </div>
    <div class="oc-summary">
      <article><span>Clients</span><b>${clients.length}</b></article>
      <article><span>En cours</span><b>${clients.filter((x:any)=>x.status==='in_progress').length}</b></article>
      <article><span>Prêts</span><b>${clients.filter((x:any)=>x.status==='ready').length}</b></article>
      <article><span>Live</span><b>${clients.filter((x:any)=>x.status==='live').length}</b></article>
      <article><span>Bloqués</span><b>${clients.filter((x:any)=>x.status==='blocked').length}</b></article>
    </div>
    <div class="oc-list">
      ${clients.map((c:any)=>{
        const clientSteps=steps.filter((s:any)=>s.organization_id===c.organization_id);
        return `
          <article class="oc-client oc-${esc(c.status)}" data-org="${esc(c.organization_id)}">
            <div class="oc-client-head">
              <div><b>${esc(c.name)}</b><span>${esc(c.slug)} · ${esc(c.status)}</span></div>
              <strong>${esc(c.readiness_pct)}%</strong>
            </div>
            <div class="oc-progress"><i style="width:${Math.max(0,Math.min(100,Number(c.readiness_pct||0)))}%"></i></div>
            <div class="oc-meta">
              <span>${esc(c.required_done)} / ${esc(c.required_steps)} étapes obligatoires</span>
              <span>${esc(c.total_done)} / ${esc(c.total_steps)} étapes totales</span>
              <span>Date cible : ${c.target_go_live_at?new Date(c.target_go_live_at).toLocaleDateString('fr-FR'):'—'}</span>
            </div>
            <div class="oc-steps">
              ${clientSteps.map((s:any)=>`
                <div class="oc-step oc-step-${esc(s.status)}">
                  <span class="oc-dot"></span>
                  <div><b>${esc(s.label)}</b><small>${esc(s.category)} · ${s.required?'obligatoire':'optionnelle'}</small></div>
                  <strong>${esc(s.status)}</strong>
                </div>`).join('')}
            </div>
            <div class="oc-actions">
              <input class="oc-target" type="date" value="${c.target_go_live_at?String(c.target_go_live_at).slice(0,10):''}">
              <button class="oc-save-date">Date cible</button>
              <button class="oc-refresh">Rafraîchir</button>
              ${c.status==='blocked'
                ?'<button class="oc-resume">Reprendre</button>'
                :'<button class="oc-block">Bloquer</button>'}
              <button class="oc-live" ${Number(c.readiness_pct)===100&&c.status!=='live'?'':'disabled'}>${c.status==='live'?'En production':'Passer en production'}</button>
            </div>
            ${c.notes?'<p class="oc-notes">'+esc(c.notes)+'</p>':''}
          </article>`;
      }).join('')||'<p class="oc-empty">Aucun client à onboarder.</p>'}
    </div>`;
}

async function openOnboarding(){
  let overlay=document.getElementById('orixeo-onboarding-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-onboarding-overlay';
    overlay.className='oc-overlay';
    overlay.innerHTML='<div class="oc-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.oc-shell') as HTMLElement;
  shell.innerHTML='<p class="oc-empty">Chargement…</p>';
  try{
    const data=await call('/onboarding');
    shell.innerHTML=render(data);
    shell.querySelector('#oc-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));

    shell.querySelectorAll('.oc-client').forEach(card=>{
      const org=(card as HTMLElement).dataset.org!;
      card.querySelector('.oc-refresh')?.addEventListener('click',async()=>{
        await call('/onboarding/action',{method:'POST',body:JSON.stringify({organization_id:org,action:'refresh'})});
        await openOnboarding();
      });
      card.querySelector('.oc-save-date')?.addEventListener('click',async()=>{
        const value=(card.querySelector('.oc-target') as HTMLInputElement).value;
        await call('/onboarding/action',{method:'POST',body:JSON.stringify({
          organization_id:org,action:'target_date',target_go_live_at:value?value+'T12:00:00Z':null
        })});
        await openOnboarding();
      });
      card.querySelector('.oc-block')?.addEventListener('click',async()=>{
        await call('/onboarding/action',{method:'POST',body:JSON.stringify({
          organization_id:org,action:'block',notes:'Onboarding bloqué depuis le Control Center'
        })});
        await openOnboarding();
      });
      card.querySelector('.oc-resume')?.addEventListener('click',async()=>{
        await call('/onboarding/action',{method:'POST',body:JSON.stringify({organization_id:org,action:'resume'})});
        await openOnboarding();
      });
      card.querySelector('.oc-live')?.addEventListener('click',async()=>{
        await call('/onboarding/action',{method:'POST',body:JSON.stringify({organization_id:org,action:'go_live'})});
        await openOnboarding();
      });
    });
  }catch(e:any){
    shell.innerHTML='<p class="oc-error">'+esc(e?.message||e)+'</p>';
  }
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-onboarding-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-onboarding-link';
  a.innerHTML='✓ <span>Onboarding Center</span>';
  a.addEventListener('click',()=>void openOnboarding());
  nav.appendChild(a);
  return true;
}
if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
