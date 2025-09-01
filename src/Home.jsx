import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import LoadingDots from './components/LoadingDots';
import ChatContainer from './components/ChatContainer';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;
const apiUrl = import.meta.env.VITE_API_URL;
const programMode = import.meta.env.VITE_PROGRAM_MODE;

const typingVelocity = 50;
const threads = [{
  "role": "system",
  "content": "You are interacting with a user who is a KnowledgeAgent. Your role is to assist them."
}];

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState("CloudWalk Knowledge Agent");
  const [subTitle, setSubTitle] = useState("How can I assist you today?");
  const [history, setHistory] = useState([]);
  const [threadCleared, setThreadCleared] = useState(false);
  const [threadId, setThreadId] = useState(uuidv4());
  const [work, setWork] = useState('KnowledgeAgent'); // Set default to KnowledgeAgent
  const [pdfLoading, setPdfLoading] = useState(false);
  const typingIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // The initial welcome message and role selection are removed.
    // The 'work' state is now always 'KnowledgeAgent', so this effect is no longer needed for initial setup.
    return () => {
      clearTypingInterval();
      clearThread();
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

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

  // handleRoleSelection is no longer needed as role is defaulted

  const handleInputChange = event => {
    setInputText(event.target.value);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const userMessage = `Me: ${inputText}`;
      updateMessages({ text: userMessage, content: userMessage, role: 'user' });
      setHistory(history => [...history, userMessage]);

      const systemIndicator = { text: "...", role: 'system', loading: true };
      updateMessages(systemIndicator);

      const apiPath = `${apiUrl}/require-chat`;
      console.log('Sending request to API:', { thread: threads });
      if (programMode === 'local') console.log('API path called:', apiPath);

      try {
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${programMode === 'local' ? apiKeyGlobal : 'hidden'}`,
          },
          body: JSON.stringify({ thread: threads }),
        });

        if (!response.ok) throw new Error('No response from system');
        const data = await response.json();
        handleApiResponse(data);
      } catch (error) {
        handleApiError(error);
      }

      setInputText('');
    }
  };

  const handleApiResponse = (data) => {
    if (data && data.message) {
      const systemMessage = createSystemMessage(data.message);
      updateMessages(systemMessage, true);
      setHistory(history => [...history, `System: ${data.message}`]);

      // Update threads with the system response
      threads.push({ role: 'system', content: data.message });
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

    console.log('Clearing thread:', programMode === 'local' ? threadId : 'hidden');

    threads.length = 0;
    threads.push({
      "role": "system",
      "content": "You are interacting with a user who is a KnowledgeAgent. Your role is to assist them."
    });
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="home">
      <>
        <h2>{title}</h2>
        <h3>{subTitle}</h3>
        <ChatContainer
          messages={messages}
          inputText={inputText}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          
          clearThread={clearThread}
          
          chatEndRef={chatEndRef}
        />
      </>
      {threadCleared && <div className="thread-cleared">The Thread was cleared</div>}
    </div>
  );
}

export default Home;
