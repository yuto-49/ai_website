import React, { useEffect, useRef } from 'react'
import Message from './Message'
import TypingIndicator from './TypingIndicator'

function MessageList({ messages, activeConversationId, isTyping, onCreateTopicFromSelection, getTopicsForMessage, onSelectConversation }) {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  return (
    <>
      {messages.map((message) => (
        <Message 
          key={message.id} 
          messageId={message.id}
          text={message.text} 
          sender={message.sender}
          activeConversationId={activeConversationId}
          onCreateTopicFromSelection={onCreateTopicFromSelection}
          getTopicsForMessage={getTopicsForMessage}
          onSelectConversation={onSelectConversation}
        />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </>
  )
}

export default MessageList

