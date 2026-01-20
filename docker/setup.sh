#!/bin/bash
# Setup script for Docker LLM infrastructure

set -e

echo "🚀 AI Website Docker Setup"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from template...${NC}"
    if [ -f env.example ]; then
        cp env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env and add your API keys!${NC}"
        echo ""
    else
        echo -e "${RED}❌ env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Check for API key
if grep -q "your_" .env; then
    echo -e "${YELLOW}⚠️  Warning: .env contains placeholder values${NC}"
    echo -e "${YELLOW}   Please update with real API keys for cloud models${NC}"
    echo ""
fi

# Start containers
echo "📦 Starting Docker containers..."
echo ""
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo ""
echo "🔍 Checking service status..."
echo ""

# Check Ollama
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is running (port 11434)${NC}"
else
    echo -e "${RED}❌ Ollama is not responding${NC}"
fi

# Check LiteLLM
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ LiteLLM is running (port 4000)${NC}"
else
    echo -e "${YELLOW}⚠️  LiteLLM is not responding yet (may still be starting)${NC}"
fi

# Check Backend
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running (port 5001)${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is not responding yet (may still be starting)${NC}"
fi

# Check Frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running (port 3000)${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is not responding yet (may still be starting)${NC}"
fi

echo ""
echo "📥 Downloading recommended models to Ollama..."
echo "   This may take a while depending on your internet speed..."
echo ""

# Download models
declare -a models=("llama3.2:3b" "llama3.1:8b" "codellama:13b")

for model in "${models[@]}"
do
    echo "⬇️  Pulling $model..."
    docker exec ai-ollama ollama pull "$model" || echo -e "${YELLOW}⚠️  Failed to pull $model${NC}"
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📍 Access your services:"
echo "   • Your Chat App:  http://localhost:3000"
echo "   • Backend API:    http://localhost:5001"
echo "   • LiteLLM Router: http://localhost:4000"
echo "   • Open WebUI:     http://localhost:8080"
echo ""
echo "🎯 Useful commands:"
echo "   • View logs:        docker-compose logs -f"
echo "   • Stop services:    docker-compose down"
echo "   • Restart:          docker-compose restart"
echo "   • List models:      docker exec -it ai-ollama ollama list"
echo ""
echo "📚 Read DOCKER_LLM_SETUP.md for detailed documentation"
echo ""
