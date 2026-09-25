# Orixeo Agent Factory - MVP

Backend TypeScript sans n8n pour creer et executer des agents IA multi-entreprises.

## MVP
- configuration d'agents en base
- conversations et messages
- tool calling natif
- creation de leads
- recherche simple dans la base de connaissances
- journalisation Supabase
- socle pret pour voix/telephonie, agenda, CRM et RAG vectoriel

## Demarrage
1. Copier .env.example vers .env et renseigner les secrets cote serveur uniquement.
2. npm install
3. npm run typecheck
4. npm run dev

Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY ni OPENAI_API_KEY dans un frontend.

## API
POST /api/agents/:agentId/chat avec l'en-tete x-organization-id et JSON { "message": "Bonjour" }.

## Architecture
Le moteur appelle directement les outils TypeScript. n8n/Make restent optionnels et ne sont pas necessaires au runtime.
