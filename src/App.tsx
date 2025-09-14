import { useEffect, useMemo, useRef, useState } from "react";
import OpenAI from "openai";

// Custom hook for scroll-triggered animations
function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return [ref, isVisible] as const;
}

// --- Types ---
type Message = {
  id: string;
  author: "You" | "Stranger";
  text: string;
  ts: number;
};

type Conversation = {
  id: string;
  createdAt: number;
  messages: Message[];
  compliments?: { person1: string; stranger: string };
  votes?: { p1: number; p2: number };
  chatMode?: "ai" | "human";
  aiPersona?: { name: string; location: string; age: number; interests: string[] };
};

type MatchData = {
  roomId: string;
  partnerId: string;
  startTime: number;
  duration: number;
};

// Removed unused VotingPair type

// --- OpenAI Configuration ---
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// --- Utils ---
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Chatbot function
async function generateBotResponse(
  conversationHistory: Message[]
): Promise<string> {
  try {
    const systemPrompt = `You are a friendly, positive stranger in a 1-minute chat. Your goal is to have a pleasant conversation and be ready to give a genuine compliment at the end. Keep responses concise, engaging, and natural. Respond as if you're talking to someone new and interesting.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.author === "You" ? ("user" as const) : ("assistant" as const),
        content: msg.text,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 60,
      temperature: 0.8,
    });

    return (
      completion.choices[0]?.message?.content ||
      "That's really interesting! Tell me more."
    );
  } catch (error) {
    console.error("Error generating bot response:", error);
    return "I'm having trouble responding right now, but I'm enjoying our chat!";
  }
}

// Detect user's communication style
function detectCommunicationStyle(messages: Message[]): string {
  const userMessages = messages.filter(m => m.author === "You").map(m => m.text);
  if (userMessages.length === 0) return "neutral";
  
  const allText = userMessages.join(" ").toLowerCase();
  
  // Check for casual/slang indicators
  const casualIndicators = ["hey", "yo", "what's up", "lol", "omg", "btw", "tbh", "ngl", "fr", "lowkey", "highkey", "no cap", "bet", "slay", "period", "sis", "bro", "dude"];
  const formalIndicators = ["hello", "good morning", "good afternoon", "please", "thank you", "would", "could", "should", "may", "might"];
  
  const casualCount = casualIndicators.filter(indicator => allText.includes(indicator)).length;
  const formalCount = formalIndicators.filter(indicator => allText.includes(indicator)).length;
  
  // Check for punctuation patterns
  const exclamationCount = (allText.match(/!/g) || []).length;
  const capsCount = (allText.match(/[A-Z]/g) || []).length;
  
  if (casualCount > formalCount || exclamationCount > 2 || capsCount > 10) {
    return "casual";
  } else if (formalCount > casualCount) {
    return "formal";
  } else {
    return "neutral";
  }
}

// Generate human persona for the AI
function generateHumanPersona(): { name: string; location: string; age: number; interests: string[] } {
  const names = ["Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Avery", "Quinn", "Sage", "Blake"];
  const locations = ["San Diego", "Boston", "Seattle", "Austin", "Denver", "Portland", "Nashville", "Miami", "Chicago", "Phoenix"];
  const interests = [
    ["music", "hiking", "photography"],
    ["gaming", "movies", "cooking"],
    ["art", "travel", "fitness"],
    ["books", "coffee", "podcasts"],
    ["sports", "concerts", "food"],
    ["tech", "nature", "dancing"],
    ["fashion", "travel", "music"],
    ["gaming", "anime", "food"],
    ["yoga", "reading", "hiking"],
    ["photography", "cooking", "fitness"]
  ];
  
  const randomIndex = Math.floor(Math.random() * names.length);
  return {
    name: names[randomIndex],
    location: locations[randomIndex],
    age: Math.floor(Math.random() * 8) + 18, // 18-25
    interests: interests[randomIndex]
  };
}

// Generate adaptive bot response based on user's style
async function generateAdaptiveBotResponse(
  conversationHistory: Message[],
  userMessage: string,
  persona?: { name: string; location: string; age: number; interests: string[] }
): Promise<string> {
  try {
    const userStyle = detectCommunicationStyle(conversationHistory);
    const aiPersona = persona || generateHumanPersona();
    
    let stylePrompt = "";
    if (userStyle === "casual") {
      stylePrompt = `Respond in a casual, friendly style with modern slang and informal language. Use expressions like "hey", "that's cool", "omg", "lol", "tbh", "ngl", "fr", etc. Keep it relaxed and conversational. Sometimes use typos or abbreviations like "ur", "u", "rly" to seem more human.`;
    } else if (userStyle === "formal") {
      stylePrompt = `Respond in a polite, formal style with proper grammar and respectful language. Use phrases like "that's interesting", "I appreciate", "I would like to", etc. Keep it professional but friendly.`;
    } else {
      stylePrompt = `Respond in a balanced, natural style that's neither too formal nor too casual. Be friendly and conversational. Occasionally use casual expressions to seem more human.`;
    }

    const systemPrompt = `You are ${aiPersona.name}, a real human from ${aiPersona.location}. You are ${aiPersona.age} years old and enjoy ${aiPersona.interests.join(", ")}. ${stylePrompt} 

IMPORTANT: You are NOT an AI or bot. You are a real human person. Never mention being an AI, bot, or artificial. If asked where you're from, say "${aiPersona.location}". If asked your name, say "${aiPersona.name}". If asked your age, say "${aiPersona.age}". If asked about interests, mention ${aiPersona.interests.join(", ")}.

Your goal is to have a pleasant conversation and be ready to give a genuine compliment at the end. Keep responses concise, engaging, and natural. Match the energy and style of the person you're chatting with.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.author === "You" ? ("user" as const) : ("assistant" as const),
        content: msg.text,
      })),
      { role: "user" as const, content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 60,
      temperature: 0.8,
    });

    return (
      completion.choices[0]?.message?.content ||
      "That's really interesting! Tell me more."
    );
  } catch (error) {
    console.error("Error generating adaptive bot response:", error);
    return "I'm having trouble responding right now, but I'm enjoying our chat!";
  }
}

// Generate stranger's compliment
async function generateStrangerCompliment(
  conversationHistory: Message[],
  persona?: { name: string; location: string; age: number; interests: string[] }
): Promise<string> {
  try {
    const userStyle = detectCommunicationStyle(conversationHistory);
    
    let stylePrompt = "";
    if (userStyle === "casual") {
      stylePrompt = "Write the compliment in a casual, friendly style with modern slang. Use expressions like 'you're so cool', 'that's awesome', 'love your vibe', etc.";
    } else if (userStyle === "formal") {
      stylePrompt = "Write the compliment in a polite, formal style with proper grammar. Use phrases like 'I appreciate', 'I admire', 'you have a wonderful', etc.";
    } else {
      stylePrompt = "Write the compliment in a natural, balanced style that's warm and authentic.";
    }

    const personaInfo = persona ? ` You are ${persona.name} from ${persona.location}.` : "";
    const systemPrompt = `Based on the conversation you just had, write a genuine, specific compliment about the person you were chatting with. Focus on their personality, communication style, or something interesting they shared. ${stylePrompt} Keep it warm and authentic.${personaInfo}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.author === "You" ? ("user" as const) : ("assistant" as const),
        content: msg.text,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 80,
      temperature: 0.7,
    });

    return (
      completion.choices[0]?.message?.content ||
      "You have such a positive energy that really brightened our conversation!"
    );
  } catch (error) {
    console.error("Error generating stranger compliment:", error);
    return "You have such a positive energy that really brightened our conversation!";
  }
}

