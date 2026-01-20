#!/usr/bin/env python3
"""
Simple Flask server to handle Claude API requests
This keeps your API key secure on the server side
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
from anthropic.types import TextBlock
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for local development

# Initialize Claude client
# Get your API key from: https://console.anthropic.com/
client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)

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

        # Call Claude API
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

        response_data = {
            'response': response_text,
            'model': message.model
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
    # Check if API key is set
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("⚠️  WARNING: ANTHROPIC_API_KEY environment variable not set!")
        print("Set it in one of these ways:")
        print("  1. Create a .env file: cp env.example .env and add your key")
        print("  2. Export it: export ANTHROPIC_API_KEY='your-key-here'")
    else:
        print("✅ API key loaded successfully")

    print("\n🚀 Server starting on http://localhost:5001")
    print("📝 API key loaded from .env file or environment variable\n")
    print("ℹ️  Note: Using port 5001 to avoid macOS AirPlay conflict on port 5000\n")

    app.run(debug=True, port=5001)
