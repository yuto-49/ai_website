/**
 * Example: How to integrate agent selection into your React frontend
 *
 * This shows modifications to add agent selection to your existing App.jsx
 */

import { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatContainer from './components/ChatContainer';

function App() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  // NEW: Add agent state
  const [selectedAgent, setSelectedAgent] = useState('balanced');
  const [availableAgents, setAvailableAgents] = useState([]);

  // NEW: Fetch available agents on mount
  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        setAvailableAgents(data.agents);
        setSelectedAgent(data.default);
      })
      .catch(err => console.error('Failed to fetch agents:', err));
  }, []);

  // Ensure at least one conversation exists
  useEffect(() => {
    if (conversations.length === 0) {
      const initialConversation = {
        id: Date.now(),
        title: 'New Chat',
        messages: [],
        agent: selectedAgent  // NEW: Track agent per conversation
      };
      setConversations([initialConversation]);
      setActiveConversationId(initialConversation.id);
    }
  }, [conversations.length, selectedAgent]);

  const getActiveConversation = () => {
    return conversations.find(conv => conv.id === activeConversationId);
  };

  const handleNewConversation = () => {
    const newConversation = {
      id: Date.now(),
      title: 'New Chat',
      messages: [],
      agent: selectedAgent  // NEW: Use selected agent
    };
    setConversations([...conversations, newConversation]);
    setActiveConversationId(newConversation.id);
  };

  // MODIFIED: Include agent in API call
  const handleSendMessage = async (messageText) => {
    const activeConversation = getActiveConversation();
    if (!activeConversation) return;

    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    // Add user message to conversation
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, messages: [...conv.messages, userMessage] }
          : conv
      )
    );

    setIsTyping(true);

    try {
      // MODIFIED: Include agent in request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          agent: activeConversation.agent || selectedAgent  // NEW: Send agent type
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      // Create AI message
      const aiMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        model: data.model,  // Track which model was used
        backend: data.backend  // Track backend (litellm, anthropic-direct, etc)
      };

      // Add AI message to conversation
      setConversations(prevConversations =>
        prevConversations.map(conv =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, aiMessage],
                title: conv.messages.length === 0 ? messageText.slice(0, 30) + '...' : conv.title
              }
            : conv
        )
      );

    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${error.message}. Please check if the server is running.`,
        sender: 'ai',
        timestamp: new Date().toISOString()
      };

      setConversations(prevConversations =>
        prevConversations.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, messages: [...conv.messages, errorMessage] }
            : conv
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  // NEW: Handle agent change
  const handleAgentChange = (agentType) => {
    setSelectedAgent(agentType);

    // Update current conversation's agent
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, agent: agentType }
          : conv
      )
    );
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewConversation={handleNewConversation}
      />

      {/* NEW: Agent selector component */}
      <div className="agent-selector">
        <label htmlFor="agent-select">AI Agent:</label>
        <select
          id="agent-select"
          value={selectedAgent}
          onChange={(e) => handleAgentChange(e.target.value)}
          className="agent-dropdown"
        >
          {availableAgents.map(agent => (
            <option key={agent.type} value={agent.type}>
              {agent.name} - {agent.description}
            </option>
          ))}
        </select>
        <span className="current-model">
          {availableAgents.find(a => a.type === selectedAgent)?.model}
        </span>
      </div>

      <ChatContainer
        conversation={getActiveConversation()}
        onSendMessage={handleSendMessage}
        isTyping={isTyping}
      />
    </div>
  );
}

export default App;

/*
 * NEW: Add these styles to App.css
 */
const newStyles = `
.agent-selector {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.agent-selector label {
  font-weight: 600;
  color: #333;
}

.agent-dropdown {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  min-width: 250px;
}

.agent-dropdown:hover {
  border-color: #999;
}

.agent-dropdown:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.current-model {
  font-size: 12px;
  color: #666;
  font-family: monospace;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .agent-selector {
    background: rgba(30, 30, 30, 0.95);
  }

  .agent-selector label {
    color: #fff;
  }

  .agent-dropdown {
    background: #2a2a2a;
    color: #fff;
    border-color: #444;
  }

  .current-model {
    background: #1a1a1a;
    color: #aaa;
  }
}
`;
