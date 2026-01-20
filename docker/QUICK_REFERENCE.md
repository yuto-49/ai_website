# Quick Reference - Docker Multi-LLM Setup

## 🚀 Getting Started

```bash
# Initial setup
./docker/setup.sh

# Or manual start
docker-compose up -d

# Download models
docker exec -it ai-ollama ollama pull llama3.2:3b
docker exec -it ai-ollama ollama pull llama3.1:8b
docker exec -it ai-ollama ollama pull codellama:13b
```

## 📍 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Your Chat App | http://localhost:3000 | Main application |
| Backend API | http://localhost:5001 | Flask server |
| LiteLLM Router | http://localhost:4000 | Model gateway |
| Ollama | http://localhost:11434 | Local LLM server |
| Open WebUI | http://localhost:8080 | Testing interface |

## 🤖 Available Agents

| Agent Type | Model | Use Case | Speed | Quality |
|------------|-------|----------|-------|---------|
| `fast` | Llama 3.2 3B | Quick answers | ⚡⚡⚡ | ⭐⭐ |
| `balanced` | Llama 3.1 8B | General chat | ⚡⚡ | ⭐⭐⭐ |
| `powerful` | Llama 3.1 70B | Complex tasks | ⚡ | ⭐⭐⭐⭐ |
| `coder` | CodeLlama 13B | Coding | ⚡⚡ | ⭐⭐⭐ |
| `cloud-fast` | Claude Haiku | Fast cloud | ⚡⚡⚡ | ⭐⭐⭐ |
| `cloud-balanced` | Claude Sonnet | Best cloud | ⚡⚡ | ⭐⭐⭐⭐⭐ |
| `researcher` | Llama 70B | Research | ⚡ | ⭐⭐⭐⭐ |
| `teacher` | Claude Sonnet | Education | ⚡⚡ | ⭐⭐⭐⭐⭐ |

## 🛠️ Common Commands

### Docker Management
```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f litellm

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Ollama Model Management
```bash
# List downloaded models
docker exec -it ai-ollama ollama list

# Download a model
docker exec -it ai-ollama ollama pull llama3.1:8b

# Remove a model
docker exec -it ai-ollama ollama rm llama3.1:70b

# Check running models
docker exec -it ai-ollama ollama ps
```

### Testing Agents
```bash
# Test fast agent
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "agent": "fast"}'

# Test coder agent
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a function to reverse a string", "agent": "coder"}'

# List all agents
curl http://localhost:5001/api/agents | jq
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates all services |
| `docker/litellm-config.yaml` | Model routing configuration |
| `docker/agents_config.py` | Agent definitions |
| `docker/Dockerfile.backend` | Backend container |
| `docker/Dockerfile.frontend` | Frontend container |

## 📊 Model Sizes

| Model | Size | RAM Needed | GPU VRAM |
|-------|------|------------|----------|
| Llama 3.2 3B | ~2GB | 4GB | 4GB |
| Llama 3.1 8B | ~5GB | 8GB | 8GB |
| CodeLlama 13B | ~7GB | 12GB | 12GB |
| Llama 3.1 70B | ~40GB | 64GB+ | 40GB+ |

## 🐛 Quick Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]
```

### Out of memory
```bash
# Use smaller models
docker exec -it ai-ollama ollama rm llama3.1:70b
docker exec -it ai-ollama ollama pull llama3.2:3b

# Check memory usage
docker stats
```

### Model not found
```bash
# Download the model
docker exec -it ai-ollama ollama pull [model-name]

# Check config matches
cat docker/litellm-config.yaml
```

### LiteLLM connection error
```bash
# Check LiteLLM is running
curl http://localhost:4000/health

# Check backend can reach it
docker exec -it ai-backend ping litellm

# Restart
docker-compose restart litellm backend
```

## 🔄 Development Workflow

### Making Changes

1. **Backend code changes**:
   - Edit `server.py`
   - Changes auto-reload (volume mounted)
   - Or restart: `docker-compose restart backend`

2. **Frontend code changes**:
   - Edit files in `src/`
   - Vite auto-reloads (volume mounted)
   - Or restart: `docker-compose restart frontend`

3. **Config changes**:
   - Edit `docker/litellm-config.yaml` or `docker/agents_config.py`
   - Restart: `docker-compose restart litellm backend`

4. **Docker changes**:
   - Edit `docker-compose.yml` or Dockerfiles
   - Rebuild: `docker-compose up -d --build`

## 🎯 Production Deployment

### Using Enhanced Server

Replace `server.py` with enhanced version:

```bash
# Backup original
cp server.py server_original.py

# Use enhanced server with multi-LLM support
cp docker/server_llm.py server.py
cp docker/agents_config.py .

# Restart
docker-compose restart backend
```

### Environment Variables

```bash
# Required for cloud models
ANTHROPIC_API_KEY=sk-ant-...

# Optional
OPENAI_API_KEY=sk-...
HUGGING_FACE_HUB_TOKEN=hf_...
```

## 📈 Scaling Tips

### Horizontal Scaling
- Run multiple backend instances
- Use load balancer (nginx)
- LiteLLM handles model routing

### Vertical Scaling
- Increase Docker resource limits
- Use GPU acceleration
- Add more powerful models

### Cost Optimization
- Use local models for dev/test
- Route to cloud only when needed
- Cache responses
- Use smaller models when appropriate

## 🎓 Next Steps

1. **Customize agents** - Edit `docker/agents_config.py`
2. **Add models** - Edit `docker/litellm-config.yaml`
3. **UI enhancement** - Add agent selector to frontend
4. **Monitoring** - Add logging and metrics
5. **Production** - Add SSL, authentication, rate limiting

---

**Full documentation**: See `DOCKER_LLM_SETUP.md`
