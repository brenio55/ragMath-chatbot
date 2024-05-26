import React, { useState, useEffect } from 'react';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;
const apiUrl = import.meta.env.VITE_API_URL;
const typingVelocity = 50; // Global typing speed, adjust as needed

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [history, setHistory] = useState([]);
  const [threadCleared, setThreadCleared] = useState(false);

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

    typeText("Welcome! I'm the Last Second Teacher, how can I help you today?", setTitle, () => {
      typeText("Let me know what grade you're looking for me to create :)", setSubTitle);
    });
  }, []);

  const handleInputChange = event => setInputText(event.target.value);

  const handleSubmit = async event => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const userMessage = `Me: ${inputText}`;
      setMessages(messages => [...messages, { text: userMessage, sender: 'user' }]);
      setHistory(history => [...history, userMessage]);

      try {
        const systemIndicator = { text: "...", sender: 'system', loading: true };
        setMessages(messages => [...messages, systemIndicator]);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeyGlobal}`,
            },
            body: JSON.stringify({ inputText }),
        });

        if (!response.ok) throw new Error('No response from system');
        const data = await response.json();

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
    setMessages([]);
    setHistory([]);
    setThreadCleared(true);
    setTimeout(() => setThreadCleared(false), 3000);

    // Placeholder for clearing the thread in the API
    console.log('Awaiting for configuration of thread cleaning');

    try {
      await fetch(`${apiUrl}/clear-thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyGlobal}`,
        },
      });
    } catch (error) {
      console.error('Error clearing thread:', error);
    }
  };

  return (
    <>
      <div className="home">
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
              <button type="button" onClick={clearThread}>Clear Thread</button>
            </form>
          </div>
        </div>
      </div>
      {threadCleared && <div className="thread-cleared">The Thread was cleared</div>}
    </>
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
