import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pollMs = Math.max(2000, Number(process.env.WORKER_POLL_INTERVAL || 5000));
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 1));
const workerId = `vps-${process.env.HOSTNAME || 'orixeo'}-${crypto.randomUUID()}`;

if (!url || !service) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const sb = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (event, data = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), worker: workerId, event, ...data }));

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}

async function nextJob() {
  const { data, error } = await sb.from('enrichment_jobs').select('id,opportunity_id,status,next_attempt_at').eq('status','queued').or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`).order('created_at',{ascending:true}).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function stage(jobId, name, progress, patch={}) {
  await rpc('save_enrichment_stage',{p_job:jobId,p_stage:name,p_progress:progress,p_patch:patch});
}

async function heartbeat(jobId, progress, status='running') {
  try { await rpc('heartbeat_enrichment_job',{p_job:jobId,p_progress:progress,p_status:status}); }
  catch (e) { log('heartbeat_error',{job_id:jobId,error:String(e?.message||e)}); }
}

async function processJob(candidate) {
  const claim = await rpc('claim_enrichment_job',{p_job:candidate.id,p_worker_id:workerId});
  if (!claim?.claimed) return;
  const jobId=candidate.id, opp=claim.opportunity_id||candidate.opportunity_id;
  let timer;
  try {
    log('claimed',{job_id:jobId,opportunity_id:opp});
    let hbProgress=20;
    timer=setInterval(()=>heartbeat(jobId,hbProgress,'running'),15000);
    await stage(jobId,'search',20,{vps_worker:workerId,started_at:new Date().toISOString()});

    const ctrl=new AbortController(), timeout=setTimeout(()=>ctrl.abort(),90000);
    let response;
    try {
      response=await fetch(`${url}/functions/v1/enrich-opportunity`,{method:'POST',headers:{Authorization:`Bearer ${service}`,apikey:service,'Content-Type':'application/json'},body:JSON.stringify({opportunity_id:opp,job_id:jobId}),signal:ctrl.signal});
    } finally { clearTimeout(timeout); }
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result?.ok) throw new Error(result?.details ? `${result.error}: ${result.details}` : result?.error||`enrich-opportunity HTTP ${response.status}`);

    hbProgress=75; await stage(jobId,'verify',75,{enrichment:result});
    hbProgress=90; await stage(jobId,'score',90,{verified:true});
    const scoring=await rpc('recalculate_opportunity_v31',{p_opportunity:opp});
    await stage(jobId,'done',100,{scoring});
    const now=new Date().toISOString();
    const {error}=await sb.from('enrichment_jobs').update({status:'completed',progress:100,current_stage:'done',result:{...result,scoring,vps_worker:true},candidate_result:result,engine_version:'1.9.1-vps',heartbeat_at:now,lease_expires_at:null,completed_at:now,updated_at:now,error:null}).eq('id',jobId);
    if(error) throw error;
    log('completed',{job_id:jobId,score:scoring?.score,confidence:scoring?.confidence});
  } catch(e) {
    const message=e?.name==='AbortError'?'enrichment_timeout_90s':String(e?.message||e);
    log('failed_attempt',{job_id:jobId,error:message});
    try { await rpc('fail_or_retry_enrichment_job',{p_job:jobId,p_error:message}); }
    catch(retryError) { log('retry_error',{job_id:jobId,error:String(retryError?.message||retryError)}); }
  } finally { if(timer) clearInterval(timer); }
}

async function loop(){
  log('started',{version:'1.9.1',poll_ms:pollMs,concurrency});
  while(true){
    try{
      const jobs=[];
      for(let i=0;i<concurrency;i++){const job=await nextJob();if(!job||jobs.some(x=>x.id===job.id))break;jobs.push(job)}
      if(jobs.length)await Promise.all(jobs.map(processJob));else await sleep(pollMs);
    }catch(e){log('loop_error',{error:String(e?.message||e)});await sleep(Math.max(pollMs,5000))}
  }
}
process.on('SIGTERM',()=>{log('sigterm');process.exit(0)});
process.on('SIGINT',()=>{log('sigint');process.exit(0)});
loop().catch(e=>{log('fatal',{error:String(e?.message||e)});process.exit(1)});
