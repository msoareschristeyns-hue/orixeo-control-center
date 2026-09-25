import "dotenv/config";
import { z } from "zod";
const Env=z.object({PORT:z.coerce.number().default(3000),AGENT_FACTORY_API_KEY:z.string().min(32),OPENAI_API_KEY:z.string().min(1),OPENAI_MODEL:z.string().default("gpt-5-mini"),SUPABASE_URL:z.string().url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(1),SUPABASE_SCHEMA:z.string().default("orixeo")});
export const env=Env.parse(process.env);
