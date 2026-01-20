# Docker Multi-LLM Setup Guide

Complete guide for running your AI chat application with multiple LLM backends in Docker.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│                   http://localhost:3000                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              React Frontend Container                        │
│                   Port: 3000                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Flask Backend Container                         │
│                   Port: 5001                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Agent Router                                         │  │
│  │  - Selects appropriate agent/model                    │  │
│  │  - Routes to LiteLLM or direct API                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              LiteLLM Router Container                        │
│                   Port: 4000                                 │
│  Unified OpenAI-compatible API for all models               │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
       ▼              ▼              ▼
   ┌────────┐    ┌────────┐    ┌──────────┐
   │Ollama  │    │ vLLM   │    │Anthropic │
   │(Local) │    │(Local) │    │ (Cloud)  │
   │Port:   │    │Port:   │    │   API    │
   │11434   │    │8000    │    │          │
   └────────┘    └────────┘    └──────────┘
     Local         Local         Cloud
   Llama 3      Mistral 7B    Claude API
```

---

## 📦 What's Included

### Services

1. **LiteLLM Router** - Unified API gateway for all LLM models
2. **Ollama** - Local LLM server (easy to use, runs Llama, Mistral, etc.)
3. **vLLM** - High-performance local inference (optional)
4. **Your Flask Backend** - Routes requests to appropriate agents/models
5. **Your React Frontend** - User interface
6. **Open WebUI** - Testing interface for LLMs (optional)

### 8 Pre-configured Agents

1. **Fast Agent** - Llama 3.2 3B (quick responses)
2. **Balanced Agent** - Llama 3.1 8B (general purpose)
3. **Powerful Agent** - Llama 3.1 70B (complex reasoning)
4. **Coder Agent** - CodeLlama 13B (coding tasks)
5. **Cloud Fast** - Claude Haiku (fast cloud)
6. **Cloud Balanced** - Claude Sonnet (best cloud)
7. **Creative Agent** - Llama 3.1 8B (creative writing)
8. **Teacher Agent** - Claude Sonnet (educational)

---

## 🚀 Quick Start

### Step 1: Prerequisites

```bash
# Required
- Docker Desktop installed
- Docker Compose installed
- At least 16GB RAM (32GB+ recommended for larger models)

# Optional (for GPU acceleration)
- NVIDIA GPU with Docker GPU support
- CUDA drivers installed
```

### Step 2: Environment Setup

Create/update your `.env` file:

```bash
# Copy from example
cp env.example .env

# Edit .env and add:
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional
OPENAI_API_KEY=your_openai_key_here
HUGGING_FACE_HUB_TOKEN=your_hf_token_here
```

### Step 3: Start Everything

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Step 4: Download Models to Ollama

```bash
# Download models (do this after containers are running)
docker exec -it ai-ollama ollama pull llama3.2:3b     # Fast model (~2GB)
docker exec -it ai-ollama ollama pull llama3.1:8b     # Balanced model (~4.7GB)
docker exec -it ai-ollama ollama pull codellama:13b   # Coder model (~7.3GB)

# Optional: Larger models (requires significant RAM/VRAM)
docker exec -it ai-ollama ollama pull llama3.1:70b    # Powerful model (~40GB)

# List downloaded models
docker exec -it ai-ollama ollama list
```

### Step 5: Access Your Applications

- **Your Chat App**: http://localhost:3000
- **LiteLLM Dashboard**: http://localhost:4000
- **Open WebUI** (testing): http://localhost:8080
- **Backend API**: http://localhost:5001/health

---

## 🎯 Using Different Agents

### Method 1: Via API (from frontend)

Update your frontend to send agent type:

```javascript
// In your App.jsx handleSendMessage function
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: messageText,
    agent: 'coder'  // Specify agent type
  })
});
```

### Method 2: Test via curl

```bash
# Test fast agent (local Llama 3.2 3B)
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, tell me a joke",
    "agent": "fast"
  }'

# Test coder agent (local CodeLlama)
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a Python function to reverse a string",
    "agent": "coder"
  }'

# Test cloud agent (Claude Sonnet)
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing",
    "agent": "cloud-balanced"
  }'
```

### Method 3: List Available Agents

```bash
curl http://localhost:5001/api/agents | jq
```

---

## 🔧 Configuration

### Adding New Models to Ollama

```bash
# Search for models
docker exec -it ai-ollama ollama list

# Pull a new model
docker exec -it ai-ollama ollama pull mistral:7b

# Add to litellm-config.yaml
```

### Editing LiteLLM Configuration

Edit `docker/litellm-config.yaml`:

```yaml
model_list:
  - model_name: my-custom-agent
    litellm_params:
      model: ollama/mistral:7b
      api_base: http://ollama:11434
      temperature: 0.7
    model_info:
      description: "My custom agent"
      use_case: "Custom use case"
```

Restart LiteLLM:
```bash
docker-compose restart litellm
```

### Adding New Agent Types

Edit `docker/agents_config.py`:

```python
"my-agent": {
    "name": "My Custom Agent",
    "model": "my-custom-agent",  # Must match LiteLLM config
    "system_prompt": "You are a custom agent...",
    "temperature": 0.7,
    "max_tokens": 2048,
    "description": "My custom agent description"
}
```

Restart backend:
```bash
docker-compose restart backend
```

---

## 📊 Model Comparison

| Agent | Model | Size | Speed | Quality | Cost | Best For |
|-------|-------|------|-------|---------|------|----------|
| fast | Llama 3.2 3B | ~2GB | ⚡⚡⚡ | ⭐⭐ | Free | Quick answers |
| balanced | Llama 3.1 8B | ~5GB | ⚡⚡ | ⭐⭐⭐ | Free | General chat |
| powerful | Llama 3.1 70B | ~40GB | ⚡ | ⭐⭐⭐⭐ | Free | Complex tasks |
| coder | CodeLlama 13B | ~7GB | ⚡⚡ | ⭐⭐⭐ | Free | Coding |
| cloud-fast | Claude Haiku | API | ⚡⚡⚡ | ⭐⭐⭐ | $ | Fast cloud |
| cloud-balanced | Claude Sonnet | API | ⚡⚡ | ⭐⭐⭐⭐⭐ | $$ | Best quality |
| cloud-powerful | Claude Opus | API | ⚡ | ⭐⭐⭐⭐⭐ | $$$ | Hardest tasks |

---

## 🎮 Advanced Usage

### Running Multiple Agents in Parallel

You can run multiple agents simultaneously for complex workflows:

```python
# Example: Get both a quick answer and detailed analysis
import asyncio
import aiohttp

