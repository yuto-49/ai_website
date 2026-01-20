# Claude-Powered Chat Website Setup Guide

## 🚀 Quick Start

### 1. Get Your Claude API Key

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it starts with `sk-ant-...`)

### 2. Install Dependencies

```bash
# Install Python packages
pip3 install -r requirements.txt
```

### 3. Set Your API Key

```bash
# Set environment variable (Mac/Linux)
export ANTHROPIC_API_KEY='your-api-key-here'

# Or add to your ~/.zshrc or ~/.bashrc for persistence:
echo 'export ANTHROPIC_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### 4. Start the Backend Server

```bash
# Start the Python Flask server
python3 server.py
```

You should see:
```
✅ API key loaded successfully
🚀 Server starting on http://localhost:5000
```

### 5. Start the Frontend Server

Open a new terminal and run:

```bash
# Start the web server
python3 -m http.server 8000
```

### 6. Open in Browser

Visit: **http://localhost:8000**

## 🎯 How It Works

```
Browser (localhost:8000)
    ↓
JavaScript (script.js)
    ↓
Flask Server (localhost:5000)
    ↓
Claude API
```

## 📁 File Structure

```
.
├── index.html          # Main HTML interface
├── styles.css          # Modern dark theme styling
├── script.js           # Frontend JavaScript (calls backend)
├── server.py           # Backend Flask server (calls Claude API)
├── requirements.txt    # Python dependencies
└── SETUP.md           # This file
```

## 🔧 Configuration

### Change Claude Model

Edit `server.py` line 29:

```python
model="claude-3-5-sonnet-20241022",  # Fast and capable
# model="claude-3-opus-20240229",    # Most powerful
# model="claude-3-haiku-20240307",   # Fastest and cheapest
```

### Adjust Response Length

Edit `server.py` line 30:

```python
max_tokens=1024,  # Increase for longer responses
```

## 🐛 Troubleshooting

### "API key not set" error
```bash
# Make sure to export the API key
export ANTHROPIC_API_KEY='your-key-here'
```

### "Connection refused" error
- Make sure both servers are running:
  - Backend: `python3 server.py` on port 5000
  - Frontend: `python3 -m http.server 8000` on port 8000

### CORS errors
- The Flask server has CORS enabled
- Make sure you're accessing via http://localhost:8000, not file://

## 💰 Cost Estimates

Claude API pricing (as of 2024):
- **Claude 3.5 Sonnet**: ~$3 per million input tokens, ~$15 per million output tokens
- **Claude 3 Haiku**: ~$0.25 per million input tokens, ~$1.25 per million output tokens

A typical conversation message costs less than $0.01.

## 🔒 Security Notes

- **Never commit your API key to git**
- The backend server keeps your API key secure
- Don't share your `ANTHROPIC_API_KEY` with anyone
- For production, use environment variables or secrets management

## 📚 Resources

- [Claude API Documentation](https://docs.anthropic.com/)
- [Anthropic Console](https://console.anthropic.com/)
- [Claude Pricing](https://www.anthropic.com/pricing)

## 🎨 Customization

- Edit `styles.css` to change colors and theme
- Modify `index.html` to change layout
- Update `script.js` to add features like:
  - Chat history saving
  - Message editing
  - Code syntax highlighting
  - File uploads

Enjoy your custom Claude-powered chat interface! 🚀
