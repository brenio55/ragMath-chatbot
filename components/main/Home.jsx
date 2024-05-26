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
        const systemIndicator = { text: "System is writing...", sender: 'system' };
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
            setMessages(messages => {
              return messages.filter(msg => msg.text !== "System is writing...").concat({ text: `System: ${data.message}`, sender: 'system' });
            });
            setHistory(history => [...history, `System: ${data.message}`]);
        } else {
            throw new Error('No valid response from system');
        }
      } catch (error) {
        console.error("Error:", error);
        const errorMessage = `System: No Return from System. Please, try again later. Error: ${error.message}`;
        setMessages(messages => messages.filter(msg => msg.text !== "System is writing...").concat({ text: errorMessage, sender: 'system', error: true }));
        setHistory(history => [...history, errorMessage]);
      }

      setInputText('');
    }
  };

  const clearHistory = () => setHistory([]);

  return (
    <>
    <div className="home">
      <h2>{title}</h2>
      <h3>{subTitle}</h3>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}${message.error ? " error" : ""}`}>
              {message.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input type="text" placeholder="Type your message..." value={inputText} onChange={handleInputChange} />
          <button type="submit">Send</button>
          <button type="button" onClick={clearHistory}>Clear History</button>
        </form>
      </div>
    </div>
    </>
  );
}

export default Home;
