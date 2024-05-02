import { createRequire } from "module";
const require = createRequire(import.meta.url);

require('dotenv').config({ path: './../.env' });

const { OpenAI } = require('openai');

// Obter a chave da API do ambiente
const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;

// Verificar se a chave da API está presente
if (!apiKey) {
    console.error("API key not found. Please make sure to set the VITE_LastSecondTeacherAPIKEY environment variable.");
    process.exit(1); // Encerrar o processo com erro
}

// Inicializar o cliente OpenAI
const openAI = new OpenAI({ apiKey });

// Função para executar o prompt
const runPrompt = async () => {
    const prompt = "Please make a worksheet about Biology for studying.";

    try {
        // Solicitar completions para o modelo
        const response = await openAI.chat.completions.create({
            model: "gpt-3.5-turbo",
            max_tokens: 1000,
            temperature: 1,
            messages: [
                { "role": "system", "content": "You are a system that generates Worksheets for teachers and students. You will deliver a worksheet on JSON to SYSTEM everytime the main user decides that the worksheet he talked about is great." },
                { "role": "user", "content": prompt }
            ]
        });

        // Exibir a resposta
        console.log(response.choices[0].message);
    } catch (error) {
        console.error("Error:", error.message);
    }
};

// Executar o prompt
runPrompt();
