import { OpenAI } from 'openai';

const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;
if (!apiKey) {
    console.error("API key not found. Please make sure to set the VITE_LastSecondTeacherAPIKEY environment variable.");
    process.exit(1);
}

const openAI = new OpenAI({ apiKey });

const threads = {};

app.post('/api/requireResponseOpenAI', async (req, res) => {
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
