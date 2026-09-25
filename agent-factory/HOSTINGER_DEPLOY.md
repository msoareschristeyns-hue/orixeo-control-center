# Hostinger deployment - Orixeo Agent Factory

Target domain: agent.orixeo-lab.io
Repository: msoareschristeyns-hue/orixeo-control-center
Branch: agent-factory-mvp
Application directory: agent-factory
Runtime: Node.js 20+
Install command: npm install
Start command: npm start
Health endpoint: /health

## Required server environment variables

PORT=3000
AGENT_FACTORY_API_KEY=<long random secret>
OPENAI_API_KEY=<server secret>
OPENAI_MODEL=gpt-5-mini
SUPABASE_URL=<local Supabase API URL reachable by Hostinger>
SUPABASE_SERVICE_ROLE_KEY=<server secret>
SUPABASE_SCHEMA=orixeo

## Security

Never commit real secrets to GitHub.
The service-role and OpenAI keys must exist only in Hostinger server environment variables.
Before production exposure, verify that the local Supabase endpoint is reachable from Hostinger over a protected route.
