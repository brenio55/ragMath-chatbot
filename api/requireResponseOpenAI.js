import { createRequire } from "module"
const require = createRequire(import.meta.url);

const { Configuration } = require('openai');

const apiKeyGlobal = process.env.VITE_LastSecondTeacherAPIKEY

const config = new Configuration({
  apiKey: apiKeyGlobal
});

// const openAI = new OpenAIAPIAccess(config)

// const runPrompt = async () => {
//   const prompt = "Tell me an interesting joke about cars";

//     const response = await openAI.createCompletion({
//       Model: "text-davinci-003",
//       prompt: prompt,
//       max_tokens: 2048,
//       temperature: 1
//     })

//     console.log(response)
//   }

//   runPrompt()