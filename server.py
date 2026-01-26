#!/usr/bin/env python3
"""
Flask server with extensible agentic system
Supports multiple AI agents that can run in parallel or sequentially
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
from anthropic.types import TextBlock
import google.generativeai as genai
import os
from dotenv import load_dotenv
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Any, Optional

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for local development

# Initialize Claude client
# Get your API key from: https://console.anthropic.com/
client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)

# Initialize Gemini client
# Get your API key from: https://aistudio.google.com/app/apikey
google_api_key = os.environ.get("GOOGLE_API_KEY")
gemini_model = None
if google_api_key:
    genai.configure(api_key=google_api_key)
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')

# Thread pool for parallel agent execution
executor = ThreadPoolExecutor(max_workers=5)

# ============================================================================
# EXTENSIBLE AGENT SYSTEM
# ============================================================================

class AgentRegistry:
    """
    Registry for all available agents.
    Add new agents here to extend the system's capabilities.
    """

    @staticmethod
    def get_agent_config(agent_type: str) -> Optional[Dict]:
        """Get configuration for a specific agent type"""
        agents = {
            "brainstorming": {
                "name": "Brainstorming Agent",
                "model": "claude-3-haiku-20240307",
                "max_tokens": 300,
                "temperature": 0.9,
                "enabled": True,
                "execution": "parallel",  # can be "parallel" or "sequential"
                "description": "Generates creative topic ideas from conversations"
            },
            # Add more agents here in the future:
            # "summarizer": {...},
            # "fact_checker": {...},
            # "code_reviewer": {...},
        }
        return agents.get(agent_type)

    @staticmethod
    def get_enabled_agents() -> List[str]:
        """Get list of all enabled agents"""
        return ["brainstorming"]  # Add more as they're implemented


class AgentExecutor:
    """
    Executes agents based on their configuration.
    Supports both parallel and sequential execution.
    """

    @staticmethod
    def execute_brainstorming_agent(messages: List[Dict], context: Optional[Dict] = None) -> Dict:
        """
        Brainstorming Agent: Generates 1-3 divergent, interesting topic ideas
        based on the conversation.
        """
        config = AgentRegistry.get_agent_config("brainstorming")

        # Build conversation context for the agent
        conversation_text = "\n".join([
            f"{'User' if msg.get('sender') == 'user' else 'Assistant'}: {msg.get('text', '')}"
            for msg in messages[-6:]  # Last 3 turns (user + AI)
        ])

        prompt = f"""Based on this conversation, generate 1-3 short, divergent, interesting topic titles that could branch off from this discussion.

Conversation:
{conversation_text}

Requirements:
- Each title should be 3-7 words maximum
- Topics should be related but explore different angles
- Be creative and thought-provoking
- Return ONLY the titles, one per line
- No numbering, no explanations

Example format:
Future of quantum computing
Ethical implications of AI
Practical applications today"""

        try:
            response = client.messages.create(
                model=config["model"],
                max_tokens=config["max_tokens"],
                temperature=config["temperature"],
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract text
            response_text = "".join(
                block.text for block in response.content
                if isinstance(block, TextBlock)
            )

            # Parse ideas (one per line)
            ideas = [
                line.strip()
                for line in response_text.strip().split('\n')
                if line.strip() and len(line.strip()) > 3
            ][:3]  # Maximum 3 ideas

            return {
                "success": True,
                "ideas": ideas,
                "agent": "brainstorming"
            }

        except Exception as e:
            print(f"Brainstorming agent error: {e}")
            return {
                "success": False,
                "ideas": [],
                "error": str(e),
                "agent": "brainstorming"
            }

    @staticmethod
    def run_agents(messages: List[Dict], context: Optional[Dict] = None,
                   enabled_agents: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Execute all enabled agents in parallel or sequentially.
        Returns a dictionary of agent results.
        """
        if enabled_agents is None:
            enabled_agents = AgentRegistry.get_enabled_agents()

        results = {}

        # Separate parallel and sequential agents
        parallel_agents = []
        sequential_agents = []

        for agent_type in enabled_agents:
            config = AgentRegistry.get_agent_config(agent_type)
            if config and config.get("enabled"):
                if config.get("execution") == "parallel":
                    parallel_agents.append(agent_type)
                else:
                    sequential_agents.append(agent_type)

        # Execute parallel agents
        if parallel_agents:
            futures = {}
            for agent_type in parallel_agents:
                if agent_type == "brainstorming":
                    futures[agent_type] = executor.submit(
                        AgentExecutor.execute_brainstorming_agent,
                        messages,
                        context
                    )
                # Add more agent types here as they're implemented

            # Collect results
            for agent_type, future in futures.items():
                try:
                    results[agent_type] = future.result(timeout=10)
                except Exception as e:
                    print(f"Agent {agent_type} failed: {e}")
                    results[agent_type] = {
                        "success": False,
                        "error": str(e),
                        "agent": agent_type
                    }

        # Execute sequential agents (for future use)
        for agent_type in sequential_agents:
            # Sequential execution would go here
            pass

        return results

