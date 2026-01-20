import React, { useState, useRef, useEffect } from 'react'
import WelcomeScreen from './WelcomeScreen'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

function ChatContainer({ messages, activeConversationId, isTyping, onSendMessage, onCreateTopicFromSelection, getTopicsForMessage, onSelectConversation }) {
  // Display model choices that match the Claude backend
  const [model, setModel] = useState('Claude 3 Haiku')

  return (
    <main className="chat-container">
      <div className="chat-header">
        <h1>AI Assistant</h1>
        <div className="model-selector">
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option>Claude 3 Haiku</option>
            <option>Claude 3 Sonnet</option>
            <option>Claude 3 Opus</option>
          </select>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestionClick={onSendMessage} />
        ) : (
          <MessageList 
            messages={messages}
            activeConversationId={activeConversationId}
            isTyping={isTyping}
            onCreateTopicFromSelection={onCreateTopicFromSelection}
            getTopicsForMessage={getTopicsForMessage}
            onSelectConversation={onSelectConversation}
          />
        )}
      </div>

      <MessageInput onSendMessage={onSendMessage} />
    </main>
  )
}

export default ChatContainer

