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
import { MessagesPlaceholder } from "@langchain/core/prompts";

import Firecrawl from "@mendable/firecrawl-js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Document } from "langchain/document";

let googleApiKey;
// let redisUrl;
let firecrawlApiKey;
// let client;
let vectorstore;
let appGraph;
let llm;
let firecrawlClient;

// Temporary in-memory chat history
const inMemoryChatHistory = {};

class KBModel {
    constructor() {
        googleApiKey = process.env.GOOGLE_API_KEY;
        // redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

        llm = new ChatGoogleGenerativeAI({
            temperature: 0,
            model: "gemini-2.0-flash",
        });

        firecrawlClient = new Firecrawl({ apiKey: firecrawlApiKey });

        this.initLangchainGraph();
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
        if (!inMemoryChatHistory[sessionId]) {
            inMemoryChatHistory[sessionId] = [];
        }
        return {
            getMessages: async () => inMemoryChatHistory[sessionId],
            addMessage: async (message) => {
                inMemoryChatHistory[sessionId].push(message);
            }
        };
    }

    async initLangchainGraph() {
        const self = this; // Capture 'this' for use inside nodes

        const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
            [ "system", "Given a chat history and the latest user question \n" +
                "which might reference context in the chat history, \n" +
                "formulate a standalone question which can be understood without \n" +
                "the chat history. Do NOT answer the question, just reformulate \n" +
                "it if necessary and otherwise return it as is." ],
            new MessagesPlaceholder("chat_history"),
            [ "human", "{input}" ],
        ]);

        const routerPrompt = ChatPromptTemplate.fromMessages([
            [ "system", `Você é um assistente útil e um especialista em roteamento. Sua única tarefa é analisar a pergunta do usuário e o histórico de chat e decidir a MELHOR rota a seguir. 
            
            **Regras para Decisão:**
            1. Se a pergunta do usuário NECESSITA de informações de um site (provavelmente encontrado no sitemap), responda EXATAMENTE com: "WEB_SEARCH <URL_MAIS_RELEVANTE>"
            2. Se a pergunta pode ser respondida com conhecimento geral ou não há uma URL relevante óbvia no sitemap, responda EXATAMENTE com: "ANSWER_DIRECTLY"
            
            **NÃO** adicione nenhuma outra informação ou conversa na sua resposta. APENAS a decisão formatada.
            
            Sitemap URLs disponíveis para consulta:
            {sitemap_urls}` ],
            new MessagesPlaceholder("chat_history"),
            [ "human", "{input}" ],
        ]);

        const routeQuestion = async (state) => {
            const sitemapUrls = await self.loadSitemap();
            const formattedSitemap = sitemapUrls.join('\n');

            const routePromptWithSitemap = await routerPrompt.formatMessages({
                sitemap_urls: formattedSitemap,
                chat_history: state.messages.slice(0, -1),
                input: state.messages[state.messages.length - 1].content,
            });

            const response = await llm.invoke(routePromptWithSitemap);
            console.log("Raw router LLM response:", response.content);
            const parsedDecision = self.parseRouterDecision(response.content);
            console.log("Parsed router decision:", parsedDecision.route);

            if (parsedDecision.route === "WEB_SEARCH" && parsedDecision.url) {
                return { messages: [response], route: parsedDecision.route, url_to_scrape: parsedDecision.url };
            } else {
                return { messages: [response], route: "ANSWER_DIRECTLY" }; // Fallback to ANSWER_DIRECTLY
            }
        };

        const retrieveAndAnswer = async (state) => {
            // If we are coming from a web search, state.url_to_scrape will be populated
            // Otherwise, we might not have a specific URL to scrape for this turn.
            const currentVectorstore = await self.scrapeAndVectorize([state.url_to_scrape]);
            if (!currentVectorstore) {
                // Fallback if scraping failed or no URL was provided by router
                return { messages: [new AIMessage("I couldn't find relevant information in the provided sources. I will try to answer from my general knowledge.")], sourceDocuments: [] };
            }

            const historyAwareRetriever = await createHistoryAwareRetriever({
                llm: llm,
                retriever: currentVectorstore.asRetriever(),
                rephrasePrompt: contextualizeQPrompt,
            });

            const qaPrompt = ChatPromptTemplate.fromMessages([
                [ "system", "Answer the user's questions based on the below context:\n\n{context}\n\nIf the answer is not in the context, say that you couldn't find relevant information in the provided sources. Do not make up an answer." ],
                new MessagesPlaceholder("chat_history"),
                [ "human", "{input}" ],
            ]);

            const qaChain = await createStuffDocumentsChain({
                llm: llm,
                prompt: qaPrompt,
            });

            const ragChain = await createRetrievalChain({
                retriever: historyAwareRetriever,
                combineDocsChain: qaChain,
            });
            const response = await ragChain.invoke({ input: state.messages[state.messages.length - 1].content, chat_history: state.messages.slice(0, -1) });
            return { messages: [new AIMessage(response.answer)], sourceDocuments: response.context };
        };

        const answerDirectly = async (state) => {
            // Simple LLM call for general knowledge questions or if no relevant URL was found
            const response = await llm.invoke(state.messages);
            return { messages: [new AIMessage(response.content)], sourceDocuments: [] };
        };

        const workflow = new StateGraph(MessagesAnnotation)
            .addNode("routeQuestion", routeQuestion)
            .addNode("retrieveAndAnswer", retrieveAndAnswer)
            .addNode("answerDirectly", answerDirectly)
            .addEdge(START, "routeQuestion")
            .addConditionalEdges(
                "routeQuestion",
                (state) => {
                    const lastMessage = state.messages[state.messages.length - 1];
                    const decision = lastMessage.content.trim().split(/\s+/);
                    console.log("Router decision in conditional edge:", decision[0]);
                    return decision[0];
                },
                {
                    "WEB_SEARCH": "retrieveAndAnswer",
                    "ANSWER_DIRECTLY": "answerDirectly",
                }
            )
            .addEdge("retrieveAndAnswer", END)
            .addEdge("answerDirectly", END);

        appGraph = workflow.compile();
        console.log("Langchain graph compiled.");
    }

    async invokeGraph(messages, sessionId) {
        const config = {
            configurable: {
                thread_id: sessionId,
            },
            recursionLimit: 50,
        };

        // The StateGraph expects an initial state, which includes the messages
        const initialState = { messages: messages };
        const result = await appGraph.invoke(initialState, config);

        // The result from LangGraph is an object containing the final state
        // We need to extract the messages and sourceDocuments from it.
        return {
            messages: result.messages,
            sourceDocuments: result.sourceDocuments || []
        };
    }

    getHumanMessage(content) {
        return new HumanMessage(content);
    }

    parseRouterDecision(llmOutput) {
        const trimmedOutput = llmOutput.trim();
        const parts = trimmedOutput.split(/\s+/);

        if (parts[0] === "WEB_SEARCH" && parts.length > 1) {
            return { route: "WEB_SEARCH", url: parts[1] };
        } else {
            // Default to ANSWER_DIRECTLY if not explicitly WEB_SEARCH with a URL
            return { route: "ANSWER_DIRECTLY", url: undefined };
        }
    }
}

export default KBModel; 