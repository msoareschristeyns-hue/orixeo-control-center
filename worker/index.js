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

async function nextJob() {
  const { data, error } = await sb.from('enrichment_jobs')
    .select('id,opportunity_id,status,next_attempt_at')
    .eq('status', 'queued')
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function stage(jobId, name, progress, patch = {}) {
  const { error } = await sb.rpc('save_enrichment_stage', { p_job: jobId, p_stage: name, p_progress: progress, p_patch: patch });
  if (error) throw error;
}

async function processJob(candidate) {
  const { data: claim, error: claimError } = await sb.rpc('claim_enrichment_job', { p_job: candidate.id, p_worker_id: workerId });
  if (claimError) throw claimError;
  if (!claim?.claimed) return;

  const jobId = candidate.id;
  const opp = claim.opportunity_id || candidate.opportunity_id;
  let heartbeat;
  try {
    log('claimed', { job_id: jobId, opportunity_id: opp });
    heartbeat = setInterval(() => {
      sb.rpc('heartbeat_enrichment_job', { p_job: jobId, p_worker_id: workerId }).catch(() => {});
    }, 15000);

    await stage(jobId, 'search', 20, { vps_worker: workerId, started_at: new Date().toISOString() });
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 90000);
    let response;
    try {
      response = await fetch(`${url}/functions/v1/enrich-opportunity`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${service}`, apikey: service, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opp, job_id: jobId }),
        signal: ctrl.signal
      });
    } finally { clearTimeout(timeout); }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) throw new Error(result?.error || `enrich-opportunity HTTP ${response.status}`);

    await stage(jobId, 'verify', 75, { enrichment: result });
    await stage(jobId, 'score', 90, { verified: true });
    const { data: scoring, error: scoreError } = await sb.rpc('recalculate_opportunity_v31', { p_opportunity: opp });
    if (scoreError) throw scoreError;
    await stage(jobId, 'done', 100, { scoring });

    const now = new Date().toISOString();
    const { error: finishError } = await sb.from('enrichment_jobs').update({
      status: 'completed', progress: 100, current_stage: 'done', result: { ...result, scoring, vps_worker: true },
      candidate_result: result, engine_version: '1.9.0-vps', heartbeat_at: now, lease_expires_at: null,
      completed_at: now, updated_at: now, error: null
    }).eq('id', jobId);
    if (finishError) throw finishError;
    log('completed', { job_id: jobId, score: scoring?.score, confidence: scoring?.confidence });
  } catch (e) {
    const message = e?.name === 'AbortError' ? 'enrichment_timeout_90s' : String(e?.message || e);
    log('failed_attempt', { job_id: candidate.id, error: message });
    await sb.rpc('fail_or_retry_enrichment_job', { p_job: candidate.id, p_error: message }).catch(() => {});
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

async function loop() {
  log('started', { poll_ms: pollMs, concurrency });
  while (true) {
    try {
      const jobs = [];
      for (let i = 0; i < concurrency; i++) {
        const job = await nextJob();
        if (!job || jobs.some(x => x.id === job.id)) break;
        jobs.push(job);
      }
      if (jobs.length) await Promise.all(jobs.map(processJob));
      else await sleep(pollMs);
    } catch (e) {
      log('loop_error', { error: String(e?.message || e) });
      await sleep(Math.max(pollMs, 5000));
    }
  }
}

process.on('SIGTERM', () => { log('sigterm'); process.exit(0); });
process.on('SIGINT', () => { log('sigint'); process.exit(0); });
loop().catch(e => { log('fatal', { error: String(e?.message || e) }); process.exit(1); });
