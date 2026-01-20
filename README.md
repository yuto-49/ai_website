# Modern AI Chat Interface

A beautiful, modern ChatGPT-like interface with improved UI/UX design.

## Features

- 🎨 **Modern Design**: Clean, gradient-based UI with smooth animations
- 🌓 **Dark/Light Mode**: Toggle between themes with persistent storage
- 💬 **Real-time Chat**: Smooth message animations and typing indicators
- 📱 **Responsive**: Works on desktop and mobile devices
- ⚡ **Fast & Smooth**: Optimized animations and transitions
- 🎯 **Better UX**: Improved spacing, typography, and visual hierarchy

## Getting Started

1. Open `index.html` in your web browser
2. Start chatting by typing a message
3. Use the theme toggle to switch between dark and light modes
4. Click "New Chat" to start a fresh conversation

## File Structure

```
.
├── index.html      # Main HTML structure
├── styles.css      # All styling and themes
├── script.js       # Interactive functionality
└── README.md       # This file
```

## Customization

### Colors
Edit the CSS variables in `styles.css` to customize the color scheme:

```css
:root {
    --accent-primary: #667eea;
    --accent-secondary: #764ba2;
    /* ... more variables */
}
```

### API Integration
Replace the `generateAIResponse()` function in `script.js` with your actual LLM API call:

```javascript
async function generateAIResponse(userMessage) {
    const response = await fetch('YOUR_API_ENDPOINT', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage })
    });
    const data = await response.json();
    return data.response;
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Free to use and modify for your projects.

