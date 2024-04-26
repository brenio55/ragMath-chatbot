import { createRequire } from "module"
const require = createRequire(import.meta.url);

require('dotenv').config({path: './../.env'})

const { OpenAI } = require('openai');

const apiKeyGlobal = process.env.VITE_LastSecondTeacherAPIKEY
console.log(apiKeyGlobal)

const openAI = new OpenAI({ apiKey: apiKeyGlobal });

const runPrompt = async () => {
  const prompt = "Tell me an interesting joke about cars";

    const response = await openAI.createCompletion({
      Model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 2048,
      temperature: 1
    })

    console.log(response)
  }

  runPrompt()