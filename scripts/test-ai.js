import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function runTest(modelName) {
  console.log(`\nProbando ${modelName}...`);
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Di 'funciona'");
    console.log(`✅ ${modelName} funciona!`);
  } catch (error) {
    console.error(`❌ Error en ${modelName}:`, error.message || error);
  }
}

async function run() {
  await runTest("gemini-3.6-flash");
  await runTest("gemini-flash-latest");
}
run();
