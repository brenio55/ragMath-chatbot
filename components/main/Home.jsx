import React, { useState } from 'react';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;
console.log(apiKeyGlobal);

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const newMessages = [...messages, { text: `Me: ${inputText}`, sender: 'user' }];

      try {
        const response = await fetch('/API/requireResponseOpenAI.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyGlobal}`
          },
          body: JSON.stringify({ inputText })
        });

        if (!response.ok) {
          throw new Error('No response from system');
        }

        const data = await response.json();
        if (data && data.Response) {
          newMessages.push({ text: `System: ${data.Response}`, sender: 'system' });
        } else {
          throw new Error('No Return from System');
        }

      } catch (error) {
        console.error('Error:', error);
        newMessages.push({ text: 'System: No Return from System. Please, try again later.', sender: 'system' });
      }

      setMessages(newMessages);
      setInputText('');
    }
  };

  return (
    <>
      <h2>Hi! Welcome to studyGPT!!</h2>
      <h3>Let me know what grade you're looking for me to create c:</h3>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}`}>
              {message.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            placeholder="Digite sua mensagem..."
            value={inputText}
            onChange={handleInputChange}
          />
          <button type="submit">Enviar</button>
        </form>
      </div>
    </>
  );
}

export default Home;
