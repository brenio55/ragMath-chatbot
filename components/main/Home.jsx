import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;
const apiUrl = import.meta.env.VITE_API_URL.replace('/requireResponseOpenAI', '');

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

  useEffect(() => {
    const typeText = (text, setter, onComplete) => {
      let typedText = '';
      let idx = 0;
      const interval = setInterval(() => {
        if (idx < text.length) {
          typedText += text[idx];
          setter(typedText);
          idx++;
        } else {
          clearInterval(interval);
          if (onComplete) onComplete();
        }
      }, typingVelocity);
    };

    typeText("Welcome! Are you a student or a teacher?", setTitle);

    return () => {
      clearThread();
    };
  }, []);

  const handleRoleSelection = (selectedRole) => {
    console.log('Role selected:', selectedRole);
    setRole(selectedRole);
    setTitle("Welcome! I'm the Last Second Teacher, how can I help you today?");
    setSubTitle("Let me know what grade you're looking for me to create :)");
  };

  const handleInputChange = event => {
    setInputText(event.target.value);
    // console.log('Input text changed:', event.target.value);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const userMessage = `Me: ${inputText}`;
      setMessages(messages => [...messages, { text: userMessage, sender: 'user' }]);
      setHistory(history => [...history, userMessage]);

      try {
        const systemIndicator = { text: "...", sender: 'system', loading: true };
        setMessages(messages => [...messages, systemIndicator]);

        console.log('Sending request to API:', { inputText, threadId, role });
        const response = await fetch(`${apiUrl}/requireResponseOpenAI`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyGlobal}`,
          },
          body: JSON.stringify({ inputText, threadId, role }),
        });

        if (!response.ok) throw new Error('No response from system');
        const data = await response.json();
        console.log('API response received:', data);

        if (data && data.message) {
          const systemMessage = (
            <span>
              <span className="system-label">System: </span>
              <span className="system-text">{data.message}</span>
            </span>
          );
          setMessages(messages => {
            return messages.filter(msg => msg.text !== "...").concat({ text: systemMessage, sender: 'system' });
          });
          setHistory(history => [...history, `System: ${data.message}`]);
        } else {
          throw new Error('No valid response from system');
        }
      } catch (error) {
        console.error("Error:", error);
        const errorMessage = (
          <span>
            <span className="system-label">System: </span>
            <span className="system-text">No Return from System. Please, try again later. Error: {error.message}</span>
          </span>
        );
        setMessages(messages => messages.filter(msg => msg.text !== "...").concat({ text: errorMessage, sender: 'system', error: true }));
        setHistory(history => [...history, `System: No Return from System. Please, try again later. Error: ${error.message}`]);
      }

      setInputText('');
    }
  };

  const clearThread = async () => {
    const oldThreadId = threadId;
    const newThreadId = uuidv4(); // Generate a new thread ID
    setThreadId(newThreadId);
    setMessages([]);
    setHistory([]);
    setThreadCleared(true);
    setTimeout(() => setThreadCleared(false), 3000);

    console.log('Clearing thread:', oldThreadId);
    try {
      const response = await fetch(`${apiUrl}/requireResponseOpenAI/clearThread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyGlobal}`,
        },
        body: JSON.stringify({ threadId: oldThreadId }),
      });
      console.log('Thread cleared response:', await response.json());
    } catch (error) {
      console.error('Error clearing thread:', error);
    }
  };

  const generatePDF = async () => {
    console.log('Generating PDF for thread:', threadId);
    try {
      const response = await fetch(`${apiUrl}/requireResponseOpenAI/generatePDF`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyGlobal}`,
        },
        body: JSON.stringify({ threadId }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'worksheet.pdf');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        console.log('PDF generated and download triggered');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
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

              <form onSubmit={handleSubmit} className="chat-input-form">
                <input type="text" placeholder="Type your message..." value={inputText} onChange={handleInputChange} />
                <button type="submit">Send</button>
                <button type="button" onClick={generatePDF}>Generate PDF</button>
                <button type="button" onClick={clearThread}>Clear Thread</button>
              </form>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2>{title}</h2>
          <button onClick={() => handleRoleSelection('student')}>I am a Student</button>
          <button onClick={() => handleRoleSelection('teacher')}>I am a Teacher</button>
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
