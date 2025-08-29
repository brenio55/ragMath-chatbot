import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import {
    START, END,
    MessagesAnnotation,
    StateGraph,
} from "@langchain/langgraph";
import { MessagesPlaceholder, ChatPromptTemplate } from "@langchain/core/prompts";
import { createClient } from 'redis';

import Firecrawl from "@mendable/firecrawl-js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Document } from "langchain/document";

import firecrawlScrapper  from "../services/firecrawlScrapper.js"

let googleApiKey;
let redisUrl;
let firecrawlApiKey;
let client;
let vectorstore;
let appGraph;
let llm;
let firecrawlClient;

// Temporary in-memory chat history
// const inMemoryChatHistory = {};

class KBModel {
    constructor() {
        googleApiKey = process.env.GOOGLE_API_KEY;
        redisUrl = process.env.REDIS_URL || "redis://redis:6379";
        firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

        llm = new ChatGoogleGenerativeAI({
            temperature: 0,
            model: "gemini-2.0-flash",
        });

        firecrawlClient = new Firecrawl({ apiKey: firecrawlApiKey });

        this.initLangchainGraph();
        this.initRedisClient();
    }

    async initRedisClient() {
        try {
            client = createClient({
                url: redisUrl
            });
            client.on('error', err => console.error('Redis Client Error', err));
            await client.connect();
            console.log("Connected to Redis.");
        } catch (error) {
            console.error("Failed to connect to Redis:", error);
        }
    }

    // Removed initRedisClient method

