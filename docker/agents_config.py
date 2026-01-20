"""
Agent Configuration
Define different agents with different personalities, capabilities, and LLM models
"""

AGENTS = {
    "general": {
        "name": "General Assistant",
        "model": "agent-balanced",  # Uses Llama 3.1 8B via Ollama
        "system_prompt": "You are a helpful AI assistant.",
        "temperature": 0.7,
        "max_tokens": 2048,
        "description": "Balanced model for general conversation"
    },

    "fast": {
        "name": "Quick Response Agent",
        "model": "agent-fast",  # Uses Llama 3.2 3B via Ollama
        "system_prompt": "You are a quick and efficient assistant. Provide concise, helpful answers.",
        "temperature": 0.7,
        "max_tokens": 1024,
        "description": "Fast responses for simple queries"
    },

    "researcher": {
        "name": "Research Agent",
        "model": "agent-powerful",  # Uses Llama 3.1 70B via Ollama
        "system_prompt": "You are an expert research assistant. Provide detailed, well-researched answers with citations when possible.",
        "temperature": 0.5,
        "max_tokens": 4096,
        "description": "Deep research and analysis"
    },

    "coder": {
        "name": "Code Assistant",
        "model": "agent-coder",  # Uses CodeLlama 13B via Ollama
        "system_prompt": "You are an expert programming assistant. Provide clear, well-documented code with explanations.",
        "temperature": 0.3,
        "max_tokens": 4096,
        "description": "Specialized in coding tasks"
    },

    "cloud-fast": {
        "name": "Cloud Quick Agent",
        "model": "agent-cloud-fast",  # Uses Claude Haiku
        "system_prompt": "You are a helpful AI assistant.",
        "temperature": 0.7,
        "max_tokens": 2048,
        "description": "Fast cloud-based responses"
    },

    "cloud-expert": {
        "name": "Cloud Expert Agent",
        "model": "agent-cloud-balanced",  # Uses Claude Sonnet
        "system_prompt": "You are an expert AI assistant with deep knowledge across many domains.",
        "temperature": 0.7,
        "max_tokens": 4096,
        "description": "Best quality cloud-based responses"
    },

    "creative": {
        "name": "Creative Writer",
        "model": "agent-balanced",  # Uses Llama 3.1 8B
        "system_prompt": "You are a creative writing assistant. Help users with stories, poems, and creative content.",
        "temperature": 0.9,
        "max_tokens": 4096,
        "description": "Creative and imaginative responses"
    },

    "teacher": {
        "name": "Teaching Assistant",
        "model": "agent-cloud-balanced",  # Uses Claude Sonnet
        "system_prompt": "You are a patient teaching assistant. Explain concepts clearly with examples and analogies.",
        "temperature": 0.6,
        "max_tokens": 3072,
        "description": "Educational and explanatory"
    }
}

# Default agent if none specified
DEFAULT_AGENT = "general"

def get_agent_config(agent_type=None):
    """Get configuration for a specific agent type"""
    if agent_type is None or agent_type not in AGENTS:
        agent_type = DEFAULT_AGENT
    return AGENTS[agent_type]

def list_agents():
    """List all available agents"""
    return [
        {
            "type": agent_type,
            "name": config["name"],
            "model": config["model"],
            "description": config["description"]
        }
        for agent_type, config in AGENTS.items()
    ]
