import React, { useState } from 'react';function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      setMessages([...messages, { text: inputText, sender: 'user' }]);
      setInputText('');
    }
  };

  return (
    <>
      <h2>Hi! Welcome to studyGPT!!</h2>
      <h3>Let me know what grade are you looking for, to me to create c: </h3>
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
