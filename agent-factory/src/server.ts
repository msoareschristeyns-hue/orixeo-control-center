import express from "express";
import crypto from "node:crypto";
import { env } from "./config.js";
import { runAgent } from "./agent.js";

const app=express();
app.use(express.json({limit:"1mb"}));

function authorized(req:express.Request){
  const supplied=String(req.header("x-api-key")||"");
  const expected=env.AGENT_FACTORY_API_KEY;
  if(!supplied||!expected||supplied.length!==expected.length)return false;
  return crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
}

app.get("/health",(_req,res)=>res.json({ok:true,service:"orixeo-agent-factory"}));

app.post("/api/agents/:agentId/chat",async(req,res)=>{
  try{
    if(!authorized(req))return res.status(401).json({error:"unauthorized"});
    const organizationId=String(req.header("x-organization-id")||"");
    if(!organizationId)return res.status(400).json({error:"x-organization-id required"});
    const message=String(req.body?.message||"").trim();
    if(!message)return res.status(400).json({error:"message required"});
    if(message.length>12000)return res.status(413).json({error:"message too long"});
    res.json(await runAgent({organizationId,agentId:req.params.agentId,message,conversationId:req.body?.conversationId}));
  }catch(e:any){res.status(500).json({error:e?.message||"agent_error"});}
});

app.listen(env.PORT,()=>console.log("Orixeo Agent Factory listening on "+env.PORT));
