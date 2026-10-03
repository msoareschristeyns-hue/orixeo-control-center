# Orixeo Sales AI Server

Backend V1 de l assistant commercial Orixeo Lab.

## Fonctions
- ouverture/reprise de session web
- historique des messages
- profil de qualification progressif
- scoring commercial sur 100
- orientation vers une offre Orixeo
- reponse IA via OpenAI Responses API
- creation d un lead Supabase avec consentement et coordonnees

## Demarrage
1. Copier .env.example vers .env et renseigner les secrets cote serveur uniquement.
2. Node 20+.
3. Executer: node --env-file=.env src/index.js
4. Tester: node --test

## API
POST /chat

Exemple:
{
  "session_id": "facultatif",
  "message": "Je perds du temps avec des doubles saisies entre Excel et mon ERP",
  "profile": {
    "role": "Dirigeant",
    "company_size": "25"
  }
}

GET /health

## Securite
Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY ni OPENAI_API_KEY dans le frontend.
Le frontend appelle uniquement ce backend.
