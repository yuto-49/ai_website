import React from 'react'

const suggestions = [
  { title: 'Code Helper', description: 'Get help with programming questions' },
  { title: 'Creative Writing', description: 'Generate stories, poems, and more' },
  { title: 'Learning', description: 'Explain complex topics simply' },
  { title: 'Brainstorm', description: 'Generate ideas and solutions' }
]

function WelcomeScreen({ onSuggestionClick }) {
  const handleSuggestionClick = (suggestion) => {
    onSuggestionClick(`Help me with ${suggestion.toLowerCase()}`)
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <h2>How can I help you today?</h2>
      <div className="suggestion-cards">
        {suggestions.map((suggestion, index) => (
          <div 
            key={index}
            className="suggestion-card"
            onClick={() => handleSuggestionClick(suggestion.title)}
          >
            <h3>{suggestion.title}</h3>
            <p>{suggestion.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WelcomeScreen

