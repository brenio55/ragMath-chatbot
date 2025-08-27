import dotenv from 'dotenv' 
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const config = {
    configurable: {
        thread_id: uuidv4(),
    }
}



import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { 
    START, END,
    MessagesAnnotation,
    StateGraph, MemorySaver,
} from "@langchain/langgraph";

dotenv.config();

let googleApiKey = process.env.GOOGLE_API_KEY;
console.log("Google API Key:", googleApiKey);
//
//FLOW:
//1 - User send a request to the model with a question
//2 - Model analyze the URLs and topics to get the best answer
//3 - Model execute scrape retrieval to get the content of the URLs
//4 - Model analyze if the content is relevant to the question
//5 - If relevant, the content is used to generate the answer and returns the URL as source
//5 - If not relevant, the content is discarded and the model tries to answer with another URL
//6 - If no URL is relevant, the model tries to answer with the topics
//7 - If no topic is relevant, the model tries to answer with its own knowledge and say that couldn't find anything relevant in database.

const llm = new ChatGoogleGenerativeAI({
    temperature: 0,
    model: "gemini-2.0-flash",
});

const callModel = async (state) => {
    let response = await llm.invoke(state.messages);
    return { messages: response }
}

const workflow = new StateGraph(MessagesAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END);

const memory = new MemorySaver();
const app = workflow.compile({ checkpointer: memory });

router.get('/', async (req, res) => {
    let AIInvoke = await llm.invoke([{
        role: "user",
        content: "Hello chat!"
    }]);

    res.json({
        status: 'ok',
        AIInvokeReceived: AIInvoke
    })
})

export default router;