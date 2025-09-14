import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Only for demo purposes
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function generateChatResponse(
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<string> {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a friendly stranger in a 1-minute compliment chat. Keep responses:
        - Short and conversational (1-2 sentences max)
        - Positive and engaging
        - Appropriate for a quick chat
        - Focus on being kind and interesting
        - Don't reveal you're an AI
        - Match the conversation tone and energy`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 100,
      temperature: 0.8,
    });

    return completion.choices[0]?.message?.content || "That's interesting! Tell me more.";
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback responses if API fails
    const fallbackResponses = [
      "That sounds really cool!",
      "I love that perspective!",
      "That's awesome to hear!",
      "You seem like a really interesting person!",
      "I'm enjoying our chat!",
      "That's a great point!",
      "Thanks for sharing that with me!",
      "You have such a positive vibe!",
    ];
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }
}

export async function generateCompliment(
  conversationHistory: ChatMessage[]
): Promise<{ person1: string; person2: string }> {
  try {
    const systemPrompt = `Generate two genuine, heartfelt compliments based on this conversation. 
    Make them:
    - Specific to the conversation content
    - Warm and authentic
    - Different from each other
    - Appropriate for a 1-minute chat
    - Focus on personality, communication style, or positive traits shown
    
    Return as JSON: {"person1": "compliment1", "person2": "compliment2"}`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory,
      {
        role: 'user',
        content: 'Please generate compliments for both people based on our conversation.'
      }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response);
      return {
        person1: parsed.person1 || "You have such a wonderful personality!",
        person2: parsed.person2 || "Your positive energy really brightened this chat!"
      };
    } catch {
      // If JSON parsing fails, generate simple compliments
      return {
        person1: "You have such a wonderful personality!",
        person2: "Your positive energy really brightened this chat!"
      };
    }
  } catch (error) {
    console.error('OpenAI API error for compliments:', error);
    // Fallback compliments
    const fallbackCompliments = [
      {
        person1: "You have such a thoughtful way of expressing yourself!",
        person2: "Your positive energy made this conversation so enjoyable!"
      },
      {
        person1: "You're such a great conversationalist!",
        person2: "Your kindness really shines through in everything you say!"
      },
      {
        person1: "You have such an interesting perspective on things!",
        person2: "Your enthusiasm is absolutely contagious!"
      }
    ];
    return fallbackCompliments[Math.floor(Math.random() * fallbackCompliments.length)];
  }
}
