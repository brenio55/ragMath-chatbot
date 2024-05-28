import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: './../.env' });

const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;

const router = express.Router();
const openAI = new OpenAI({ apiKey });

console.log(apiKey)

const threads = {};

router.get('/', async (req, res) => {
    console.log("Received request");
    try {
        res.status(200).json({ message: "GET Request successfully made to root API" });
    } catch (error) {
        res.status(500).json({ message: error });
    }
});

router.post('/', async (req, res) => {
    const { inputText, threadId, role } = req.body;
    console.log('Received request:', { inputText, threadId, role });

    try {
        const messages = threads[threadId] || [
            { "role": "system", "content": `You are interacting with a user who is a ${role}. Your role is to assist them. If they ask about generating a worksheet, tell them to press the 'Generate PDF' button to create the worksheet.` }
        ];
        console.log('Current thread messages:', messages);

        messages.push({ "role": "user", "content": inputText });
        console.log('Updated thread messages:', messages);

        const response = await openAI.chat.completions.create({
            model: "gpt-4",
            max_tokens: 1000,
            temperature: 1,
            messages: messages
        });

        const systemMessage = response.choices[0].message;
        console.log('System response:', systemMessage);

        if (!threads[threadId]) {
            threads[threadId] = [
                { "role": "system", "content": `You are interacting with a user who is a ${role}. Your role is to assist them. If they ask about generating a worksheet, or just mention a worksheet topic, tell them to press the 'Generate PDF' button to create the worksheet.` }
            ];
        }
        threads[threadId].push(systemMessage);

        res.json({ message: systemMessage.content });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send({ error: error.message });
    }
});

export default router;
