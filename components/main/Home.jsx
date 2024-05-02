import React, { useState, useEffect, useRef } from 'react';

const apiKeyGlobal = import.meta.env.VITE_LastSecondTeacherAPIKEY;

function Home() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');

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
      }, 100); // 100ms interval for each character
    };

    typeText("Welcome! I'm the Last Second Teacher, how can I help you today?", setTitle, () => {
      typeText("Let me know what grade you're looking for me to create :)", setSubTitle);
    });
  }, []);

  const handleInputChange = event => setInputText(event.target.value);

  const handleSubmit = async event => {
    event.preventDefault();
    if (inputText.trim() !== '') {
      const newMessages = [...messages, { text: `Me: ${inputText}`, sender: 'user' }];
      setMessages(newMessages);

      try {
        newMessages.push({ text: "System is writing...", sender: 'system' });
        setMessages([...newMessages]);

        const response = await fetch('/API/requireResponseOpenAI.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyGlobal}`,
          },
          body: JSON.stringify({ inputText }),
        });

        if (!response.ok) throw new Error('No response from system');

        const data = await response.json();

        if (data && data.Response) {
          newMessages.pop(); // Remove "writing" indicator
          setMessages([...newMessages]);

          // Typewriter effect for system response
          const typeText = (text, onComplete) => {
            let typedText = '';
            let idx = 0;
            const interval = setInterval(() => {
              if (idx < text.length) {
                typedText += text[idx];
                setMessages(currentMessages => {
                  const newMessages = [...currentMessages];
                  if (newMessages.length > 0 && newMessages[newMessages.length - 1].sender === 'system') {
                    newMessages[newMessages.length - 1].text = `System: ${typedText}`;
                  } else {
                    newMessages.push({ text: `System: ${typedText}`, sender: 'system' });
                  }
                  return newMessages;
                });
                idx++;
              } else {
                clearInterval(interval);
                if (onComplete) onComplete();
              }
            }, 100);
          };

          typeText(data.Response, () => {});
        } else {
          throw new Error('No Return from System');
        }

      } catch (error) {
        console.error("Error:", error);

        newMessages.pop(); // Remove "writing" indicator
        newMessages.push({ text: 'System: No Return from System. Please, try again later.', sender: 'system', error: true });
        setMessages([...newMessages]);
      }

      setInputText('');
    }
  };

  return (
    <>
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
          <input
            type="text"
            placeholder="Type your message..."
            value={inputText}
            onChange={handleInputChange}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </>
  );
}

export default Home;
