import React, { useState, useRef, useEffect } from 'react'

function Message({ messageId, text, sender, activeConversationId, onCreateTopicFromSelection, getTopicsForMessage, onSelectConversation }) {
  const [showTopicMenu, setShowTopicMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState(null)
  const contentRef = useRef(null)
  const menuRef = useRef(null)

  // Get topics linked to this message
  const linkedTopics = getTopicsForMessage ? getTopicsForMessage(activeConversationId, messageId) : []

  // Handle text selection
  useEffect(() => {
    let timeoutId = null

    const handleSelection = () => {
      // Clear any pending timeout
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        const selection = window.getSelection()
        const selectedText = selection.toString().trim()
        
        if (selectedText && contentRef.current) {
          // Check if selection is within this message
          const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null
          if (range && contentRef.current.contains(range.commonAncestorContainer)) {
            const rect = range.getBoundingClientRect()
            const containerRect = contentRef.current.getBoundingClientRect()
            
            // Calculate character offsets within the message text
            // Get the full text content of the message (this is what we'll use for substring)
            const fullText = contentRef.current.textContent || contentRef.current.innerText || text
            
            // Try to calculate offset using Range API
            let startOffset = 0
            let endOffset = 0
            
            try {
              // Create a range from the start of the container to the start of the selection
              const preRange = document.createRange()
              preRange.selectNodeContents(contentRef.current)
              preRange.setEnd(range.startContainer, range.startOffset)
              startOffset = preRange.toString().length
              
              // End offset is start + selected text length
              endOffset = startOffset + selectedText.length
              
              // Verify: extract text using calculated offsets and compare
              const extractedText = fullText.substring(startOffset, endOffset)
              if (extractedText.trim() !== selectedText.trim() && Math.abs(extractedText.length - selectedText.length) > 2) {
                // If mismatch is significant, try to find the text in the full text
                const foundIndex = fullText.indexOf(selectedText)
                if (foundIndex !== -1) {
                  startOffset = foundIndex
                  endOffset = foundIndex + selectedText.length
                }
              }
            } catch (e) {
              // Fallback: find the selected text in the full text
              const foundIndex = fullText.indexOf(selectedText)
              if (foundIndex !== -1) {
                startOffset = foundIndex
                endOffset = foundIndex + selectedText.length
              } else {
                // Last resort: use 0 and selectedText length
                startOffset = 0
                endOffset = selectedText.length
              }
            }
            
            setSelectedText(selectedText)
            setSelectionRange({ start: startOffset, end: endOffset })
            setMenuPosition({
              x: rect.left - containerRect.left + rect.width / 2,
              y: rect.top - containerRect.top - 10
            })
            setShowTopicMenu(true)
          } else {
            setShowTopicMenu(false)
          }
        } else {
          setShowTopicMenu(false)
        }
      }, 100) // Small delay to avoid flickering
    }

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && 
          !contentRef.current?.contains(e.target)) {
        setShowTopicMenu(false)
        window.getSelection().removeAllRanges()
      }
    }

    document.addEventListener('selectionchange', handleSelection)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      document.removeEventListener('selectionchange', handleSelection)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleStartTopic = () => {
    if (selectedText && selectionRange && onCreateTopicFromSelection) {
      onCreateTopicFromSelection(activeConversationId, messageId, selectedText, selectionRange)
      setShowTopicMenu(false)
      window.getSelection().removeAllRanges()
    }
  }

  const handleTopicBadgeClick = (topicConversationId) => {
    if (onSelectConversation) {
      onSelectConversation(topicConversationId)
    }
  }

  return (
    <div className={`message ${sender}`}>
      <div className="message-avatar">
        {sender === 'user' ? 'U' : 'AI'}
      </div>
      <div className="message-content-wrapper">
        <div 
          ref={contentRef}
          className="message-content"
          style={{ position: 'relative' }}
        >
          {text}
          {showTopicMenu && (
            <div 
              ref={menuRef}
              className="topic-menu"
              style={{
                position: 'absolute',
                left: `${menuPosition.x}px`,
                top: `${menuPosition.y}px`,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <button 
                className="start-topic-btn"
                onClick={handleStartTopic}
              >
                Start Topic
              </button>
            </div>
          )}
        </div>
        {linkedTopics.length > 0 && (
          <div className="topic-badges">
            {linkedTopics.map((edge) => {
              // Extract highlight text from current message using selectionRange
              let highlightText = 'Topic'
              if (edge.selectionRange) {
                try {
                  // Ensure we don't go out of bounds
                  const start = Math.max(0, Math.min(edge.selectionRange.start, text.length))
                  const end = Math.max(start, Math.min(edge.selectionRange.end, text.length))
                  highlightText = text.substring(start, end) || 'Topic'
                } catch (e) {
                  console.warn('Error extracting highlight text:', e)
                  highlightText = 'Topic'
                }
              }
              return (
                <button
                  key={edge.conversationId}
                  className="topic-badge"
                  onClick={() => handleTopicBadgeClick(edge.conversationId)}
                  title={`Jump to: ${highlightText}`}
                >
                  📌 {highlightText.slice(0, 20)}{highlightText.length > 20 ? '…' : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Message

