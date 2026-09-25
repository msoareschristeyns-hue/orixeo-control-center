import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config.js";
import { db } from "./db.js";
import { runAgent } from "./agent.js";

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.resolve(__dirname,"../public");

app.use(express.json({limit:"1mb"}));
app.use(express.static(publicDir));

function authorized(req:express.Request){
  const supplied=String(req.header("x-api-key")||"");
  const expected=env.AGENT_FACTORY_API_KEY;
  if(!supplied||!expected||supplied.length!==expected.length)return false;
  return crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
}

function requireAuth(req:express.Request,res:express.Response,next:express.NextFunction){
  if(!authorized(req))return res.status(401).json({error:"unauthorized"});
  next();
}

app.get("/health",(_req,res)=>res.json({ok:true,service:"orixeo-agent-factory"}));

app.get("/api/organizations/:organizationId/agents",requireAuth,async(req,res)=>{
  const {data,error}=await db.from("agents")
    .select("id,name,slug,channel,description,status,model_provider,model_name,runtime_config,created_at,updated_at")
    .eq("organization_id",req.params.organizationId)
    .order("created_at",{ascending:false});
  if(error)return res.status(500).json({error:error.message});
  res.json({agents:data||[]});
});

app.post("/api/organizations/:organizationId/agents",requireAuth,async(req,res)=>{
  const body=req.body||{};
  const name=String(body.name||"").trim();
  const slug=String(body.slug||"").trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"");
  const channel=String(body.channel||"chat");
  if(!name||!slug)return res.status(400).json({error:"name and slug required"});
  if(!["chat","voice","email","multichannel"].includes(channel))return res.status(400).json({error:"invalid channel"});
  const {data,error}=await db.from("agents").insert({
    organization_id:req.params.organizationId,
    name,slug,channel,
    description:String(body.description||""),
    system_prompt:String(body.systemPrompt||"Tu es un assistant IA professionnel."),
    model_provider:"openai",
    model_name:String(body.modelName||env.OPENAI_MODEL),
    status:"draft",
    runtime_config:{
      lead_qualification:Boolean(body.leadQualification),
      human_escalation:Boolean(body.humanEscalation),
      knowledge_search:Boolean(body.knowledgeSearch),
      appointment_ready:Boolean(body.appointmentReady)
    }
  }).select().single();
  if(error)return res.status(500).json({error:error.message});
  res.status(201).json({agent:data});
});

app.get("/api/agents/:agentId/tools",requireAuth,async(req,res)=>{
  const {data,error}=await db.from("agent_tools").select("*").eq("agent_id",req.params.agentId).order("display_name");
  if(error)return res.status(500).json({error:error.message});
  res.json({tools:data||[]});
});

app.post("/api/agents/:agentId/tools",requireAuth,async(req,res)=>{
  const organizationId=String(req.body?.organizationId||"");
  const toolKey=String(req.body?.toolKey||"").trim();
  const displayName=String(req.body?.displayName||"").trim();
  if(!organizationId||!toolKey||!displayName)return res.status(400).json({error:"organizationId, toolKey and displayName required"});
  const {data,error}=await db.from("agent_tools").upsert({
    organization_id:organizationId,
    agent_id:req.params.agentId,
    tool_key:toolKey,
    display_name:displayName,
    description:String(req.body?.description||""),
    config:req.body?.config||{},
    permissions:{requires_server:true},
    enabled:req.body?.enabled!==false
  },{onConflict:"agent_id,tool_key"}).select().single();
  if(error)return res.status(500).json({error:error.message});
  res.json({tool:data});
});

app.get("/api/agents/:agentId/documents",requireAuth,async(req,res)=>{
  const {data,error}=await db.from("knowledge_documents").select("*").eq("agent_id",req.params.agentId).order("created_at",{ascending:false});
  if(error)return res.status(500).json({error:error.message});
  res.json({documents:data||[]});
});

app.post("/api/agents/:agentId/documents",requireAuth,async(req,res)=>{
  const organizationId=String(req.body?.organizationId||"");
  const title=String(req.body?.title||"").trim();
  const content=String(req.body?.content||"").trim();
  if(!organizationId||!title||!content)return res.status(400).json({error:"organizationId, title and content required"});
  const {data:doc,error:docError}=await db.from("knowledge_documents").insert({
    organization_id:organizationId,
    agent_id:req.params.agentId,
    title,
    source_type:"text",
    status:"ready",
    metadata:{characters:content.length}
  }).select().single();
  if(docError)return res.status(500).json({error:docError.message});
  const {error:chunkError}=await db.from("knowledge_chunks").insert({
    organization_id:organizationId,
    document_id:doc.id,
    chunk_index:0,
    content
  });
  if(chunkError)return res.status(500).json({error:chunkError.message});
  res.status(201).json({document:doc});
});

app.post("/api/agents/:agentId/chat",requireAuth,async(req,res)=>{
  try{
    const organizationId=String(req.header("x-organization-id")||"");
    if(!organizationId)return res.status(400).json({error:"x-organization-id required"});
    const message=String(req.body?.message||"").trim();
    if(!message)return res.status(400).json({error:"message required"});
    if(message.length>12000)return res.status(413).json({error:"message too long"});
    res.json(await runAgent({organizationId,agentId:req.params.agentId,message,conversationId:req.body?.conversationId}));
  }catch(e:any){res.status(500).json({error:e?.message||"agent_error"});}
});

app.get("*",(_req,res)=>res.sendFile(path.join(publicDir,"index.html")));

app.listen(env.PORT,()=>console.log("Orixeo Agent Factory listening on "+env.PORT));
