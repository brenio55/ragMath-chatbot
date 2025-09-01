import { v4 as uuidv4 } from 'uuid';
import KBModel from '../models/kbModel.js';

const kbModel = new KBModel();

// --- Funções Auxiliares para Processamento da Resposta ---

/**
 * Encontra a primeira mensagem de IA que não contém uma decisão de roteador.
 * @param {Array} messages - A lista de mensagens da resposta do modelo.
 * @returns {object|null} A mensagem de resposta direta ou null.
 */
function findDirectAnswer(messages) {
    return messages.find(msg =>
        msg.constructor.name === 'AIMessage' &&
        typeof msg.content === 'string' &&
        !msg.content.includes('routerDecision')
    ) || null;
}

/**
 * Encontra e faz o parse da primeira mensagem de decisão do roteador.
 * @param {Array} messages - A lista de mensagens da resposta do modelo.
 * @returns {object|null} O objeto de dados do roteador ou null.
 */
function findAndParseRouterMessage(messages) {
    const routerMessage = messages.find(msg =>
        msg.constructor.name === 'AIMessage' &&
        typeof msg.content === 'string' &&
        msg.content.includes('routerDecision')
    );

    if (!routerMessage) {
        return null;
    }
    
    console.log('> Router message found:', routerMessage);

    try {
        return JSON.parse(routerMessage.content);
    } catch (error) {
        console.error("Error parsing router message:", error);
        return null; // Retorna null se o JSON for inválido
    }
}

/**
 * Processa a resposta do modelo para extrair o conteúdo final e os passos do workflow.
 * @param {object} modelResponse - A resposta completa do grafo do modelo.
 * @returns {{finalResponseContent: string, agentWorkflowSteps: Array, sourceDocuments: Array}}
 */
function processModelResponse(modelResponse) {
    const { messages, sourceDocuments = [] } = modelResponse;
    console.log('> Processing model response, info received: ', modelResponse);

    // 1. Tenta encontrar uma mensagem de decisão do roteador
    const routerData = findAndParseRouterMessage(messages);

    if (routerData && routerData.routerDecision === "WEB_SEARCH") {
        // 2. Se for WEB_SEARCH, procura a resposta final gerada pelo KnowledgeAgent
        const finalAnswerMessage = findDirectAnswer(messages);
        if (finalAnswerMessage) {
            return {
                finalResponseContent: finalAnswerMessage.content,
                agentWorkflowSteps: [{ "agent": "RouterAgent", "decision": "WebSearch" }, { "agent": "KnowledgeAgent" }],
                sourceDocuments
            };
        }
        // Fallback se a busca na web falhou em produzir uma resposta
        return {
            finalResponseContent: "Não foi possível encontrar uma resposta relevante após a busca.",
            agentWorkflowSteps: [{ "agent": "RouterAgent", "decision": "WebSearch" }, { "agent": "System", "decision": "Error" }],
            sourceDocuments
        };
    }

    // 3. Se não for WEB_SEARCH, ou se não houver routerData, procura por uma resposta direta
    const directAnswerMessage = findDirectAnswer(messages);
    if (directAnswerMessage) {
        return {
            finalResponseContent: directAnswerMessage.content,
            agentWorkflowSteps: [{ "agent": "RouterAgent", "decision": "AnswerDirectly" }],
            sourceDocuments
        };
    }

    // 4. Fallback final se nenhuma resposta puder ser extraída
    return {
        finalResponseContent: "Não foi possível processar a resposta do modelo.",
        agentWorkflowSteps: [{ "agent": "System", "decision": "Error" }],
        sourceDocuments
    };
}

const getKBAnswer = async (req, res) => {
    console.log('body received:', req.body);

    const { message, user_id, conversation_id } = req.body;

    if (!message || !user_id || !conversation_id) {
        return res.status(400).json({ error: "Missing required fields: message, user_id, or conversation_id" });
    }

    const sessionId = `${user_id}-${conversation_id}`;
    const question = message;

    const chatHistory = await kbModel.getChatHistory(sessionId);
    const messages = await chatHistory.getMessages();

    // Only pass the current question to the graph, not the entire history
    const currentQuestion = kbModel.getHumanMessage(question);

    console.log("Chat history length:", messages.length);
    console.log("Current question:", question);
    console.log("initiating model response...");

    const modelResponse = await kbModel.invokeGraph([currentQuestion], sessionId, messages);

    console.log("MODEL RESPONSE:", modelResponse);

    // Processa a resposta do modelo usando a nova função
    const { finalResponseContent, agentWorkflowSteps, sourceDocuments } = processModelResponse(modelResponse);

    // Add the user question and AI response to chat history
    await chatHistory.addMessage(kbModel.getHumanMessage(question));
    await chatHistory.addMessage(kbModel.getAIMessage(finalResponseContent));

    res.json({
        response: finalResponseContent, // Main response with personality
        source_agent_response: finalResponseContent, // Text generated by the specialized agent
        agent_workflow: agentWorkflowSteps,
        sourceDocuments: sourceDocuments.map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata.source
        }))
    });
};

export { getKBAnswer };