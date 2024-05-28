import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;
const apiUrl = import.meta.env.VITE_API_URL;
const programMode = import.meta.env.VITE_PROGRAM_MODE; // Read the program mode

const typingVelocity = 50; // Global typing speed, adjust as needed

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [history, setHistory] = useState([]);
  const [threadCleared, setThreadCleared] = useState(false);
  const [threadId, setThreadId] = useState(uuidv4()); // Generate a new thread ID
  const [role, setRole] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const typingIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!role) {
      typeText("Welcome! I'm the Last Second Teacher. Are you a student or a teacher?", setTitle);
      return () => {
        clearTypingInterval();
        clearThread();
      };
    }
  }, [role]);

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
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
  };

  const handleRoleSelection = (selectedRole) => {
    clearTypingInterval();
    console.log('Role selected:', selectedRole);
    setRole(selectedRole);
    setTitle("Last Second Teacher - AI Worksheet Generator");
    setSubTitle("Let me know what grade you're looking for me to create :)");
  };

  const handleInputChange = event => {
    setInputText(event.target.value);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const userMessage = `Me: ${inputText}`;
      updateMessages({ text: userMessage, sender: 'user' });
      setHistory(history => [...history, userMessage]);

      const systemIndicator = { text: "...", sender: 'system', loading: true };
      updateMessages(systemIndicator);

      const apiPath = `${apiUrl}/requireResponseOpenAI`;
      console.log('Sending request to API:', { inputText, threadId, role });
      if (programMode === 'local') {
        console.log('API path called:', apiPath);
      }

      try {
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${programMode === 'local' ? apiKeyGlobal : 'hidden'}`,
          },
          body: JSON.stringify({ inputText, threadId, role }),
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
    } else {
      throw new Error('No valid response from system');
    }
  };

  const handleApiError = (error) => {
    console.error("Error:", error);
    const errorMessage = createSystemMessage(`No Return from System. Please, try again later. Error: ${error.message}`, true);
    updateMessages(errorMessage);
    setHistory(history => [...history, `System: No Return from System. Please, try again later. Error: ${error.message}`]);
  };

  const createSystemMessage = (message, isError = false) => {
    return {
      text: (
        <span>
          <span className="system-label">System: </span>
          <span className="system-text">{message}</span>
        </span>
      ),
      sender: 'system',
      error: isError
    };
  };

  const updateMessages = (newMessage, removeLoading = false) => {
    setMessages(messages => {
      if (removeLoading) {
        return messages.filter(msg => msg.text !== "...").concat(newMessage);
      } else {
        return messages.concat(newMessage);
      }
    });
  };

  const clearThread = async () => {
    const oldThreadId = threadId;
    setThreadId(uuidv4());
    setMessages([]);
    setHistory([]);
    setThreadCleared(true);
    setTimeout(() => setThreadCleared(false), 3000);

    console.log('Clearing thread:', programMode === 'local' ? oldThreadId : 'hidden');
    try {
      const response = await fetch(`${apiUrl}/clearThread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${programMode === 'local' ? apiKeyGlobal : 'hidden'}`,
        },
        body: JSON.stringify({ threadId: oldThreadId }),
      });
      console.log('Thread cleared response:', await response.json());
    } catch (error) {
      console.log('Error clearing thread:', error);
      
    }
  };

  const generatePDF = async () => {
    setPdfLoading(true);
    const apiPath = `${apiUrl}/generatePDF`;
    console.log('Generating PDF for thread:', programMode === 'local' ? threadId : 'hidden');
    if (programMode === 'local') {
      console.log('API path called:', apiPath);
    }

    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${programMode === 'local' ? apiKeyGlobal : 'hidden'}`,
        },
        body: JSON.stringify({ threadId }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(new Blob([blob]));
        triggerPDFDownload(url);
        console.log('PDF generated and download triggered');

        const pdfMessage = createSystemMessage(
          `PDF generated successfully. <a href="${url}" download="worksheet.pdf">Download PDF again</a>`
        );
        updateMessages(pdfMessage);
        setHistory(history => [...history, 'System: PDF generated successfully.']);
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      handlePdfError(error);
    } finally {
      setPdfLoading(false);
    }
  };

  const triggerPDFDownload = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'worksheet.pdf');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  };

  const handlePdfError = (error) => {
    console.error('Error generating PDF:', error);
    const errorMessage = createSystemMessage(`Error generating PDF. Please try again later. Error: ${error.message}`, true);
    updateMessages(errorMessage);
    setHistory(history => [...history, `System: Error generating PDF. Please try again later. Error: ${error.message}`]);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="home">
      {role ? (
        <>
          <h2>{title}</h2>
          <h3>{subTitle}</h3>
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.sender}${message.error ? " error" : ""}`}>
                  {message.loading ? <LoadingDots /> : message.text}
                </div>
              ))}
              {pdfLoading && (
                <div className="message system">
                  <LoadingDots />
                  <span>Generating PDF...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="chat-input-form">
              <div className="buttonFlex">
                <div className="flex twoItems">
                  <input type="text" placeholder="Type your message..." value={inputText} onChange={handleInputChange} />
                  <button type="submit">Send</button>
                </div>
                <div className="flex twoItems">
                  <button type="button" onClick={generatePDF}>Generate PDF</button>
                  <button type="button" onClick={clearThread}>Clear Thread</button>
                </div>
              </div>
            </form>
          </div>
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <div className="buttonsInit">
            <button onClick={() => handleRoleSelection('student')}>I am a Student</button>
            <button onClick={() => handleRoleSelection('teacher')}>I am a Teacher</button>
          </div>
        </>
      )}
      {threadCleared && <div className="thread-cleared">The Thread was cleared</div>}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="loading-dots">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </div>
  );
}

export default Home;
