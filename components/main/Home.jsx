import React, { useState, useEffect } from 'react';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY
console.log(apiKeyGlobal)


function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  // useEffect(() => {
  //   // Fetch messages from the API when the component mounts
  //   fetch('https://example.com/api/messages')
  //     .then(response => response.json())
  //     .then(data => setMessages(data))
  //     .catch(error => console.error('Error fetching messages:', error));
  // }, []); // Empty dependency array ensures this effect runs only once when the component mounts

  const handleInputChange = (event) => {
    setInputText(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      // Here you would send the inputText to your API, but for now, let's just add it to the local state
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
