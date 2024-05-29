import { OpenAI } from 'openai';

const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;
if (!apiKey) {
    console.error("API key not found. Please make sure to set the VITE_LastSecondTeacherAPIKEY environment variable.");
    process.exit(1);
}

const openAI = new OpenAI({ apiKey });


const cors = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
}

const threads = {};

async function logic({ threadId, role, inputText }) {
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

    return { message: systemMessage.content };
}

/**
 * @param {Request} req
 * */
export async function POST(req) {
    const body = await req.json()
    console.log('Received request:', body);

    try {
        const object = await logic(body);
        const data = JSON.stringify(object)
        return new Response(data, { status: 200, headers: cors });
    } catch (error) {
        console.error("Error: ", error.message);
        const err = JSON.stringify({ error: error.message });
        return new Response(err, { status: 500, headers: cors })
    }
};
