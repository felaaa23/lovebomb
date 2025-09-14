# Compliment Chat

A modern, AI-powered chat application where users can have 1-minute conversations with strangers (or AI) and share compliments. Built with React, TypeScript, Tailwind CSS, and OpenAI's ChatGPT API.

## Features

- 🤖 **AI Chatbot Integration**: Powered by OpenAI's GPT-3.5-turbo for realistic conversations
- ⏱️ **1-Minute Timer**: Quick, focused conversations with automatic timeout
- 💝 **Compliment Sharing**: Generate or manually enter compliments for both participants
- 🗳️ **Community Voting**: Vote on which compliments are better with live percentages
- 📊 **Statistics Dashboard**: Track your conversation performance and engagement
- 🎨 **Modern Dark UI**: Sleek, professional design inspired by Code Four
- 💾 **Data Persistence**: All conversations and votes saved locally

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up OpenAI API Key

1. Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a `.env.local` file in the root directory
3. Add your API key:

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**Important**: Replace `your_openai_api_key_here` with your actual OpenAI API key.

### 3. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is busy).

## How to Use

### AI Chatbot Mode

1. **Enable AI**: Click the "🤖 AI Off" button in the navigation to turn it on (it will show "🤖 AI On")
2. **Start Chat**: Click "Start Chat" to begin a conversation
3. **Chat Naturally**: Type messages and the AI will respond automatically as a friendly stranger
4. **Automatic Compliments**: When time runs out, the AI can generate compliments based on your conversation
5. **Vote**: Go to the Vote page to see and vote on conversations

### Manual Mode (AI Off)

1. **Start Chat**: Click "Start Chat" to begin a conversation
2. **Simulate**: Use the "Simulate" button to add responses from the "stranger"
3. **Manual Compliments**: Enter compliments manually when the timer ends
4. **Vote**: Vote on conversations in the Vote section

## Features Overview

### 🏠 Home Page
- Hero section with clear value proposition
- Step-by-step instructions
- Feature highlights
- Security badge (CJIS Equivalent)

### 💬 Chat Interface
- Real-time 1-minute timer with color-coded warnings
- AI-powered or manual conversation simulation
- Dynamic message bubbles with proper styling
- Automatic compliment generation (when AI is enabled)

### 🗳️ Voting System
- Browse all completed conversations
- Vote between Person 1 and Person 2 compliments
- Live percentage updates
- Navigation between conversations

### 📊 Statistics Dashboard
- Total chats and votes overview
- Individual conversation performance
- Detailed vote breakdowns
- Average win percentages

## Technical Details

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS with custom dark theme
- **AI**: OpenAI GPT-3.5-turbo API
- **Storage**: Local Storage for data persistence

### AI Integration
- Uses OpenAI's chat completions API
- Intelligent conversation context tracking
- Automatic compliment generation based on conversation history
- Fallback responses if API is unavailable

### Security
- API key stored in environment variables
- Client-side only (demo purposes)
- No server-side data storage

## Customization

### Colors and Theme
The app uses a dark theme with blue/cyan gradients. You can customize colors in the Tailwind classes throughout the components.

### AI Behavior
Modify the AI prompts in `src/openai.ts` to change how the chatbot behaves:
- Conversation style and tone
- Compliment generation approach
- Response length and format

### Timer Duration
Change the 60-second timer by modifying the `secondsLeft` initial state in the Chat component.

## API Costs

This application uses OpenAI's GPT-3.5-turbo model. Typical costs:
- ~$0.002 per 1K tokens for input
- ~$0.002 per 1K tokens for output
- Average conversation: ~$0.01-0.05 per chat

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and development.

## Support

If you encounter any issues:
1. Check that your OpenAI API key is correctly set
2. Ensure you have sufficient OpenAI credits
3. Check the browser console for error messages
4. Verify all dependencies are installed correctly

---

**Note**: This is a demo application. For production use, implement proper server-side API key management and user authentication.