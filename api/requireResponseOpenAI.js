import { createRequire } from "module"
const require = createRequire(import.meta.url);

require('dotenv').config({path: './../.env'})

const { OpenAI } = require('openai');

const apiKeyGlobal = process.env.VITE_LastSecondTeacherAPIKEY
console.log(apiKeyGlobal)

const openAI = new OpenAI({ apiKey: apiKeyGlobal });

const runPrompt = async () => {
  const prompt = "Tell me an interesting joke about cars";

    const response = await openAI.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 1000,
      temperature: 1,
      messages: [{"role": "user", 
                  "content": prompt
                }]
    })

    

    console.log(response.choices[0].message)
  }

  runPrompt()