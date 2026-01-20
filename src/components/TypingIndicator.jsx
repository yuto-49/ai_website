import React from 'react'

function TypingIndicator() {
  return (
    <div className="message ai typing-message">
      <div className="message-avatar">AI</div>
      <div className="message-content">
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  )
}

export default TypingIndicator

