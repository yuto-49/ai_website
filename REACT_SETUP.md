# React Setup Guide

This guide explains how to use React with your chat application.

## Project Structure

The React version is set up alongside your existing vanilla JavaScript version:

- **Vanilla JS version**: `index.html`, `script.js`, `styles.css`
- **React version**: `src/` directory with React components

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

## Running the React Application

1. Start the Flask backend server (in one terminal):
```bash
python server.py
```

2. Start the React development server (in another terminal):
```bash
npm run dev
```

The React app will be available at `http://localhost:3000` and will automatically proxy API requests to your Flask backend at `http://localhost:5000`.

## Building for Production

To create a production build:

```bash
npm run build
```

This creates an optimized build in the `dist/` directory. You can preview it with:

```bash
npm run preview
```

## React Components Structure

```
src/
├── main.jsx              # React entry point
├── App.jsx               # Main app component
├── App.css              # App-specific styles
├── index.css            # Global styles
└── components/
    ├── Sidebar.jsx      # Sidebar component
    ├── ChatContainer.jsx # Main chat container
    ├── WelcomeScreen.jsx # Welcome screen with suggestions
    ├── MessageList.jsx  # Message list container
    ├── Message.jsx      # Individual message component
    ├── TypingIndicator.jsx # Typing animation
    └── MessageInput.jsx # Input component
```

## Key Features

- **Component-based architecture**: Each UI element is a reusable React component
- **State management**: Uses React hooks (`useState`, `useEffect`) for state management
- **Automatic API proxying**: Vite automatically proxies `/api` requests to your Flask backend
- **Hot Module Replacement**: Changes reflect instantly during development
- **Same styling**: Uses the same CSS as your vanilla JS version

## Differences from Vanilla JS Version

1. **State Management**: React manages component state instead of direct DOM manipulation
2. **Component Reusability**: UI elements are broken into reusable components
3. **Build Process**: Uses Vite for fast development and optimized production builds
4. **Modern JavaScript**: Uses JSX syntax and ES6+ features

## Development Tips

- The React app runs on port 3000, while Flask runs on port 5000
- API calls use relative paths (`/api/chat`) which are proxied to Flask
- All components are functional components using React hooks
- CSS is split into `index.css` (global) and `App.css` (component-specific)

## Switching Between Versions

- **Vanilla JS**: Open `index.html` directly in a browser
- **React**: Run `npm run dev` and open `http://localhost:3000`

Both versions work with the same Flask backend!

