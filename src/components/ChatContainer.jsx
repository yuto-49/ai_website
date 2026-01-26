import React, { useState, useRef, useEffect } from 'react'
import WelcomeScreen from './WelcomeScreen'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

// Model options with their provider mapping
const MODEL_OPTIONS = [
  { label: 'Claude 3 Haiku', provider: 'claude' },
  { label: 'Claude 3 Sonnet', provider: 'claude' },
  { label: 'Claude 3 Opus', provider: 'claude' },
  { label: 'Gemini 1.5 Flash', provider: 'gemini' },
  { label: 'Gemini 1.5 Pro', provider: 'gemini' },
]

function ChatContainer({ messages, activeConversationId, isTyping, onSendMessage, onCreateTopicFromSelection, getTopicsForMessage, onSelectConversation, selectedModel, onModelChange }) {
  const handleModelChange = (e) => {
    const selected = MODEL_OPTIONS.find(m => m.label === e.target.value)
    if (selected && onModelChange) {
      onModelChange({ provider: selected.provider, model: selected.label })
    }
  }

  return (
    <main className="chat-container">
      <div className="chat-header">
        <h1>AI Assistant</h1>
        <div className="model-selector">
          <select value={selectedModel?.model || 'Claude 3 Haiku'} onChange={handleModelChange}>
            {MODEL_OPTIONS.map(opt => (
              <option key={opt.label} value={opt.label}>{opt.label}</option>
            ))}
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