# ============================================================================
# END AGENT SYSTEM
# ============================================================================

def create_topic_summary(parent_messages, selected_text):
    """Create a stable summary of the parent conversation context for a topic thread."""
    if not parent_messages:
        return None
    
    # Format parent messages for summarization
    conversation_context = "\n".join([
        f"{'User' if msg.get('sender') == 'user' else 'Assistant'}: {msg.get('text', '')}"
        for msg in parent_messages
    ])
    
    summary_prompt = f"""You are creating a stable summary of a conversation context for a topic thread.

The user selected this text from the parent conversation:
"{selected_text}"

Parent conversation context:
{conversation_context}

Create a concise summary (2-3 sentences) that captures the essential context relevant to the selected topic. This summary will serve as "long-term memory" for the topic thread."""
    
    try:
        summary_response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=200,
            messages=[{"role": "user", "content": summary_prompt}]
        )
        summary_text = "".join(
            block.text for block in summary_response.content 
            if isinstance(block, TextBlock)
        )
        return summary_text.strip()
    except Exception as e:
        print(f"Error creating topic summary: {e}")
        return None

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        user_message = data.get('message', '')
        context_pack = data.get('contextPack', None)
        # Allow frontend to control which agents to run
        enabled_agents = data.get('enabledAgents', None)
        # Model provider: 'claude' or 'gemini'
        model_provider = data.get('modelProvider', 'claude')

        if not user_message:
            return jsonify({'error': 'No message provided'}), 400

        # Build system prompt
        system_prompt = "You are a helpful AI assistant."

        # Build messages array
        messages = []

        # Handle topic thread context
        if context_pack and context_pack.get('isTopicThread'):
            selected_text = context_pack.get('selectedText', '')
            parent_messages = context_pack.get('parentMessages', [])
            existing_summary = context_pack.get('topicSummary')
            recent_turns = context_pack.get('recentTurns', [])

            # Create or use existing topic summary
            if not existing_summary and parent_messages:
                topic_summary = create_topic_summary(parent_messages, selected_text)
            else:
                topic_summary = existing_summary

            # Build context for system prompt (long-term memory)
            context_parts = []
            if topic_summary:
                context_parts.append(f"Topic Context (Long-term Memory):\n{topic_summary}")

            if selected_text:
                context_parts.append(f"\nThis topic thread was created from this selection:\n\"{selected_text}\"")

            if context_parts:
                system_prompt += "\n\n" + "\n".join(context_parts)

            # Add recent turns as working memory (last 2-4 turns)
            if recent_turns:
                working_memory = "\n\nRecent conversation (Working Memory):\n"
                for i, turn in enumerate(recent_turns, 1):
                    working_memory += f"\nTurn {i}:\nUser: {turn.get('user', '')}\nAssistant: {turn.get('assistant', '')}\n"
                # Prepend working memory to the user message
                user_message = working_memory + f"\nCurrent message:\n{user_message}"
            else:
                user_message = user_message
        else:
            user_message = user_message

        messages.append({"role": "user", "content": user_message})

        # Route to appropriate model provider
        if model_provider == 'gemini':
            # Use Gemini API
            if not gemini_model:
                return jsonify({'error': 'Gemini API key not configured. Add GOOGLE_API_KEY to your .env file.'}), 500

            # Build prompt with system context for Gemini
            gemini_prompt = user_message
            if system_prompt != "You are a helpful AI assistant.":
                gemini_prompt = f"{system_prompt}\n\n{user_message}"

            gemini_response = gemini_model.generate_content(gemini_prompt)
            response_text = gemini_response.text
            model_name = 'gemini-1.5-flash'
        else:
            # Use Claude API (default)
            # Use a stable, widely available model
            # If this doesn't work, check your API key has access to Claude models
            api_params = {
                "model": "claude-3-haiku-20240307",  # Most reliable and widely available
                # Alternative models to try if above doesn't work:
                # "claude-3-sonnet-20240229"
                # "claude-3-opus-20240229"
                "max_tokens": 2048,
                "messages": messages
            }

            # Only add system prompt if it's been customized
            if system_prompt != "You are a helpful AI assistant.":
                api_params["system"] = system_prompt

            message = client.messages.create(**api_params)

            # Extract response text
            # Combine only text blocks to avoid type errors on other block types
            response_text = "".join(
                block.text for block in message.content if isinstance(block, TextBlock)
            )
            model_name = message.model

        response_data = {
            'response': response_text,
            'model': model_name
        }

        # Include topic summary if this is a topic thread and we created one
        if context_pack and context_pack.get('isTopicThread'):
            parent_messages = context_pack.get('parentMessages', [])
            selected_text = context_pack.get('selectedText', '')
            existing_summary = context_pack.get('topicSummary')

            if not existing_summary and parent_messages:
                topic_summary = create_topic_summary(parent_messages, selected_text)
                if topic_summary:
                    response_data['topicSummary'] = topic_summary

        # ============================================================================
        # RUN AGENTIC SYSTEM IN PARALLEL
        # ============================================================================
        # Get current conversation context (need to reconstruct from frontend data)
        conversation_messages = data.get('conversationMessages', [])

        # Only run agents if we have conversation context
        if conversation_messages and len(conversation_messages) > 0:
            agent_results = AgentExecutor.run_agents(
                messages=conversation_messages,
                context=context_pack,
                enabled_agents=enabled_agents
            )

            # Add agent results to response
            if agent_results:
                response_data['agentResults'] = agent_results

        return jsonify(response_data)

    except anthropic.APIError as e:
        # Handle Anthropic API specific errors
        error_msg = f"Anthropic API Error: {e.message}"
        if "not_found_error" in str(e):
            error_msg += "\n\nPossible causes:"
            error_msg += "\n1. Model name is incorrect or deprecated"
            error_msg += "\n2. Your API key doesn't have access to this model"
            error_msg += "\n3. Check Anthropic console for available models"
        print(f"API Error: {e}")  # Log to server console
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        print(f"Unexpected error: {e}")  # Log to server console
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # Check if API keys are set
    print("\n--- API Key Status ---")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("⚠️  WARNING: ANTHROPIC_API_KEY not set! Claude models will not work.")
        print("   Get your key from: https://console.anthropic.com/")
    else:
        print("✅ Anthropic API key loaded (Claude models available)")

    if not os.environ.get("GOOGLE_API_KEY"):
        print("⚠️  WARNING: GOOGLE_API_KEY not set! Gemini models will not work.")
        print("   Get your key from: https://aistudio.google.com/app/apikey")
    else:
        print("✅ Google API key loaded (Gemini models available)")

    print("\n🚀 Server starting on http://localhost:5001")
    print("ℹ️  Note: Using port 5001 to avoid macOS AirPlay conflict on port 5000\n")

    app.run(debug=True, port=5001)
