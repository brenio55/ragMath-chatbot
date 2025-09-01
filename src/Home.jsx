import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import LoadingDots from './components/LoadingDots';
import ChatContainer from './components/ChatContainer';
import { sendMessage } from './api/chatApi'; // Import the new API function

const typingVelocity = 50; // Still used by typeText, which will be removed shortly
const threads = [{
  "role": "system",
  "content": "You are interacting with a user who is a KnowledgeAgent. Your role is to assist them."
}];

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState("CloudWalk Knowledge Agent");

  const [history, setHistory] = useState([]);
  const [threadCleared, setThreadCleared] = useState(false);
  const [threadId, setThreadId] = useState(uuidv4());
  const [work, setWork] = useState('KnowledgeAgent');
  const [pdfLoading, setPdfLoading] = useState(false); // No longer used for PDF, but keeping for loading state example
  const [jsonResponse, setJsonResponse] = useState(null); // New state for JSON response
  const typingIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTypingInterval();
      clearThread();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pdfLoading]);

  const typeText = (text, setter, onComplete) => {
    let typedText = '';
    let idx = 0;
    typingIntervalRef.current = setInterval(() => {
      if (idx < text.length) {
        typedText += text[idx];
        setter(typedText);
        idx++;
      } else {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        if (onComplete) onComplete();
      }
    }, typingVelocity);
  };

  const clearTypingInterval = () => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
  };

  const handleInputChange = event => {
    setInputText(event.target.value);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const userMessageContent = inputText;
      const userMessage = `Me: ${userMessageContent}`;
      updateMessages({ text: userMessage, content: userMessage, role: 'user' });
      setHistory(history => [...history, userMessage]);

      const systemIndicator = { text: "...", role: 'system', loading: true };
      updateMessages(systemIndicator);

      try {
        const userId = "brenio"; // Hardcoded user_id for now
        const conversationId = threadId; // Using existing threadId as conversation_id
        const data = await sendMessage(userMessageContent, userId, conversationId);
        handleApiResponse(data);
      } catch (error) {
        handleApiError(error);
      }

      setInputText('');
    }
  };

  const handleApiResponse = (data) => {
    setJsonResponse(data); // Store the raw JSON response
    if (data && data.response) {
      const systemMessage = createSystemMessage(data.response);
      updateMessages(systemMessage, true);
      setHistory(history => [...history, `System: ${data.response}`]);

      // Update threads with the system response
      threads.push({ role: 'system', content: data.response });
    } else {
      throw new Error('No valid response from system');
    }
  };

  const handleApiError = (error) => {
    console.error("Error:", error);
    const errorMessage = createSystemMessage(`No Return from System. Please, try again later. Error: ${error.message}`, true);
    updateMessages(errorMessage);
    setHistory(history => [...history, `System: No Return from System. Please, try again later. Error: ${error.message}`]);

    // Update threads with the error message
    threads.push({ role: 'system', content: `No Return from System. Please, try again later. Error: ${error.message}` });
  };

  const createSystemMessage = (message, isError = false) => {
    return {
      text: (
        <span>
          <span className="system-label">System: </span>
          <span className="system-text">{message}</span>
        </span>
      ),
      content: 'System: ' + message,
      role: 'system',
      error: isError
    };
  };

  const updateMessages = (newMessage, removeLoading = false) => {
    if (newMessage.text !== "...") threads.push(newMessage);

    setMessages(messages => {
      if (removeLoading) {
        return messages.filter(msg => msg.text !== "...").concat(newMessage);
      } else {
        return messages.concat(newMessage);
      }
    });
  };

  const clearThread = async () => {
    setThreadId(uuidv4());
    setMessages([]);
    setHistory([]);
    setThreadCleared(true);
    setTimeout(() => setThreadCleared(false), 3000);

    console.log('Clearing thread:', threadId);

    threads.length = 0;
    threads.push({
      "role": "system",
      "content": "You are interacting with a user who is a KnowledgeAgent. Your role is to assist them."
    });
    setJsonResponse(null); // Clear JSON response on thread clear
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="home">
      <>
        <div className="chat-info">
          <p>User ID: brenio</p>
          <p>Chat ID: {threadId}</p>
        </div>
        <h2>{title}</h2>
        <ChatContainer
          messages={messages}
          inputText={inputText}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          clearThread={clearThread}
          chatEndRef={chatEndRef}
        />
        {jsonResponse && (
          <div className="json-response-container">
            <h4>Backend JSON Response:</h4>
            <pre className="json-display">{JSON.stringify(jsonResponse, null, 2)}</pre>
          </div>
        )}
      </>
      {threadCleared && <div className="thread-cleared">The Thread was cleared</div>}
    </div>
  );
}

export default Home;