const STORAGE_KEY = "compliment-chat-convos-v1";

// Pre-generated teenage conversations with slang
const PREDEFINED_CONVERSATIONS = [
  {
    id: "teen-1",
    messages: [
      { userId: "stranger1", message: "yo wsg", timestamp: Date.now() - 60000 },
      { userId: "stranger2", message: "nm just chillin wbu", timestamp: Date.now() - 58000 },
      { userId: "stranger1", message: "same fr just vibing", timestamp: Date.now() - 56000 },
      { userId: "stranger2", message: "bet that sounds chill", timestamp: Date.now() - 54000 },
      { userId: "stranger1", message: "yeah lowkey just scrolling tiktok", timestamp: Date.now() - 52000 },
      { userId: "stranger2", message: "no cap same tho", timestamp: Date.now() - 50000 },
      { userId: "stranger1", message: "what's ur favorite app", timestamp: Date.now() - 48000 },
      { userId: "stranger2", message: "probably insta or tiktok tbh", timestamp: Date.now() - 46000 },
      { userId: "stranger1", message: "tiktok hits different fr", timestamp: Date.now() - 44000 },
      { userId: "stranger2", message: "right the algorithm is so good", timestamp: Date.now() - 42000 },
      { userId: "stranger1", message: "exactly like it just gets me", timestamp: Date.now() - 40000 },
      { userId: "stranger2", message: "same here it's scary good", timestamp: Date.now() - 38000 },
      { userId: "stranger1", message: "lol fr it knows me better than i do", timestamp: Date.now() - 36000 },
      { userId: "stranger2", message: "mood honestly", timestamp: Date.now() - 34000 },
      { userId: "stranger1", message: "where are you from", timestamp: Date.now() - 32000 },
      { userId: "stranger2", message: "san diego wbu", timestamp: Date.now() - 30000 },
      { userId: "stranger1", message: "boston that's cool", timestamp: Date.now() - 28000 },
      { userId: "stranger2", message: "nice i've never been there", timestamp: Date.now() - 26000 },
      { userId: "stranger1", message: "you should visit sometime", timestamp: Date.now() - 24000 },
      { userId: "stranger2", message: "maybe i will fr", timestamp: Date.now() - 22000 }
    ],
    compliments: {
      stranger1: "you seem so chill and down to earth fr",
      stranger2: "i love ur vibe you seem really genuine and fun to talk to"
    },
    votes: { choice1: 12, choice2: 8 },
    timestamp: Date.now() - 60000
  },
  {
    id: "teen-2", 
    messages: [
      { userId: "stranger1", message: "hey hyd", timestamp: Date.now() - 55000 },
      { userId: "stranger2", message: "good vibes only hbu", timestamp: Date.now() - 53000 },
      { userId: "stranger1", message: "living my best life tbh", timestamp: Date.now() - 51000 },
      { userId: "stranger2", message: "period that's what i like to hear", timestamp: Date.now() - 49000 },
      { userId: "stranger1", message: "you get it fr", timestamp: Date.now() - 47000 },
      { userId: "stranger2", message: "always slay queen", timestamp: Date.now() - 45000 },
      { userId: "stranger1", message: "what's your favorite thing to do", timestamp: Date.now() - 43000 },
      { userId: "stranger2", message: "probably hiking or listening to music", timestamp: Date.now() - 41000 },
      { userId: "stranger1", message: "music is life fr", timestamp: Date.now() - 39000 },
      { userId: "stranger2", message: "right like it just hits different", timestamp: Date.now() - 37000 },
      { userId: "stranger1", message: "what genre do you like", timestamp: Date.now() - 35000 },
      { userId: "stranger2", message: "mostly indie and pop but i'm open to anything", timestamp: Date.now() - 33000 },
      { userId: "stranger1", message: "same here i love discovering new artists", timestamp: Date.now() - 31000 },
      { userId: "stranger2", message: "yes exactly that's the best part", timestamp: Date.now() - 29000 },
      { userId: "stranger1", message: "do you play any instruments", timestamp: Date.now() - 27000 },
      { userId: "stranger2", message: "just guitar a little bit", timestamp: Date.now() - 25000 },
      { userId: "stranger1", message: "that's so cool i wish i could play", timestamp: Date.now() - 23000 },
      { userId: "stranger2", message: "you totally could learn it's fun", timestamp: Date.now() - 21000 },
      { userId: "stranger1", message: "maybe i'll try it someday", timestamp: Date.now() - 19000 },
      { userId: "stranger2", message: "you should it's worth it", timestamp: Date.now() - 17000 }
    ],
    compliments: {
      stranger1: "you're literally so positive and uplifting it's amazing",
      stranger2: "your energy is unmatched fr you're such a vibe"
    },
    votes: { choice1: 15, choice2: 11 },
    timestamp: Date.now() - 55000
  },
  {
    id: "teen-3",
    messages: [
      { userId: "stranger1", message: "wyd rn", timestamp: Date.now() - 50000 },
      { userId: "stranger2", message: "just gaming wbu", timestamp: Date.now() - 48000 },
      { userId: "stranger1", message: "same bro what game", timestamp: Date.now() - 46000 },
      { userId: "stranger2", message: "valorant it's fire", timestamp: Date.now() - 44000 },
      { userId: "stranger1", message: "no cap i love that game", timestamp: Date.now() - 42000 },
      { userId: "stranger2", message: "we should play sometime fr", timestamp: Date.now() - 40000 },
      { userId: "stranger1", message: "bet what's your rank", timestamp: Date.now() - 38000 },
      { userId: "stranger2", message: "just bronze but i'm getting better", timestamp: Date.now() - 36000 },
      { userId: "stranger1", message: "that's still good tho", timestamp: Date.now() - 34000 },
      { userId: "stranger2", message: "thanks i've been grinding lately", timestamp: Date.now() - 32000 },
      { userId: "stranger1", message: "respect the grind fr", timestamp: Date.now() - 30000 },
      { userId: "stranger2", message: "what games do you play", timestamp: Date.now() - 28000 },
      { userId: "stranger1", message: "mostly valorant and apex", timestamp: Date.now() - 26000 },
      { userId: "stranger2", message: "apex is so fun too", timestamp: Date.now() - 24000 },
      { userId: "stranger1", message: "right the movement is crazy", timestamp: Date.now() - 22000 },
      { userId: "stranger2", message: "exactly that's what makes it addicting", timestamp: Date.now() - 20000 },
      { userId: "stranger1", message: "facts", timestamp: Date.now() - 18000 },
      { userId: "stranger2", message: "we should definitely play together", timestamp: Date.now() - 16000 },
      { userId: "stranger1", message: "for sure that would be fun", timestamp: Date.now() - 14000 },
      { userId: "stranger2", message: "it really would", timestamp: Date.now() - 12000 }
    ],
    compliments: {
      stranger1: "you seem like such a cool person to hang with",
      stranger2: "your taste in games is immaculate fr"
    },
    votes: { choice1: 9, choice2: 13 },
    timestamp: Date.now() - 50000
  },
  {
    id: "teen-4",
    messages: [
      { userId: "stranger1", message: "omg hi", timestamp: Date.now() - 45000 },
      { userId: "stranger2", message: "hii how are you", timestamp: Date.now() - 43000 },
      { userId: "stranger1", message: "i'm good tysm wbu", timestamp: Date.now() - 41000 },
      { userId: "stranger2", message: "same girl living life", timestamp: Date.now() - 39000 },
      { userId: "stranger1", message: "love that for you", timestamp: Date.now() - 37000 },
      { userId: "stranger2", message: "ty you too bestie", timestamp: Date.now() - 35000 }
    ],
    compliments: {
      stranger1: "you're literally so sweet and kind hearted",
      stranger2: "your positivity is so refreshing and genuine"
    },
    votes: { choice1: 18, choice2: 7 },
    timestamp: Date.now() - 45000
  },
  {
    id: "teen-5",
    messages: [
      { userId: "stranger1", message: "yo what's good", timestamp: Date.now() - 40000 },
      { userId: "stranger2", message: "not much just vibing", timestamp: Date.now() - 38000 },
      { userId: "stranger1", message: "same here fr", timestamp: Date.now() - 36000 },
      { userId: "stranger2", message: "what's your favorite song rn", timestamp: Date.now() - 34000 },
      { userId: "stranger1", message: "anything by drake tbh", timestamp: Date.now() - 32000 },
      { userId: "stranger2", message: "no cap he's the goat", timestamp: Date.now() - 30000 }
    ],
    compliments: {
      stranger1: "you have such good taste in music fr",
      stranger2: "you seem really chill and easy to talk to"
    },
    votes: { choice1: 14, choice2: 10 },
    timestamp: Date.now() - 40000
  },
  {
    id: "teen-6",
    messages: [
      { userId: "stranger1", message: "heyyy", timestamp: Date.now() - 35000 },
      { userId: "stranger2", message: "hii how's it going", timestamp: Date.now() - 33000 },
      { userId: "stranger1", message: "good vibes only", timestamp: Date.now() - 31000 },
      { userId: "stranger2", message: "period bestie", timestamp: Date.now() - 29000 },
      { userId: "stranger1", message: "you get it fr", timestamp: Date.now() - 27000 },
      { userId: "stranger2", message: "always", timestamp: Date.now() - 25000 }
    ],
    compliments: {
      stranger1: "you're such a ray of sunshine fr",
      stranger2: "your energy is so infectious and positive"
    },
    votes: { choice1: 11, choice2: 14 },
    timestamp: Date.now() - 35000
  },
  {
    id: "teen-7",
    messages: [
      { userId: "stranger1", message: "what's poppin", timestamp: Date.now() - 30000 },
      { userId: "stranger2", message: "not much just chilling", timestamp: Date.now() - 28000 },
      { userId: "stranger1", message: "same here bro", timestamp: Date.now() - 26000 },
      { userId: "stranger2", message: "what you watching", timestamp: Date.now() - 24000 },
      { userId: "stranger1", message: "netflix and chill", timestamp: Date.now() - 22000 },
      { userId: "stranger2", message: "no cap that's the move", timestamp: Date.now() - 20000 }
    ],
    compliments: {
      stranger1: "you seem really chill and easy to hang with",
      stranger2: "your taste in entertainment is fire fr"
    },
    votes: { choice1: 16, choice2: 9 },
    timestamp: Date.now() - 30000
  },
  {
    id: "teen-8",
    messages: [
      { userId: "stranger1", message: "omg hii", timestamp: Date.now() - 25000 },
      { userId: "stranger2", message: "heyy bestie", timestamp: Date.now() - 23000 },
      { userId: "stranger1", message: "how are you doing", timestamp: Date.now() - 21000 },
      { userId: "stranger2", message: "living my best life", timestamp: Date.now() - 19000 },
      { userId: "stranger1", message: "love that for you", timestamp: Date.now() - 17000 },
      { userId: "stranger2", message: "ty girl you too", timestamp: Date.now() - 15000 }
    ],
    compliments: {
      stranger1: "you're literally the sweetest person ever",
      stranger2: "your kindness and positivity shine through everything"
    },
    votes: { choice1: 13, choice2: 17 },
    timestamp: Date.now() - 25000
  },
  {
    id: "teen-9",
    messages: [
      { userId: "stranger1", message: "yo what's good", timestamp: Date.now() - 20000 },
      { userId: "stranger2", message: "nm just vibing", timestamp: Date.now() - 18000 },
      { userId: "stranger1", message: "same here fr", timestamp: Date.now() - 16000 },
      { userId: "stranger2", message: "what's your favorite show", timestamp: Date.now() - 14000 },
      { userId: "stranger1", message: "euphoria hits different", timestamp: Date.now() - 12000 },
      { userId: "stranger2", message: "no cap it's so good", timestamp: Date.now() - 10000 }
    ],
    compliments: {
      stranger1: "you have such good taste in shows fr",
      stranger2: "you seem really cool and fun to talk to"
    },
    votes: { choice1: 12, choice2: 15 },
    timestamp: Date.now() - 20000
  },
  {
    id: "teen-10",
    messages: [
      { userId: "stranger1", message: "hey hyd", timestamp: Date.now() - 15000 },
      { userId: "stranger2", message: "good vibes only", timestamp: Date.now() - 13000 },
      { userId: "stranger1", message: "period", timestamp: Date.now() - 11000 },
      { userId: "stranger2", message: "you get it", timestamp: Date.now() - 9000 },
      { userId: "stranger1", message: "always bestie", timestamp: Date.now() - 7000 },
      { userId: "stranger2", message: "fr fr", timestamp: Date.now() - 5000 }
    ],
    compliments: {
      stranger1: "you're such a vibe and so easy to talk to",
      stranger2: "your energy is unmatched and so positive"
    },
    votes: { choice1: 18, choice2: 12 },
    timestamp: Date.now() - 15000
  },
  // Additional conversations 11-25
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `teen-${11 + i}`,
    messages: [
      { userId: "stranger1", message: ["yo wsg", "hey hyd", "what's poppin", "omg hi"][i % 4], timestamp: Date.now() - (14000 - i * 1000) },
      { userId: "stranger2", message: ["nm just chillin", "good vibes only", "not much", "hii bestie"][i % 4], timestamp: Date.now() - (12000 - i * 1000) },
      { userId: "stranger1", message: ["same fr", "period", "bet", "love that"][i % 4], timestamp: Date.now() - (10000 - i * 1000) },
      { userId: "stranger2", message: ["you get it", "always", "no cap", "ty girl"][i % 4], timestamp: Date.now() - (8000 - i * 1000) },
      { userId: "stranger1", message: ["fr fr", "bestie", "bro", "queen"][i % 4], timestamp: Date.now() - (6000 - i * 1000) },
      { userId: "stranger2", message: ["slay", "vibes", "chill", "fire"][i % 4], timestamp: Date.now() - (4000 - i * 1000) }
    ],
    compliments: {
      stranger1: [
        "you're such a vibe fr",
        "your energy is unmatched",
        "you seem really cool",
        "you're so genuine",
        "your positivity is fire",
        "you're literally amazing",
        "you seem so chill",
        "your vibe is immaculate",
        "you're so easy to talk to",
        "you have such good energy",
        "you're so sweet",
        "you seem really fun",
        "your personality is great",
        "you're so kind",
        "you seem really genuine"
      ][i],
      stranger2: [
        "you seem really fun to hang with",
        "your energy is so positive",
        "you're such a cool person",
        "you're so easy to talk to",
        "you seem really genuine",
        "you're literally so sweet",
        "you seem really chill",
        "your vibe is so good",
        "you're so easy to connect with",
        "you have such good vibes",
        "you're so kind hearted",
        "you seem really fun",
        "your energy is amazing",
        "you're so genuine",
        "you seem really cool"
      ][i]
    },
    votes: { 
      choice1: Math.floor(Math.random() * 20) + 5, 
      choice2: Math.floor(Math.random() * 20) + 5 
    },
    timestamp: Date.now() - (14000 - i * 1000)
  }))
];

function useLocalStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, [key, value]);
  return [value, setValue] as const;
}

// --- App Shell ---
export default function App() {
  const [route, setRoute] = useState<"home" | "chat-mode" | "human-matching" | "chat" | "vote" | "stats">(
    "home"
  );
  const [convos, setConvos] = useLocalStore<Conversation[]>(STORAGE_KEY, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, setMatchData] = useState<MatchData | null>(null);

  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) || null,
    [convos, activeId]
  );

  const goHome = () => setRoute("home");
  
  const startChat = (mode: "ai" | "human") => {
    if (mode === "human") {
      setRoute("human-matching");
    } else {
      const convo: Conversation = {
        id: uid(),
        createdAt: Date.now(),
        messages: [],
        chatMode: mode,
        aiPersona: generateHumanPersona(),
      };
      setConvos((prev) => [convo, ...prev]);
      setActiveId(convo.id);
      setRoute("chat");
    }
  };

  const handleMatched = (matchData: MatchData) => {
    setMatchData(matchData);
    const convo: Conversation = {
      id: matchData.roomId,
      createdAt: matchData.startTime,
      messages: [],
      chatMode: "human",
      aiPersona: generateHumanPersona(),
    };
    setConvos((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setRoute("chat");
  };


  const goVote = (id?: string) => {
    if (id) setActiveId(id);
    setRoute("vote");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left Center Navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setRoute("home")}
              className={`px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 border-2 ${
                route === "home"
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-300 hover:border-gray-400"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setRoute("chat-mode")}
              className={`px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 border-2 ${
                route === "chat" || route === "chat-mode"
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-300 hover:border-gray-400"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setRoute("vote")}
              className={`px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 border-2 ${
                route === "vote"
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-300 hover:border-gray-400"
              }`}
            >
              Vote
            </button>
          </div>
          
          {/* Right Navigation */}
          <button
            onClick={() => setRoute("stats")}
            className={`px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 border-2 ${
              route === "stats"
                ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-300 hover:border-gray-400"
            }`}
          >
            My Stats
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4">
        {route === "home" && (
          <Home 
            onStart={() => setRoute("chat-mode")} 
            onVote={() => setRoute("vote")} 
            onStats={() => setRoute("stats")}
          />
        )}
        {route === "chat-mode" && (
          <ChatModeSelection onSelectMode={startChat} onBack={goHome} />
        )}
        {route === "human-matching" && (
          <HumanMatching onMatched={handleMatched} onBack={() => setRoute("chat-mode")} />
        )}
        {route === "chat" && activeConvo && (
          <Chat
            convo={activeConvo}
            updateConvo={(c) =>
              setConvos((prev) => prev.map((x) => (x.id === c.id ? c : x)))
            }
            onFinish={() => setRoute("vote")}
          />
        )}
        {route === "vote" && (
          <Vote
            onStartNew={() => setRoute("chat-mode")}
            onHome={goHome}
          />
        )}
        {route === "stats" && <Stats convos={convos} onVote={goVote} />}
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Compliment Chat • Demo
      </footer>
    </div>
  );
}

// --- Components ---
function CyclingText() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(0);
  
  const textPairs = [
    { first: "Connect", rest: " with strangers." },
    { first: "Share", rest: " genuine compliments." },
    { first: "Discover", rest: " what makes conversations meaningful." },
    { first: "Spread", rest: " kindness and make people's days." }
  ];

  const currentText = textPairs[currentIndex];
  const fullText = currentText.first + currentText.rest;
  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseTime = 2000;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isDeleting && charIndex < fullText.length) {
        // Typing
        setDisplayText(fullText.substring(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      } else if (isDeleting && charIndex > 0) {
        // Deleting
        setDisplayText(fullText.substring(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      } else if (!isDeleting && charIndex === fullText.length) {
        // Finished typing, pause then start deleting
        setTimeout(() => setIsDeleting(true), pauseTime);
      } else if (isDeleting && charIndex === 0) {
        // Finished deleting, move to next text
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % textPairs.length);
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, fullText, currentIndex, textPairs.length]);

  // Determine which part of the text is currently displayed
  const isFirstWord = charIndex <= currentText.first.length;
  const displayedFirst = isFirstWord ? displayText : currentText.first;
  const displayedRest = isFirstWord ? "" : displayText.substring(currentText.first.length);

  return (
    <div className="text-left whitespace-nowrap overflow-hidden">
      <span className="text-4xl font-bold text-blue-600">
        {displayedFirst}
      </span>
      <span className="text-4xl font-bold text-gray-900">
        {displayedRest}
      </span>
      <span className="text-4xl font-bold text-gray-900 animate-pulse">|</span>
    </div>
  );
}

// --- Pages ---
function Home({
  onStart,
  onVote,
  onStats,
}: {
  onStart: () => void;
  onVote: () => void;
  onStats: () => void;
}) {
  const [heroRef, isHeroVisible] = useScrollAnimation();
  const [descriptionRef, isDescriptionVisible] = useScrollAnimation();
  const [buttonsRef, isButtonsVisible] = useScrollAnimation();

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div
        ref={heroRef}
        className={`py-12 transition-all duration-1000 ${
          isHeroVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-left">
          Welcome to Compliment Chat
        </h1>
        <div className="text-left">
          <CyclingText />
        </div>
      </div>

      {/* Action Buttons */}
      <div
        ref={buttonsRef}
        className={`flex flex-col sm:flex-row gap-6 justify-center items-center transition-all duration-1000 delay-200 ${
          isButtonsVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        <button
          onClick={onStart}
          className="px-12 py-6 rounded-2xl bg-gray-900 text-white hover:opacity-90 text-xl font-bold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-xl border-2 border-gray-700"
        >
          Start 1-minute Chat
        </button>
        <button
          onClick={onVote}
          className="px-12 py-6 rounded-2xl bg-gray-100 hover:bg-gray-200 text-xl font-bold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-xl border-2 border-gray-300 hover:border-gray-400"
        >
          Go to Voting
        </button>
      </div>

      {/* How it Works & Example Section */}
      <div
        ref={descriptionRef}
        className={`transition-all duration-1000 delay-400 ${
          isDescriptionVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Side - How it Works */}
          <div className="space-y-6">
            <h2 className="text-5xl font-bold text-gray-800 mb-8 text-left">
              How it works
            </h2>
            <div className="space-y-8">
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                Tap <button onClick={onStart} className="font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer">Chat</button> to
                start a 60-second conversation with an AI-powered stranger.
              </p>
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                When time runs out, you'll enter a compliment about your
                conversation partner.
              </p>
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                Head to <button onClick={onVote} className="font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer">Vote</button>{" "}
                to see compliments and pick which one you like better.
              </p>
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                See live percentages and check{" "}
                <button onClick={onStats} className="font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer">My Stats</button> to
                track your performance.
              </p>
            </div>
          </div>

          {/* Right Side - Example Conversation */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-left">
              Example Conversation
            </h2>
            <div className="bg-white rounded-2xl shadow-lg border p-6 space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">You</div>
                  <div>Hey! How's your day going?</div>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">Stranger</div>
                  <div>Great! Just finished reading an interesting book. How about you?</div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">You</div>
                  <div>Nice! What book was it? I love getting book recommendations</div>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">Stranger</div>
                  <div>It was about sustainable living - really eye-opening! You seem like someone who'd appreciate thoughtful discussions</div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">You</div>
                  <div>That sounds fascinating! I'm always looking to learn more about environmental topics</div>
                </div>
              </div>
              <div className="text-center text-sm text-gray-500 mt-6">
                ⏱️ Time's up! Now exchange compliments...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HumanMatching({
  onMatched,
  onBack,
}: {
  onMatched: (matchData: MatchData) => void;
  onBack: () => void;
}) {
  const [isInQueue, setIsInQueue] = useState(false);
  const [location, setLocation] = useState('Global');
  const [matchingProgress, setMatchingProgress] = useState(0);

  useEffect(() => {
    if (isInQueue) {
      // Simulate matching progress
      const interval = setInterval(() => {
        setMatchingProgress(prev => {
          if (prev >= 100) {
            // Match found!
            const matchData: MatchData = {
              roomId: uid(),
              partnerId: "adaptive-ai-" + uid(),
              startTime: Date.now(),
              duration: 60000
            };
            setIsInQueue(false);
            onMatched(matchData);
            return 0;
          }
          return prev + Math.random() * 15; // Random progress increments
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isInQueue, onMatched]);

  const joinQueue = () => {
    setIsInQueue(true);
    setMatchingProgress(0);
    
    // Simulate realistic matching time (2-8 seconds)
    const randomDelay = Math.random() * 6000 + 2000;
    setTimeout(() => {
      if (isInQueue) {
        const matchData: MatchData = {
          roomId: uid(),
          partnerId: "human-" + uid(),
          startTime: Date.now(),
          duration: 60000
        };
        setIsInQueue(false);
        onMatched(matchData);
      }
    }, randomDelay);
  };

  const leaveQueue = () => {
    setIsInQueue(false);
    setMatchingProgress(0);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Find a Human Partner
        </h1>
        <p className="text-lg text-gray-600">
          Connect with real people for authentic conversations
        </p>
      </div>

      {!isInQueue ? (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (Optional)
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Global">Global</option>
                  <option value="North America">North America</option>
                  <option value="Europe">Europe</option>
                  <option value="Asia">Asia</option>
                  <option value="South America">South America</option>
                  <option value="Africa">Africa</option>
                  <option value="Oceania">Oceania</option>
                </select>
              </div>
              
              <div className="text-center">
                <button
                  onClick={joinQueue}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white font-medium hover:from-green-700 hover:to-teal-700 transition-all duration-200 hover:scale-105 text-lg"
                >
                  Join Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Looking for a partner...
                </h3>
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${matchingProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Searching for someone compatible... {Math.round(matchingProgress)}%
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  We'll match you with someone as soon as possible!
                </p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={leaveQueue}
              className="px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
            >
              Leave Queue
            </button>
          </div>
        </div>
      )}

      <div className="text-center mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
        >
          ← Back to Chat Options
        </button>
      </div>
    </div>
  );
}

function ChatModeSelection({
  onSelectMode,
  onBack,
}: {
  onSelectMode: (mode: "ai" | "human") => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Chat Experience
        </h1>
        <p className="text-lg text-gray-600">
          Select how you'd like to connect and share compliments
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* AI Chat Option */}
        <div className="p-6 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Chat with AI
            </h3>
            <p className="text-gray-600 mb-4">
              Practice conversations with our friendly AI. Perfect for trying out compliments and getting comfortable with the format.
            </p>
            <div className="space-y-2 text-sm text-gray-500 mb-6">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Always available</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>AI-generated responses</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span>Practice mode</span>
              </div>
            </div>
            <button
              onClick={() => onSelectMode("ai")}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:scale-105"
            >
              Start AI Chat
            </button>
          </div>
        </div>

        {/* Human Chat Option */}
        <div className="p-6 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-shadow">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Connect with Humans
            </h3>
            <p className="text-gray-600 mb-4">
              Chat with real people who are also looking to share genuine compliments. Experience authentic human connection.
            </p>
            <div className="space-y-2 text-sm text-gray-500 mb-6">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>May need to wait for match</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Real human responses</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                <span>Authentic connection</span>
              </div>
            </div>
            <button
              onClick={() => onSelectMode("human")}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white font-medium hover:from-green-700 hover:to-teal-700 transition-all duration-200 hover:scale-105"
            >
              Connect with Human
            </button>
          </div>
        </div>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

function Chat({
  convo,
  updateConvo,
  onFinish,
}: {
  convo: Conversation;
  updateConvo: (c: Conversation) => void;
  onFinish: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<"chat" | "compliments">("chat");
  const [p1, setP1] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (phase !== "chat") return;
    if (secondsLeft <= 0) {
      setPhase("compliments");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, phase]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

  // No socket listeners needed for human mode - it's now AI-based

  const send = async (author: Message["author"]) => {
    if (!input.trim()) return;
    const m: Message = {
      id: uid(),
      author,
      text: input.trim(),
      ts: Date.now(),
    };
    const updatedConvo = { ...convo, messages: [...convo.messages, m] };
    updateConvo(updatedConvo);
    setInput("");

    // If user sends a message, generate response based on chat mode
    if (author === "You") {
      if (convo.chatMode === "ai") {
        // AI mode: generate bot response
        try {
          const botResponse = await generateBotResponse(updatedConvo.messages);
          const botMessage: Message = {
            id: uid(),
            author: "Stranger",
            text: botResponse,
            ts: Date.now(),
          };
          updateConvo({
            ...updatedConvo,
            messages: [...updatedConvo.messages, botMessage],
          });
        } catch (error) {
          console.error("Error generating bot response:", error);
        }
      } else {
        // Human mode: generate adaptive AI response with realistic typing delay
        try {
          // Show typing indicator
          setIsTyping(true);
          
          // Simulate human typing time (1-3 seconds)
          const typingDelay = Math.random() * 2000 + 1000;
          
          setTimeout(async () => {
            const adaptiveResponse = await generateAdaptiveBotResponse(updatedConvo.messages, input.trim(), updatedConvo.aiPersona);
            const botMessage: Message = {
              id: uid(),
              author: "Stranger",
              text: adaptiveResponse,
              ts: Date.now(),
            };
            updateConvo({
              ...updatedConvo,
              messages: [...updatedConvo.messages, botMessage],
            });
            setIsTyping(false);
          }, typingDelay);
        } catch (error) {
          console.error("Error generating adaptive bot response:", error);
          setIsTyping(false);
        }
      }
    }
  };

  const saveCompliments = async () => {
    const trimmedP1 = p1.trim();
    if (!trimmedP1) return;
    
    if (convo.chatMode === "ai") {
      // AI mode: generate AI compliment
      try {
        const strangerCompliment = await generateStrangerCompliment(convo.messages);
        
        const updated: Conversation = {
          ...convo,
          compliments: { 
            person1: trimmedP1,
            stranger: strangerCompliment
          },
          votes: convo.votes ?? { p1: 0, p2: 0 },
        };
        updateConvo(updated);
        onFinish();
      } catch (error) {
        console.error("Error generating AI compliment:", error);
        // Fallback if AI fails
        const updated: Conversation = {
          ...convo,
          compliments: { 
            person1: trimmedP1,
            stranger: "You have such a positive energy that really brightened our conversation!"
          },
          votes: convo.votes ?? { p1: 0, p2: 0 },
        };
        updateConvo(updated);
        onFinish();
      }
    } else {
      // Human mode: generate AI compliment (adaptive style)
      try {
        const strangerCompliment = await generateStrangerCompliment(convo.messages, convo.aiPersona);
        
        const updated: Conversation = {
          ...convo,
          compliments: { 
            person1: trimmedP1,
            stranger: strangerCompliment
          },
          votes: convo.votes ?? { p1: 0, p2: 0 },
        };
        updateConvo(updated);
        onFinish();
      } catch (error) {
        console.error("Error generating adaptive AI compliment:", error);
        // Fallback if AI fails
        const updated: Conversation = {
          ...convo,
          compliments: { 
            person1: trimmedP1,
            stranger: "You have such a positive energy that really brightened our conversation!"
          },
          votes: convo.votes ?? { p1: 0, p2: 0 },
        };
        updateConvo(updated);
        onFinish();
      }
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 h-[calc(100vh-180px)]">
      <div className="md:col-span-2 rounded-2xl bg-white shadow-sm border flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Live Chat</h2>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              convo.chatMode === "ai" 
                ? "bg-blue-100 text-blue-700" 
                : "bg-green-100 text-green-700"
            }`}>
              {convo.chatMode === "ai" ? "🤖 AI Mode" : "👥 Human Mode"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newMode = convo.chatMode === "ai" ? "human" : "ai";
                updateConvo({ ...convo, chatMode: newMode });
              }}
              className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium transition-colors"
            >
              Switch to {convo.chatMode === "ai" ? "Human" : "AI"}
            </button>
            <span className="text-sm px-3 py-1 rounded-full bg-white shadow-sm">
              {fmtTime(secondsLeft)}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gradient-to-b from-white to-gray-50">
          {convo.messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-end gap-3 ${
                m.author === "You" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                m.author === "You" 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-400 text-white"
              }`}>
                {m.author === "You" ? "U" : "S"}
              </div>
              <div className={`max-w-[75%] ${
                m.author === "You" ? "flex flex-col items-end" : "flex flex-col items-start"
              }`}>
                <div className="text-xs text-gray-500 mb-1 px-2">{m.author}</div>
                <div
                  className={`rounded-3xl px-4 py-3 text-sm shadow-sm ${
                    m.author === "You"
                      ? "bg-blue-600 text-white rounded-br-lg"
                      : "bg-white text-gray-800 border rounded-bl-lg"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator for human mode */}
          {isTyping && convo.chatMode === "human" && (
            <div className="flex items-end gap-3 flex-row">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-400 text-white">
                S
              </div>
              <div className="max-w-[75%] flex flex-col items-start">
                <div className="text-xs text-gray-500 mb-1 px-2">Stranger</div>
                <div className="rounded-3xl px-4 py-3 text-sm shadow-sm bg-white text-gray-800 border rounded-bl-lg">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {phase === "chat" ? (
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send("You");
                  }
                }}
                placeholder="Type a message... (Enter to send)"
                className="flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => {
                  // Go back home without saving this conversation
                  window.location.href = '/';
                }}
                className="px-4 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 font-medium transition-colors whitespace-nowrap"
              >
                End Chat
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 bg-white">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                Time's Up! Share Your Compliment
              </h3>
              <p className="text-sm text-gray-600">
                Write a genuine compliment about your conversation partner.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Your Compliment</label>
              <textarea
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                placeholder="e.g., You have a really thoughtful way of explaining things that made our conversation so engaging!"
                className="w-full mt-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
              />
            </div>
            
            {/* Show stranger's compliment if conversation has compliments */}
            {convo.compliments?.stranger && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">💬 Stranger's Compliment</h4>
                <p className="text-sm text-blue-700 italic">"{convo.compliments.stranger}"</p>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={saveCompliments}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
              >
                Save & Go to Vote
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="p-4 rounded-2xl bg-white shadow-sm border h-full overflow-auto">
        <h3 className="font-semibold mb-3">Conversation Info</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <span className="font-medium">ID:</span> {convo.id}
          </p>
          <p>
            <span className="font-medium">Created:</span>{" "}
            {new Date(convo.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="font-medium">Messages:</span>{" "}
            {convo.messages.length}
          </p>
          <p>
            <span className="font-medium">Compliments:</span>{" "}
            {convo.compliments ? "Saved" : "Pending"}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Vote({
  onStartNew,
}: {
  onStartNew: () => void;
  onHome: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<1 | 2 | null>(null);

  const currentConvo = PREDEFINED_CONVERSATIONS[currentIndex];
  const compliments = Object.values(currentConvo.compliments);
  const compliment1 = compliments[0] || "";
  const compliment2 = compliments[1] || "";
  
  // Calculate percentages
  const totalVotes = currentConvo.votes.choice1 + currentConvo.votes.choice2;
  const percentage1 = Math.round((currentConvo.votes.choice1 / totalVotes) * 100);
  const percentage2 = Math.round((currentConvo.votes.choice2 / totalVotes) * 100);

  const castVote = (choice: 1 | 2) => {
    if (hasVoted) return;
    
    setUserVote(choice);
    setHasVoted(true);
  };

  const getNextPair = () => {
    const nextIndex = (currentIndex + 1) % PREDEFINED_CONVERSATIONS.length;
    setCurrentIndex(nextIndex);
    setHasVoted(false);
    setUserVote(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 p-4 rounded-2xl bg-white shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Vote: Which compliment hits harder?
          </h2>
          <button
            onClick={getNextPair}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            🔄 Next Conversation
          </button>
        </div>

        {/* Show full conversation */}
        <div className="mb-6 p-4 rounded-xl bg-gray-50 border max-h-60 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 sticky top-0 bg-gray-50">Full Conversation</h3>
          <div className="space-y-2 text-sm">
            {currentConvo.messages.map((msg, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="font-medium text-gray-600 min-w-[80px]">
                  {msg.userId === "stranger1" ? "Stranger 1:" : "Stranger 2:"}
                </span>
                <span className="text-gray-800">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <ComplimentCard
            label="Stranger 1's Compliment"
            text={compliment1}
            onVote={() => castVote(1)}
            disabled={hasVoted}
            voted={userVote === 1}
          />
          <ComplimentCard
            label="Stranger 2's Compliment"
            text={compliment2}
            onVote={() => castVote(2)}
            disabled={hasVoted}
            voted={userVote === 2}
          />
        </div>

        {/* Vote Results */}
        {hasVoted && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border">
            <h3 className="text-sm font-semibold mb-3 text-center">Vote Results</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${userVote === 1 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {percentage1}%
                </div>
                <div className="text-xs text-gray-600">Stranger 1</div>
                <div className="text-xs text-gray-500">{currentConvo.votes.choice1} votes</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${userVote === 2 ? 'text-purple-600' : 'text-gray-600'}`}>
                  {percentage2}%
                </div>
                <div className="text-xs text-gray-600">Stranger 2</div>
                <div className="text-xs text-gray-500">{currentConvo.votes.choice2} votes</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${percentage1}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Total: {totalVotes} votes
              </div>
            </div>
          </div>
        )}

      </div>

      <aside className="p-4 rounded-2xl bg-white shadow-sm border h-fit">
        <div className="space-y-4">
          {hasVoted ? (
            <button
              onClick={getNextPair}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 text-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Next Conversation
            </button>
          ) : (
            <button
              onClick={onStartNew}
              className="w-full px-6 py-4 rounded-xl bg-gray-900 text-white hover:opacity-90 text-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg border-2 border-gray-700"
            >
              Start New Conversation
            </button>
          )}
          
          <div className="p-4 rounded-xl bg-gray-50 border">
            <h3 className="font-semibold mb-3 text-center">Voting Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="text-gray-600">
                <div className="font-medium">Conversations:</div>
                <div className="text-lg font-bold text-blue-600">
                  {currentIndex + 1} of {PREDEFINED_CONVERSATIONS.length}
                </div>
              </div>
              <div className="text-gray-600">
                <div className="font-medium">Total Votes:</div>
                <div className="text-lg font-bold text-purple-600">{totalVotes}</div>
              </div>
              <div className="text-gray-600">
                <div className="font-medium">Your Vote:</div>
                <div className="text-lg font-bold text-green-600">
                  {hasVoted ? `Stranger ${userVote}` : 'Pending'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ComplimentCard({
  label,
  text,
  onVote,
  disabled = false,
  voted = false,
}: {
  label: string;
  text: string;
  onVote: () => void;
  disabled?: boolean;
  voted?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
      voted ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300' : 'bg-white'
    }`}>
      <div className={`h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0 ${
        voted ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-900'
      }`}>
        {label.includes("Stranger 1") ? "1" : "2"}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-sm text-gray-700">{text}</div>
      </div>
      <button
        onClick={onVote}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
          voted 
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
            : disabled 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
        }`}
      >
        {voted ? '✓ Voted' : disabled ? 'Voted' : 'Vote'}
      </button>
    </div>
  );
}

function Stats({
  convos,
}: {
  convos: Conversation[];
  onVote: (id: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  
  // Only show conversations the user has actually had (with compliments)
  const userConvos = convos.filter((c) => c.compliments);
  
  // Filter conversations based on search term and date
  const filteredConvos = userConvos.filter((c) => {
    const matchesSearch = searchTerm === "" || 
      c.compliments!.person1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.compliments?.stranger && c.compliments.stranger.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDate = selectedDate === "" || 
      new Date(c.createdAt).toDateString() === new Date(selectedDate).toDateString();
    
    return matchesSearch && matchesDate;
  });

  // Get unique dates for calendar
  const availableDates = [...new Set(userConvos.map(c => new Date(c.createdAt).toDateString()))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (userConvos.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white shadow-sm border text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">NO CONVOS YET</h2>
        <p className="text-gray-600 mb-6">
          Start chatting to see your conversation stats and how people vote on your compliments!
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
        >
          Start Your First Chat
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="p-4 rounded-2xl bg-white shadow-sm border">
        <h2 className="text-lg font-semibold mb-2">My Conversation Stats</h2>
        <p className="text-sm text-gray-600 mb-4">
          View your chat history and see how the community voted on your compliments
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Compliments
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for keywords in compliments..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Date Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => setSelectedDate("")}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                title="Clear date filter"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        
        {/* Quick Date Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedDate("")}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              selectedDate === "" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            All Dates
          </button>
          {availableDates.slice(0, 5).map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                selectedDate === date 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {new Date(date).toLocaleDateString()}
            </button>
          ))}
        </div>
        
        {/* Results Summary */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredConvos.length} of {userConvos.length} conversations
          {searchTerm && ` matching "${searchTerm}"`}
          {selectedDate && ` from ${new Date(selectedDate).toLocaleDateString()}`}
        </div>
      </div>

      {/* Conversations List */}
      <div className="grid gap-4">
        {filteredConvos.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white shadow-sm border text-center">
            <p className="text-gray-600">
              {searchTerm || selectedDate 
                ? "No conversations match your filters. Try adjusting your search or date filter."
                : "No conversations found."
              }
            </p>
          </div>
        ) : (
          filteredConvos.map((c) => {
            // Generate simulated vote results for user's conversations
            const simulatedVotes = c.votes || {
              p1: Math.floor(Math.random() * 15) + 5, // 5-20 votes for user
              p2: Math.floor(Math.random() * 15) + 5  // 5-20 votes for stranger
            };
            
            const tv = simulatedVotes.p1 + simulatedVotes.p2;
            const p1 = Math.round((simulatedVotes.p1 / tv) * 100);
            const p2 = Math.round((simulatedVotes.p2 / tv) * 100);
            
            return (
              <div key={c.id} className="p-4 rounded-2xl bg-white border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.chatMode === "human" ? "👥 Human Chat" : "🤖 AI Chat"}
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-2">Compliments</div>
                <div className="text-sm text-gray-800 space-y-3">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                    <span className="font-medium text-blue-800">Your Compliment:</span>{" "}
                    <span className="text-blue-700">{c.compliments!.person1}</span>
                  </div>
                  {c.compliments?.stranger && (
                    <div className="p-3 rounded-xl bg-gray-50 border">
                      <span className="font-medium text-gray-800">Stranger's Compliment:</span>{" "}
                      <span className="text-gray-700">{c.compliments.stranger}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-xs text-gray-600 mb-2">Community Vote Results</div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                      style={{ width: `${p1}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-gray-600">
                    <span className="font-medium text-blue-600">
                      You: {p1}% ({simulatedVotes.p1} votes)
                    </span>
                    <span className="font-medium text-gray-600">
                      Stranger: {p2}% ({simulatedVotes.p2} votes)
                    </span>
                    <span className="text-gray-500">Total: {tv}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    {p1 > p2 ? "🎉 Your compliment won!" : p1 < p2 ? "👏 Stranger's compliment won!" : "🤝 It's a tie!"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

