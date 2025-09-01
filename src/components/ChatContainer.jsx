import React from 'react';
import LoadingDots from './LoadingDots';

const ChatContainer = ({
  messages,
  inputText,
  handleInputChange,
  handleSubmit,
  clearThread,
  chatEndRef,
}) => {
  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}${message.error ? " error" : ""}`}>
            {message.loading ? <LoadingDots /> : message.text}
          </div>
        ))}
       
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="buttonFlex">
          <div className="flex" style={{width: '100%'}}>
            <input type="text" placeholder="Type your message..." value={inputText} onChange={handleInputChange} />
            
          </div>
          <div className="flex" style={{gap: '10px'}}>
            <button type="submit">Send</button>
            <button type="button" onClick={clearThread}>Clear Thread</button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatContainer;
