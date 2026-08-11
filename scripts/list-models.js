import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Using the REST API directly since SDK doesn't expose ListModels cleanly sometimes
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
  const data = await res.json();
  const models = data.models.map(m => m.name);
  console.log(models.filter(m => m.includes('flash')));
}
run();
