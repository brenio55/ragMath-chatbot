import { v4 as uuidv4 } from 'uuid';
import KBModel from '../models/kbModel.js';

const kbModel = new KBModel();

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
    console.log("Messages in response:", modelResponse.messages.map(msg => ({
        type: msg.constructor.name,
        content: typeof msg.content === 'string' ? msg.content.substring(0, 100) + '...' : msg.content
    })));
    console.log("Number of router messages found:", modelResponse.messages.filter(msg => 
        msg.constructor.name === 'AIMessage' && 
        typeof msg.content === 'string' && 
        msg.content.includes('routerDecision')
    ).length);

    // Process the model response to extract the final answer
    let finalResponseContent = '';
    let agentWorkflowSteps = [];
    let sourceDocuments = modelResponse.sourceDocuments || [];

    // Check if we have a direct answer (no router decision needed)
    const directAnswerMessages = modelResponse.messages.filter(msg => 
        msg.constructor.name === 'AIMessage' && 
        typeof msg.content === 'string' && 
        !msg.content.includes('routerDecision') &&
        !msg.content.includes('{') &&
        !msg.content.includes('}')
    );

    if (directAnswerMessages.length > 0) {
        // We have a direct answer, use it immediately
        finalResponseContent = directAnswerMessages[0].content;
        agentWorkflowSteps = [{ "agent": "RouterAgent", "decision": "AnswerDirectly" }];
    } else {
        // Look for router decision messages
        const routerMessages = modelResponse.messages.filter(msg => 
            msg.constructor.name === 'AIMessage' && 
            typeof msg.content === 'string' && 
            msg.content.includes('routerDecision')
        );

        if (routerMessages.length > 0) {
            // Use the first router message to avoid duplicates
            const firstRouterMessage = routerMessages[0];
            try {
                const routerData = JSON.parse(firstRouterMessage.content);
                
                if (routerData.routerDecision === "WEB_SEARCH") {
                    // For WEB_SEARCH, look for the actual answer from retrieveAndAnswer
                    const answerMessages = modelResponse.messages.filter(msg => 
                        msg.constructor.name === 'AIMessage' && 
                        typeof msg.content === 'string' && 
                        !msg.content.includes('routerDecision')
                    );
                    
                    // Get the first non-router message as the answer
                    if (answerMessages.length > 0) {
                        const firstAnswerMessage = answerMessages[0];
                        finalResponseContent = firstAnswerMessage.content;
                        agentWorkflowSteps = [{ "agent": "RouterAgent", "decision": "WebSearch" }, { "agent": "KnowledgeAgent" }];
                    } else {
                        finalResponseContent = "Não foi possível encontrar uma resposta relevante.";
                        agentWorkflowSteps = [{ "agent": "RouterAgent", "decision": "WebSearch" }, { "agent": "System", "decision": "Error" }];
                    }
                } else {
                    finalResponseContent = "Erro ao processar a decisão do roteador.";
                    agentWorkflowSteps = [{ "agent": "System", "decision": "Error" }];
                }
            } catch (error) {
                console.error("Error parsing router message:", error);
                finalResponseContent = "Erro ao processar a resposta do roteador.";
                agentWorkflowSteps = [{ "agent": "System", "decision": "Error" }];
            }
        } else {
            finalResponseContent = "Não foi possível processar a resposta do modelo.";
            agentWorkflowSteps = [{ "agent": "System", "decision": "Error" }];
        }
    }

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