async def multi_agent_query(question):
    async with aiohttp.ClientSession() as session:
        # Fast agent for quick answer
        fast_task = session.post('http://localhost:5001/api/chat', json={
            'message': question,
            'agent': 'fast'
        })

        # Research agent for detailed analysis
        research_task = session.post('http://localhost:5001/api/chat', json={
            'message': question,
            'agent': 'researcher'
        })

        # Run in parallel
        fast_result, research_result = await asyncio.gather(fast_task, research_task)

        return {
            'quick_answer': await fast_result.json(),
            'detailed_answer': await research_result.json()
        }
```

### Chaining Agents

Route tasks to different agents based on task type:

```python
def intelligent_routing(user_message):
    # Detect task type
    if 'code' in user_message.lower() or 'function' in user_message.lower():
        return 'coder'
    elif 'explain' in user_message.lower() or 'teach' in user_message.lower():
        return 'teacher'
    elif 'research' in user_message.lower():
        return 'researcher'
    elif 'quick' in user_message.lower():
        return 'fast'
    else:
        return 'balanced'
```

---

## 🐛 Troubleshooting

### Models Not Found

```bash
# Check if Ollama is running
docker logs ai-ollama

# List available models
docker exec -it ai-ollama ollama list

# Pull missing models
docker exec -it ai-ollama ollama pull llama3.2:3b
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Use smaller models or limit model loading
# Edit docker-compose.yml to only use smaller models
```

### LiteLLM Connection Issues

```bash
# Check LiteLLM logs
docker logs ai-litellm

# Test LiteLLM directly
curl http://localhost:4000/health

# Restart LiteLLM
docker-compose restart litellm
```

### Backend Can't Connect to LiteLLM

```bash
# Check network connectivity
docker exec -it ai-backend ping litellm

# Verify environment variable
docker exec -it ai-backend env | grep LITELLM
```

---

## 🔄 Switching Between Local and Cloud

### Cost-Optimized Strategy

1. Use **local models** for:
   - Development/testing
   - High-volume simple queries
   - Privacy-sensitive data
   - When internet is unreliable

2. Use **cloud models** for:
   - Production critical queries
   - Complex reasoning tasks
   - When local resources are limited
   - When highest quality is needed

### Easy Switching

In `docker/agents_config.py`, change the model for any agent:

```python
# Switch from local to cloud
"general": {
    "model": "agent-cloud-balanced",  # Was: agent-balanced
    ...
}

# Switch from cloud to local
"cloud-expert": {
    "model": "agent-powerful",  # Was: agent-cloud-powerful
    ...
}
```

---

## 📈 Performance Tips

### For CPU-only Systems

1. Use smaller models (3B, 7B, 8B)
2. Limit concurrent requests
3. Reduce `max_tokens` in agent configs
4. Use quantized models

```bash
# Pull quantized versions
docker exec -it ai-ollama ollama pull llama3.1:8b-instruct-q4_0
```

### For GPU Systems

1. Enable GPU support in docker-compose.yml (uncomment deploy sections)
2. Use larger models (13B, 70B)
3. Enable vLLM for best performance
4. Adjust batch sizes for throughput

### Memory Management

```bash
# Limit Ollama to specific models
docker exec -it ai-ollama ollama rm llama3.1:70b  # Remove large model

# Check loaded models
docker exec -it ai-ollama ollama ps
```

---

## 🔐 Security Notes

1. **API Keys**: Never commit `.env` to git
2. **Network**: Expose only necessary ports
3. **Production**: Use reverse proxy (nginx) with SSL
4. **Secrets**: Use Docker secrets for production
5. **Updates**: Regularly update container images

---

## 📚 Next Steps

### Enhance Your Frontend

Add agent selector to your UI:

```jsx
// Add to your React components
const [selectedAgent, setSelectedAgent] = useState('balanced');

// Agent selector dropdown
<select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
  <option value="fast">Quick Answer</option>
  <option value="balanced">General Chat</option>
  <option value="coder">Code Assistant</option>
  <option value="researcher">Deep Research</option>
  <option value="cloud-balanced">Cloud Expert</option>
</select>

// Include in message
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: text,
    agent: selectedAgent
  })
})
```

### Add More Models

1. **OpenAI**: Uncomment OpenAI sections in `litellm-config.yaml`
2. **Mistral**: Add Mistral models via Ollama or API
3. **Custom Models**: Host on vLLM, add to LiteLLM config

### Enable vLLM

1. Uncomment vLLM service in `docker-compose.yml`
2. Uncomment vLLM models in `litellm-config.yaml`
3. Requires GPU with sufficient VRAM

---

## 🎉 You're All Set!

You now have:
- ✅ Multiple LLMs running in Docker
- ✅ Unified API via LiteLLM
- ✅ 8 different agents for different tasks
- ✅ Easy switching between local and cloud
- ✅ Cost-effective local models
- ✅ High-quality cloud fallback

**Happy building!** 🚀