    async loadSitemap() {
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const sitemapPath = path.resolve(__dirname, '../public/infinityPayFaqSitemap.xml');
            console.log("Current working directory (inside container):", process.cwd());
            console.log("Resolved sitemap path (inside container):", sitemapPath);
            const sitemapContent = await fs.promises.readFile(sitemapPath, 'utf-8');
            const result = await parseStringPromise(sitemapContent);
            const urls = result.urlset.url.map(urlEntry => urlEntry.loc[0]);
            return urls.filter(url => url.length > 0);
        } catch (error) {
            console.error("Error loading or parsing sitemap:", error);
            return [];
        }
    }

    async scrapeUrls(urls) {
        let docs = [];
        for (const url of urls) {
            try {
                const { data } = await firecrawlClient.scrape(url, { formats: ['markdown'] });
                if (data && data.content) {
                    docs.push(new Document({
                        pageContent: data.content.markdown,
                        metadata: { source: url, title: data.title }
                    }));
                }
            } catch (error) {
                console.error(`Error scraping ${url}:`, error);
            }
        }
        return docs;
    }

    async scrapeAndVectorize(urlsToScrape) {
        if (!urlsToScrape || urlsToScrape.length === 0) {
            console.log("No URLs to scrape.");
            return null;
        }

        const scrapedDocs = await this.scrapeUrls(urlsToScrape);

        if (scrapedDocs.length === 0) {
            console.log("No documents scraped.");
            return null;
        }

        const splitter = new RecursiveCharacterTextSplitter();
        const embeddings = new GoogleGenerativeAIEmbeddings();

        const splitDocs = await splitter.splitDocuments(scrapedDocs);
        const newVectorstore = await MemoryVectorStore.fromDocuments(
            splitDocs, embeddings
        );
        console.log("Vector store created/updated with scraped data.");
        return newVectorstore;
    }

    // Modified getChatHistory to use in-memory history
    async getChatHistory(sessionId) {
        // Implement Redis integration here
        const historyKey = `chat_history:${sessionId}`;
        const rawHistory = await client.get(historyKey);
        let messages = rawHistory ? JSON.parse(rawHistory).map(msg => {
            // Re-hydrate messages based on their type
            if (msg.type === 'human') {
                return new HumanMessage(msg.content);
            } else if (msg.type === 'ai') {
                return new AIMessage(msg.content);
            }
            return msg; // Should not happen with current types
        }) : [];

        return {
            getMessages: async () => messages,
            addMessage: async (message) => {
                messages.push(message);
                // Store only essential properties for serialization
                const serializableMessages = messages.map(msg => ({
                    type: msg.constructor.name === 'HumanMessage' ? 'human' : 'ai',
                    content: msg.content
                }));
                await client.set(historyKey, JSON.stringify(serializableMessages));
            }
        };
    }

    async initLangchainGraph() {
        const self = this; // Capture 'this' for use inside nodes

        const routerPrompt = ChatPromptTemplate.fromMessages([
            [ "system", "Você é um assistente útil e um especialista em roteamento. Sua única e exclusiva tarefa é analisar a pergunta do usuário e o histórico de chat para decidir a MELHOR rota a seguir. Responda APENAS com um objeto JSON válido, sem nenhuma outra conversa, texto ou formatação markdown. Exemplos de resposta válida: {{\"routerDecision\":\"WEB_SEARCH\",\"message\":\"https://ajuda.infinitepay.io/pt-BR/articles/3359956-quais-sao-as-taxas-da-infinitepay\"}} ou {{\"routerDecision\":\"ANSWER_DIRECTLY\",\"message\":\"Olá! Como posso ajudar?\"}} Opções de Decisão: 1. WEB_SEARCH: Use se a pergunta NECESSITA de informações ESPECÍFICAS de um site que pode ser encontrado no sitemap. O 'message' DEVE ser a URL mais relevante. 2. ANSWER_DIRECTLY: Use se a pergunta pode ser respondida com conhecimento geral ou com base no histórico do chat. O 'message' DEVE ser a resposta direta para o usuário, utilizando o histórico da conversa se for relevante. Sitemap URLs disponíveis: {sitemap_urls} Suas respostas devem prioritariamente serem baseadas no sitemap, sempre preferencialmente pesquisando o assunto de acordo com o que você vê nos títulos do sitemap. Caso não encontre nada que possa dar match no site map, só assim responda diretamente." ],
            new MessagesPlaceholder("chat_history"),
            [ "human", "{input}" ],
        ]);

        const routeQuestion = async (state) => {
            const sitemapUrls = await self.loadSitemap();
            const formattedSitemap = sitemapUrls.join('\n');

            const routePromptWithSitemap = await routerPrompt.formatMessages({
                sitemap_urls: formattedSitemap,
                chat_history: state.chatHistory || [],
                input: state.messages[state.messages.length - 1].content,
            });

            const response = await llm.invoke(routePromptWithSitemap);
            console.log("Raw router LLM response:", response.content);
            
            const parsedDecision = self.parseRouterDecision(response.content);
            console.log("Parsed router decision:", parsedDecision);

            if (parsedDecision.route === "WEB_SEARCH" && parsedDecision.message) {
                // For WEB_SEARCH, create a router message and continue to retrieveAndAnswer
                const simplifiedResponse = new AIMessage(JSON.stringify({
                    routerDecision: parsedDecision.route,
                    message: parsedDecision.message
                }));
                return {
                    messages: [simplifiedResponse],
                    route: parsedDecision.route,
                    url_to_scrape: parsedDecision.message
                };
            } else if (parsedDecision.route === "ANSWER_DIRECTLY" && parsedDecision.message) {
                // For ANSWER_DIRECTLY, append the final answer to the existing messages
                const finalResponse = new AIMessage(parsedDecision.message);
                return {
                    messages: [...state.messages, finalResponse],
                    route: parsedDecision.route
                };
            } else {
                // Fallback for unexpected or missing information
                console.error("Unexpected router decision format or missing message:", parsedDecision);
                const fallbackResponse = new AIMessage("Não foi possível determinar uma resposta clara no momento.");
                return {
                    messages: [...state.messages, fallbackResponse],
                    route: "ANSWER_DIRECTLY"
                };
            }
        };

        const retrieveAndAnswer = async (state) => {
            // Extract the URL to scrape from the state
            console.log(">>> ENTERED retrieveAndAnswer with state:", state); 
            const LAST_ARRAY_ELEMENT = state.messages[state.messages.length - 1];
            const AIContentResponse = JSON.parse(LAST_ARRAY_ELEMENT.content);
            
            const urlToScrape = AIContentResponse.message || "no url found";

            console.log("> URL to scrape in retrieveAndAnswer:", urlToScrape);

            if (!urlToScrape) {
                // Fallback if scraping failed or no URL was provided by router
                return { 
                    messages: [new AIMessage("Não encontrei informações relevantes nas fontes fornecidas para esta pergunta específica. Responderei com base no meu conhecimento geral.")], 
                    sourceDocuments: [] 
                };
            }

            const currentVectorstore = await firecrawlScrapper(urlToScrape)

            if (!currentVectorstore) {
                // Fallback if scraping failed or no URL was provided by router
                return { 
                    messages: [new AIMessage("Não encontrei informações relevantes nas fontes fornecidas para esta pergunta específica. Responderei com base no meu conhecimento geral.")], 
                    sourceDocuments: [] 
                };
            }

            // Use a simpler approach without historyAwareRetriever
            console.log('currentVectorStore dados recuperados: ', currentVectorstore)
            return null
            const retriever = currentVectorstore.asRetriever();
            const docs = await retriever.getRelevantDocuments(state.messages[0].content);
            
            if (docs.length === 0) {
                return { 
                    messages: [new AIMessage("Não encontrei informações relevantes nas fontes fornecidas para esta pergunta específica.")], 
                    sourceDocuments: [] 
                };
            }

            // Create a simple prompt for the LLM
            const context = docs.map(doc => doc.pageContent).join('\n\n');
            const prompt = `Com base no contexto fornecido abaixo, responda à pergunta do usuário de forma clara e precisa. Se a resposta não estiver no contexto, diga que não tem informações suficientes.

            Contexto:
            ${context}

            Pergunta: ${state.messages[0].content}

            Resposta:`;

            const response = await llm.invoke(prompt);
            return { 
                messages: [new AIMessage(response.content)], 
                sourceDocuments: docs 
            };
        };


        

        const workflow = new StateGraph(MessagesAnnotation)
        .addNode("routeQuestion", routeQuestion)
        .addNode("retrieveAndAnswer", retrieveAndAnswer)
        .addEdge(START, "routeQuestion")
        .addConditionalEdges(
          "routeQuestion",
          (state) => {
            // Check if we have route information in the state

            console.log('State at end of routeQuestion:', state);
            const LAST_ARRAY_ELEMENT = state.messages[state.messages.length - 1];
            console.log('state last element content: ', LAST_ARRAY_ELEMENT.content);
            const AIContentResponse = JSON.parse(LAST_ARRAY_ELEMENT.content);
            console.log('AIContentResponse: ', AIContentResponse);
            console.log('content router decision: ', AIContentResponse.routerDecision);
            // console.log('State routes at end of routeQuestion:', state.route);

            const routeDecision = AIContentResponse.routerDecision || "ANSWER_DIRECTLY";

            if (routeDecision === "WEB_SEARCH") {
              console.log('entered in routeQuestion Websearch');
              return "WEB_SEARCH";
            } else {
              // For ANSWER_DIRECTLY or any other case, return null to end
              console.log('entered in routeQuestion answerDirectly');              
              return null; // Use null instead of END to terminate the workflow
            }
          },
          {
            "WEB_SEARCH": "retrieveAndAnswer",
            // Optionally, you can map null to END explicitly
            null: END
          } //here it maps to where the conditional edge will let to.
        )
        .addEdge("retrieveAndAnswer", END);

        appGraph = workflow.compile();
        console.log("Langchain graph compiled.");
    }

    async invokeGraph(messages, sessionId, chatHistory = []) {
        const config = {
            configurable: {
                thread_id: sessionId,
            },
            recursionLimit: 50,
        };

        console.log("Invoking graph with messages:", messages.length, "messages");
        console.log("Message types:", messages.map(msg => msg.constructor.name));
        console.log("Chat history length:", chatHistory.length);

        // The StateGraph expects an initial state, which includes the messages
        const initialState = { 
            messages: messages,
            chatHistory: chatHistory
        };

        console.log("Invoking graph with initial state:", initialState);

        const result = await appGraph.invoke(initialState, config);

        console.log("Graph invocation result:", result);

        // Simplify the response to only include essential information
        return {
            messages: result.messages,
            sourceDocuments: result.sourceDocuments || []
        };
    }

    getHumanMessage(content) {
        return new HumanMessage(content);
    }

    getAIMessage(content) {
        return new AIMessage(content);
    }

    parseRouterDecision(llmOutput) {
        try {
            // Clean the output to extract only the JSON part
            let cleanedOutput = llmOutput.trim();
            
            // Remove markdown formatting if present
            if (cleanedOutput.includes('```json')) {
                cleanedOutput = cleanedOutput.split('```json')[1];
            }
            if (cleanedOutput.includes('```')) {
                cleanedOutput = cleanedOutput.split('```')[0];
            }
            
            // Remove any text before the first { and after the last }
            const firstBrace = cleanedOutput.indexOf('{');
            const lastBrace = cleanedOutput.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanedOutput = cleanedOutput.substring(firstBrace, lastBrace + 1);
            }
            
            // Try to parse the cleaned JSON
            const decision = JSON.parse(cleanedOutput);
            
            // Validate the structure
            if (decision.routerDecision && decision.message !== undefined) {
                return { route: decision.routerDecision, message: decision.message };
            } else {
                console.error("Invalid JSON structure for router decision:", decision);
                return { route: "ANSWER_DIRECTLY", message: "Erro ao processar a decisão do roteador." };
            }
        } catch (error) {
            console.error("Error parsing router decision JSON:", error, "Raw output:", llmOutput);
            return { route: "ANSWER_DIRECTLY", message: "Erro interno ao rotear a pergunta." };
        }
    }
}

export default KBModel;