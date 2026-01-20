#!/usr/bin/env python3
"""
Enhanced Flask server with multi-LLM support via LiteLLM
Supports multiple agents with different models (local and cloud)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
from anthropic.types import TextBlock
import os
from dotenv import load_dotenv
from openai import OpenAI
from agents_config import get_agent_config, list_agents, DEFAULT_AGENT

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# ===================================
# LLM Client Setup
# ===================================

# LiteLLM client (OpenAI-compatible)
litellm_client = None
if os.environ.get("LITELLM_BASE_URL"):
    litellm_client = OpenAI(
        base_url=os.environ.get("LITELLM_BASE_URL"),
        api_key="sk-1234"  # Dummy key for LiteLLM
    )
    print("✅ LiteLLM client configured")

# Direct Anthropic client (fallback)
anthropic_client = None
if os.environ.get("ANTHROPIC_API_KEY"):
    anthropic_client = anthropic.Anthropic(
        api_key=os.environ.get("ANTHROPIC_API_KEY")
    )
    print("✅ Anthropic client configured")

# ===================================
# Helper Functions
# ===================================

def call_litellm(model, messages, system_prompt=None, temperature=0.7, max_tokens=2048):
    """Call LiteLLM router with OpenAI-compatible API"""
    try:
        # Build messages array
        openai_messages = []

        if system_prompt:
            openai_messages.append({"role": "system", "content": system_prompt})

        openai_messages.extend(messages)

        # Call via LiteLLM
        response = litellm_client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return {
            "response": response.choices[0].message.content,
            "model": model,
            "backend": "litellm"
        }
    except Exception as e:
        print(f"LiteLLM error: {e}")
        raise

def call_anthropic_direct(model, messages, system_prompt=None, temperature=0.7, max_tokens=2048):
    """Direct call to Anthropic API (fallback)"""
    try:
        # Build API params
        api_params = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages
        }

        if system_prompt:
            api_params["system"] = system_prompt

        # Call Anthropic
        message = anthropic_client.messages.create(**api_params)

        # Extract response
        response_text = "".join(
            block.text for block in message.content if isinstance(block, TextBlock)
        )

        return {
            "response": response_text,
            "model": message.model,
            "backend": "anthropic-direct"
        }
    except Exception as e:
        print(f"Anthropic error: {e}")
        raise

def create_topic_summary(parent_messages, selected_text, agent_type=None):
    """Create a stable summary of the parent conversation context"""
    if not parent_messages:
        return None

    # Use fast model for summaries
    agent_config = get_agent_config("fast")

    conversation_context = "\n".join([
        f"{'User' if msg.get('sender') == 'user' else 'Assistant'}: {msg.get('text', '')}"
        for msg in parent_messages
    ])

    summary_prompt = f"""You are creating a stable summary of a conversation context for a topic thread.

The user selected this text from the parent conversation:
"{selected_text}"

Parent conversation context:
{conversation_context}

Create a concise summary (2-3 sentences) that captures the essential context relevant to the selected topic."""

    try:
        messages = [{"role": "user", "content": summary_prompt}]

        if litellm_client:
            result = call_litellm(
                model=agent_config["model"],
                messages=messages,
                temperature=0.5,
                max_tokens=200
            )
            return result["response"].strip()
        elif anthropic_client:
            result = call_anthropic_direct(
                model="claude-3-haiku-20240307",
                messages=messages,
                temperature=0.5,
                max_tokens=200
            )
            return result["response"].strip()
    except Exception as e:
        print(f"Error creating summary: {e}")
        return None

# ===================================
# API Routes
# ===================================

@app.route('/api/agents', methods=['GET'])
def get_agents():
    """List all available agents"""
    return jsonify({
        'agents': list_agents(),
        'default': DEFAULT_AGENT
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        user_message = data.get('message', '')
        context_pack = data.get('contextPack', None)

        # NEW: Get agent type from request (defaults to general)
        agent_type = data.get('agent', DEFAULT_AGENT)
        agent_config = get_agent_config(agent_type)

        if not user_message:
            return jsonify({'error': 'No message provided'}), 400

        # Build system prompt
        system_prompt = agent_config["system_prompt"]

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
                topic_summary = create_topic_summary(parent_messages, selected_text, agent_type)
            else:
                topic_summary = existing_summary

            # Build context for system prompt
            context_parts = []
            if topic_summary:
                context_parts.append(f"Topic Context (Long-term Memory):\n{topic_summary}")

            if selected_text:
                context_parts.append(f"\nThis topic thread was created from this selection:\n\"{selected_text}\"")

            if context_parts:
                system_prompt += "\n\n" + "\n".join(context_parts)

            # Add recent turns as working memory
            if recent_turns:
                working_memory = "\n\nRecent conversation (Working Memory):\n"
                for i, turn in enumerate(recent_turns, 1):
                    working_memory += f"\nTurn {i}:\nUser: {turn.get('user', '')}\nAssistant: {turn.get('assistant', '')}\n"
                user_message = working_memory + f"\nCurrent message:\n{user_message}"

        messages.append({"role": "user", "content": user_message})

        # Call appropriate LLM backend
        result = None

        # Try LiteLLM first (unified router)
        if litellm_client:
            try:
                result = call_litellm(
                    model=agent_config["model"],
                    messages=messages,
                    system_prompt=system_prompt,
                    temperature=agent_config["temperature"],
                    max_tokens=agent_config["max_tokens"]
                )
            except Exception as e:
                print(f"LiteLLM failed, trying direct Anthropic: {e}")
                # Fallback to direct Anthropic if LiteLLM fails
                if anthropic_client and "claude" in agent_config["model"]:
                    result = call_anthropic_direct(
                        model="claude-3-haiku-20240307",
                        messages=messages,
                        system_prompt=system_prompt,
                        temperature=agent_config["temperature"],
                        max_tokens=agent_config["max_tokens"]
                    )
        # Direct Anthropic if LiteLLM not available
        elif anthropic_client:
            result = call_anthropic_direct(
                model="claude-3-haiku-20240307",
                messages=messages,
                system_prompt=system_prompt,
                temperature=agent_config["temperature"],
                max_tokens=agent_config["max_tokens"]
            )

        if not result:
            return jsonify({'error': 'No LLM backend available'}), 500

        response_data = {
            'response': result["response"],
            'model': result["model"],
            'backend': result.get("backend", "unknown"),
            'agent': agent_type
        }

        # Include topic summary if needed
        if context_pack and context_pack.get('isTopicThread'):
            parent_messages = context_pack.get('parentMessages', [])
            selected_text = context_pack.get('selectedText', '')
            existing_summary = context_pack.get('topicSummary')

            if not existing_summary and parent_messages:
                topic_summary = create_topic_summary(parent_messages, selected_text, agent_type)
                if topic_summary:
                    response_data['topicSummary'] = topic_summary

        return jsonify(response_data)

    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    status = {
        'status': 'ok',
        'litellm': litellm_client is not None,
        'anthropic': anthropic_client is not None
    }
    return jsonify(status)

if __name__ == '__main__':
    # Check configuration
    if not litellm_client and not anthropic_client:
        print("⚠️  WARNING: No LLM backends configured!")
        print("Set LITELLM_BASE_URL or ANTHROPIC_API_KEY")
    else:
        print("✅ LLM backends configured successfully")

    print("\n🚀 Server starting on http://localhost:5001")
    print("📝 Available agents:", len(list_agents()))
    print("\n")

    app.run(debug=True, host='0.0.0.0', port=5001)
