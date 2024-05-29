import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;
const apiUrl = import.meta.env.VITE_API_URL;
const programMode = import.meta.env.VITE_PROGRAM_MODE;

const typingVelocity = 50;
const threads = [];

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [history, setHistory] = useState([]);
  const [threadCleared, setThreadCleared] = useState(false);
  const [threadId, setThreadId] = useState(uuidv4());
  const [work, setWork] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const typingIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!work) {
      // clearThread();
      typeText("Welcome! I'm the Last Second Teacher. Are you a student or a teacher?", setTitle);
      return () => {
        clearTypingInterval();
        clearThread();
      };
    }
  }, [work]);

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

  const handleRoleSelection = (selectedRole) => {
    clearTypingInterval();
    console.log('Role selected:', selectedRole);
    setWork(selectedRole);
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
      updateMessages({ text: userMessage, content: userMessage, role: 'user' });
      setHistory(history => [...history, userMessage]);

      const systemIndicator = { text: "...", role: 'system', loading: true };
      updateMessages(systemIndicator);

      const apiPath = `${apiUrl}/require-chat`;
      console.log('Sending request to API:', { thread: messages.filter((value) => value.text !== '...') });
      if (programMode === 'local') console.log('API path called:', apiPath);

      try {
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${programMode === 'local' ? apiKeyGlobal : 'hidden'}`,
          },
          body: JSON.stringify({ thread: messages.filter((value) => value.text !== '...') }),
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
      "content": `You are interacting with a user who is a ${work}. Your role is to assist them. If they ask about generating a worksheet, or just mention a worksheet topic, tell them to press the 'Generate PDF' button to create the worksheet.`
    });
  };

  const generatePDF = async () => {
    setPdfLoading(true);
    const apiPath = `${apiUrl}/generate-pdf`;
    console.log('Generating PDF for thread:', programMode === 'local' ? threadId : 'hidden');
    if (programMode === 'local') console.log('API path called:', apiPath);

    try {
      const thread = messages.filter(message => typeof message.text === 'string');
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${programMode === 'local' ? apiKeyGlobal : 'hidden'}`,
        },
        body: JSON.stringify({ thread })
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
      {work ? (
        <>
          <h2>{title}</h2>
          <h3>{subTitle}</h3>
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}${message.error ? " error" : ""}`}>
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
