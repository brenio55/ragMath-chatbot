import express from 'express';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require('dotenv').config({ path: './../.env' });
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;
console.log(apiKey)
if (!apiKey) {
    console.error("API key not found. Please make sure to set the VITE_LastSecondTeacherAPIKEY environment variable.");
    process.exit(1);
}

const openAI = new OpenAI({ apiKey });

const cors=require("cors");
const corsOptions ={
   origin:'*', 
   credentials:true,            //access-control-allow-credentials:true
   optionSuccessStatus:200,
}

app.use(cors(corsOptions)) 

app.post('/api/requireResponseOpenAI', async (req, res) => {
    const { inputText } = req.body;

    try {
        const response = await openAI.chat.completions.create({
            model: "gpt-3.5-turbo",
            max_tokens: 1000,
            temperature: 1,
            messages: [
                { "role": "system", "content": "You are a system that generates Worksheets for teachers and students." },
                { "role": "user", "content": inputText }
            ]
        });

        res.json({ message: response.choices[0].message.content });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


