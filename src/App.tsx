import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
};

type BottedMessage = {
  id: string;
  author: "Stranger1" | "Stranger2";
  text: string;
  ts: number;
};

type BottedConversation = {
  id: string;
  createdAt: number;
  messages: BottedMessage[];
  compliments: { stranger1: string; stranger2: string };
  votes: { stranger1: number; stranger2: number };
};

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

// Generate stranger's compliment
async function generateStrangerCompliment(
  conversationHistory: Message[]
): Promise<string> {
  try {
    const systemPrompt = `Based on the conversation you just had, write a genuine, specific compliment about the person you were chatting with. Focus on their personality, communication style, or something interesting they shared. Keep it warm and authentic.`;

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
const BOTTED_CONVOS_KEY = "botted-conversations-v1";

// Pre-generated botted conversations
const BOTTED_CONVERSATIONS: BottedConversation[] = [
  {
    id: "bot-1",
    createdAt: Date.now() - 86400000, // 1 day ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Hey! How's your day going?",
        ts: Date.now() - 86400000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "Pretty good! Just finished reading an amazing book. How about you?",
        ts: Date.now() - 86395000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's awesome! What book was it? I'm always looking for recommendations",
        ts: Date.now() - 86390000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "It was about sustainable living - really eye-opening! You seem like someone who'd appreciate thoughtful discussions",
        ts: Date.now() - 86385000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "That sounds fascinating! I'm always looking to learn more about environmental topics",
        ts: Date.now() - 86380000,
      },
    ],
    compliments: {
      stranger1:
        "The other person was extremely kind and had such thoughtful insights about environmental topics",
      stranger2:
        "The other person had such thoughtful questions and genuine curiosity that made our conversation so engaging",
    },
    votes: { stranger1: 23, stranger2: 31 },
  },
  {
    id: "bot-2",
    createdAt: Date.now() - 172800000, // 2 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Hi there! What's your favorite way to unwind after a long day?",
        ts: Date.now() - 172800000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I love cooking! There's something so therapeutic about chopping vegetables and creating something delicious",
        ts: Date.now() - 172795000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's so cool! I've been wanting to get into cooking more. Any tips for a beginner?",
        ts: Date.now() - 172790000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Start with simple recipes and don't be afraid to make mistakes! Your enthusiasm is really refreshing",
        ts: Date.now() - 172785000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "Thank you for the encouragement! This has been such a lovely chat",
        ts: Date.now() - 172780000,
      },
    ],
    compliments: {
      stranger1:
        "The other person was so encouraging and had such practical advice that made me feel really supported",
      stranger2:
        "The other person's enthusiasm and openness to learning new things was really inspiring and made our conversation delightful",
    },
    votes: { stranger1: 18, stranger2: 27 },
  },
  {
    id: "bot-3",
    createdAt: Date.now() - 259200000, // 3 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Hello! I'm trying to decide what to have for dinner tonight. Any suggestions?",
        ts: Date.now() - 259200000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I'm thinking of making a cozy pasta dish! What kind of cuisine do you usually enjoy?",
        ts: Date.now() - 259195000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "I love Italian food! Pasta sounds perfect for this weather",
        ts: Date.now() - 259190000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Great choice! Your taste in comfort food is spot on. Maybe try a simple aglio e olio?",
        ts: Date.now() - 259185000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "That sounds delicious! You have such good taste and are so helpful",
        ts: Date.now() - 259180000,
      },
    ],
    compliments: {
      stranger1:
        "The other person had such great taste and was incredibly helpful with their dinner suggestions",
      stranger2:
        "The other person's appreciation for good food and positive attitude made this conversation really enjoyable",
    },
    votes: { stranger1: 29, stranger2: 19 },
  },
  {
    id: "bot-4",
    createdAt: Date.now() - 345600000, // 4 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Good morning! What's the most interesting thing you've learned recently?",
        ts: Date.now() - 345600000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I learned about the concept of 'flow state' in psychology - it's fascinating how our brains work when we're fully engaged",
        ts: Date.now() - 345595000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's incredible! I've experienced that feeling but never knew there was a name for it. You explain things so clearly",
        ts: Date.now() - 345590000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Thank you! I love how curious and thoughtful you are. It's rare to find someone who appreciates learning like this",
        ts: Date.now() - 345585000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "This has been such an enlightening conversation. Thank you for sharing your knowledge!",
        ts: Date.now() - 345580000,
      },
    ],
    compliments: {
      stranger1:
        "The other person had such clear explanations and shared knowledge in such an engaging way",
      stranger2:
        "The other person's curiosity and thoughtful responses made our conversation really intellectually stimulating",
    },
    votes: { stranger1: 35, stranger2: 22 },
  },
  {
    id: "bot-5",
    createdAt: Date.now() - 432000000, // 5 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Hi! I'm having a bit of a stressful day. Any advice for staying positive?",
        ts: Date.now() - 432000000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I'm sorry to hear that! I find that taking a few deep breaths and focusing on one small thing I'm grateful for really helps",
        ts: Date.now() - 431995000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's such a thoughtful approach. You have such a calming presence even through text",
        ts: Date.now() - 431990000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Thank you for sharing that with me. Your openness and vulnerability is really brave and inspiring",
        ts: Date.now() - 431985000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "This chat has genuinely made me feel better. Thank you for your kindness",
        ts: Date.now() - 431980000,
      },
    ],
    compliments: {
      stranger1:
        "The other person had such a calming presence and gave such thoughtful advice when I was feeling stressed",
      stranger2:
        "The other person's openness and gratitude for the conversation was really touching and showed such emotional intelligence",
    },
    votes: { stranger1: 41, stranger2: 28 },
  },
  {
    id: "bot-6",
    createdAt: Date.now() - 518400000, // 6 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Hi! What's your favorite season and why?",
        ts: Date.now() - 518400000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I love autumn! There's something magical about the changing leaves and cozy sweaters. What about you?",
        ts: Date.now() - 518395000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "Spring for me! I love watching everything come back to life and the fresh air after winter",
        ts: Date.now() - 518390000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "That's beautiful! You have such an optimistic view of renewal. I can feel your energy through your words",
        ts: Date.now() - 518385000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "Thank you! Your appreciation for autumn's coziness really shows your thoughtful nature",
        ts: Date.now() - 518380000,
      },
    ],
    compliments: {
      stranger1:
        "The other person had such a beautiful perspective on renewal and optimism that was really inspiring",
      stranger2:
        "The other person's appreciation for life's simple pleasures and thoughtful observations made our chat so warm",
    },
    votes: { stranger1: 33, stranger2: 45 },
  },
  {
    id: "bot-7",
    createdAt: Date.now() - 604800000, // 7 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "Hey! I'm trying to learn a new language. Any tips?",
        ts: Date.now() - 604800000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "That's awesome! I found watching movies with subtitles really helpful. What language are you learning?",
        ts: Date.now() - 604795000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "Spanish! That's a great tip. I love how encouraging and practical your advice is",
        ts: Date.now() - 604790000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "¡Buena suerte! Your enthusiasm for learning is contagious and really motivating",
        ts: Date.now() - 604785000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "¡Gracias! You're so supportive and your encouragement means a lot",
        ts: Date.now() - 604780000,
      },
    ],
    compliments: {
      stranger1:
        "The other person was incredibly supportive and gave such practical, encouraging advice for learning",
      stranger2:
        "The other person's enthusiasm for learning new things and appreciation for advice was really heartwarming",
    },
    votes: { stranger1: 27, stranger2: 38 },
  },
  {
    id: "bot-8",
    createdAt: Date.now() - 691200000, // 8 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "What's the best piece of advice you've ever received?",
        ts: Date.now() - 691200000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "To be kind to yourself first. It's hard to help others when you're not taking care of yourself",
        ts: Date.now() - 691195000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's so wise and thoughtful. You clearly have a deep understanding of self-care",
        ts: Date.now() - 691190000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Thank you! I can tell you're someone who really listens and reflects on what people share",
        ts: Date.now() - 691185000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "This conversation has been so meaningful. Thank you for sharing something so personal",
        ts: Date.now() - 691180000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's wisdom about self-care and their ability to share meaningful advice was really touching",
      stranger2:
        "The other person's thoughtful listening and genuine appreciation for personal sharing made this conversation special",
    },
    votes: { stranger1: 52, stranger2: 31 },
  },
  {
    id: "bot-9",
    createdAt: Date.now() - 777600000, // 9 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "I'm having trouble sleeping lately. Any suggestions?",
        ts: Date.now() - 777600000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I've been there! Try reading or listening to calming music before bed. Also, no screens an hour before sleep",
        ts: Date.now() - 777595000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "Those are really practical suggestions. Thank you for being so understanding and helpful",
        ts: Date.now() - 777590000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Of course! Your openness about struggling shows real courage. Sleep issues are so common",
        ts: Date.now() - 777585000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "You're so empathetic and non-judgmental. This has been really helpful",
        ts: Date.now() - 777580000,
      },
    ],
    compliments: {
      stranger1:
        "The other person was incredibly empathetic and gave such practical, non-judgmental advice about sleep issues",
      stranger2:
        "The other person's openness about their struggles and gratitude for help showed such emotional intelligence",
    },
    votes: { stranger1: 44, stranger2: 29 },
  },
  {
    id: "bot-10",
    createdAt: Date.now() - 864000000, // 10 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "What's something small that always makes you smile?",
        ts: Date.now() - 864000000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "Puppies and coffee in the morning! There's something about that combination that's pure joy",
        ts: Date.now() - 863995000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's adorable! I love how you find joy in simple, everyday things",
        ts: Date.now() - 863990000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "You have such a positive outlook! I can tell you appreciate the little moments in life too",
        ts: Date.now() - 863985000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "This conversation just made my day better. Thank you for sharing your joy!",
        ts: Date.now() - 863980000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's ability to find joy in simple things and share that positivity was really uplifting",
      stranger2:
        "The other person's appreciation for life's small pleasures and positive energy was contagious and delightful",
    },
    votes: { stranger1: 36, stranger2: 47 },
  },
  {
    id: "bot-11",
    createdAt: Date.now() - 950400000, // 11 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "I'm trying to be more mindful. Any tips for staying present?",
        ts: Date.now() - 950400000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "Start with just one mindful breath a day. Focus on the sensation of breathing. It's amazing how powerful that can be",
        ts: Date.now() - 950395000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's such a gentle, approachable way to start. Your advice is so practical and non-overwhelming",
        ts: Date.now() - 950390000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "I love how you're open to starting small. That shows real wisdom about building habits gradually",
        ts: Date.now() - 950385000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "Thank you for the encouragement. You have such a calming, supportive presence",
        ts: Date.now() - 950380000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's gentle, practical approach to mindfulness and supportive presence was really calming",
      stranger2:
        "The other person's openness to learning and appreciation for gradual progress showed such wisdom",
    },
    votes: { stranger1: 41, stranger2: 34 },
  },
  {
    id: "bot-12",
    createdAt: Date.now() - 1036800000, // 12 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "What's your favorite way to unwind after a stressful day?",
        ts: Date.now() - 1036800000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I love taking a long walk or doing some yoga. Movement really helps me process stress. How about you?",
        ts: Date.now() - 1036795000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That sounds so healthy! I usually read or listen to music. Your approach is really proactive",
        ts: Date.now() - 1036790000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Reading is wonderful too! I love how you recognize different ways of coping. Everyone's different",
        ts: Date.now() - 1036785000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "You're so accepting of different approaches. That's a really valuable quality",
        ts: Date.now() - 1036780000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's healthy approach to stress management and acceptance of different coping methods was really valuable",
      stranger2:
        "The other person's recognition of different approaches and appreciation for individual differences showed great insight",
    },
    votes: { stranger1: 38, stranger2: 42 },
  },
  {
    id: "bot-13",
    createdAt: Date.now() - 1123200000, // 13 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "What's something you're grateful for today?",
        ts: Date.now() - 1123200000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I'm grateful for this conversation! And for having clean water and a warm home. The basics we sometimes take for granted",
        ts: Date.now() - 1123195000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's so thoughtful and humble. I love how you appreciate both big and small things",
        ts: Date.now() - 1123190000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Your question about gratitude shows you're someone who values mindfulness and reflection",
        ts: Date.now() - 1123185000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "This has been such a meaningful exchange. Thank you for sharing your perspective",
        ts: Date.now() - 1123180000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's humble appreciation for life's basics and thoughtful perspective on gratitude was really inspiring",
      stranger2:
        "The other person's thoughtful questions about gratitude and appreciation for meaningful conversation showed great depth",
    },
    votes: { stranger1: 49, stranger2: 26 },
  },
  {
    id: "bot-14",
    createdAt: Date.now() - 1209600000, // 14 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "I'm feeling a bit overwhelmed with work lately. Any advice?",
        ts: Date.now() - 1209600000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I've been there! Try breaking big tasks into smaller ones and take breaks between them. You don't have to do everything at once",
        ts: Date.now() - 1209595000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That's really practical advice. I love how you normalize the feeling and offer concrete solutions",
        ts: Date.now() - 1209590000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Your openness about feeling overwhelmed shows courage. It's okay to ask for help and take things step by step",
        ts: Date.now() - 1209585000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "Thank you for being so understanding and supportive. This really helps",
        ts: Date.now() - 1209580000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's practical advice about managing overwhelm and supportive, understanding approach was really helpful",
      stranger2:
        "The other person's openness about struggles and appreciation for practical help showed such emotional maturity",
    },
    votes: { stranger1: 43, stranger2: 32 },
  },
  {
    id: "bot-15",
    createdAt: Date.now() - 1296000000, // 15 days ago
    messages: [
      {
        id: "m1",
        author: "Stranger1",
        text: "What's your favorite way to connect with nature?",
        ts: Date.now() - 1296000000,
      },
      {
        id: "m2",
        author: "Stranger2",
        text: "I love hiking and just sitting by a lake. There's something so peaceful about being surrounded by trees and water",
        ts: Date.now() - 1295995000,
      },
      {
        id: "m3",
        author: "Stranger1",
        text: "That sounds so serene! I love how you describe it - you clearly have a deep connection with nature",
        ts: Date.now() - 1295990000,
      },
      {
        id: "m4",
        author: "Stranger2",
        text: "Your question about nature shows you're someone who values that connection too. It's so important for wellbeing",
        ts: Date.now() - 1295985000,
      },
      {
        id: "m5",
        author: "Stranger1",
        text: "This conversation has been so refreshing. Thank you for sharing your love of nature",
        ts: Date.now() - 1295980000,
      },
    ],
    compliments: {
      stranger1:
        "The other person's deep connection with nature and ability to describe peaceful experiences was really refreshing",
      stranger2:
        "The other person's appreciation for nature and recognition of its importance for wellbeing showed great wisdom",
    },
    votes: { stranger1: 35, stranger2: 48 },
  },
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
      console.warn("Failed to save to localStorage:", error);
    }
  }, [key, value]);
  return [value, setValue] as const;
}

// --- App Shell ---
export default function App() {
  const [route, setRoute] = useState<"home" | "chat" | "vote" | "stats">(
    "home"
  );
  const [convos, setConvos] = useLocalStore<Conversation[]>(STORAGE_KEY, []);
  const [bottedConvos, setBottedConvos] = useLocalStore<BottedConversation[]>(
    BOTTED_CONVOS_KEY,
    BOTTED_CONVERSATIONS
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) || null,
    [convos, activeId]
  );

  const goHome = () => setRoute("home");
  const startChat = () => {
    const convo: Conversation = {
      id: uid(),
      createdAt: Date.now(),
      messages: [],
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
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
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
            onClick={startChat}
            className={`px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 border-2 ${
              route === "chat"
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
          <button
            onClick={() => setRoute("stats")}
            className={`ml-auto px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 border-2 ${
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
          <Home onStart={startChat} onVote={() => setRoute("vote")} />
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
            bottedConvos={bottedConvos}
            setBottedConvos={setBottedConvos}
            onStartNew={startChat}
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

// --- Pages ---
function Home({
  onStart,
  onVote,
}: {
  onStart: () => void;
  onVote: () => void;
}) {
  const [heroRef, isHeroVisible] = useScrollAnimation();
  const [descriptionRef, isDescriptionVisible] = useScrollAnimation();
  const [buttonsRef, isButtonsVisible] = useScrollAnimation();

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div
        ref={heroRef}
        className={`text-center py-12 transition-all duration-1000 ${
          isHeroVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Compliment Chat
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Connect with strangers, share genuine compliments, and discover what
          makes conversations meaningful.
        </p>
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
          className="px-12 py-6 rounded-2xl bg-gray-900 text-white hover:opacity-90 text-xl font-bold transition-all duration-200 hover:scale-105 shadow-xl border-2 border-gray-700"
        >
          Start 1-minute Chat
        </button>
        <button
          onClick={onVote}
          className="px-12 py-6 rounded-2xl bg-gray-100 hover:bg-gray-200 text-xl font-bold transition-all duration-200 hover:scale-105 shadow-xl border-2 border-gray-300 hover:border-gray-400"
        >
          Go to Voting
        </button>
      </div>

      {/* Description Section */}
      <div
        ref={descriptionRef}
        className={`transition-all duration-1000 delay-400 ${
          isDescriptionVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        <div className="text-center space-y-6">
          <h2 className="text-5xl font-bold text-gray-800 mb-8">
            How it works
          </h2>
          <div className="space-y-8 max-w-4xl mx-auto">
            <p className="text-2xl text-gray-700 leading-relaxed">
              Tap <span className="font-bold text-blue-600">Chat</span> to start
              a 60-second conversation with an AI-powered stranger.
            </p>
            <p className="text-2xl text-gray-700 leading-relaxed">
              When time runs out, you'll enter a compliment about your
              conversation partner.
            </p>
            <p className="text-2xl text-gray-700 leading-relaxed">
              Head to <span className="font-bold text-blue-600">Vote</span> to
              see compliments and pick which one you like better.
            </p>
            <p className="text-2xl text-gray-700 leading-relaxed">
              See live percentages and check{" "}
              <span className="font-bold text-blue-600">My Stats</span> to track
              your performance.
            </p>
          </div>
        </div>
      </div>

      {/* Example Chat Section */}
      <div
        ref={descriptionRef}
        className={`transition-all duration-1000 delay-600 ${
          isDescriptionVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-8">
            Example Conversation
          </h2>
          <div className="max-w-2xl mx-auto">
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
                  <div>
                    Great! Just finished reading an interesting book. How about
                    you?
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">You</div>
                  <div>
                    Nice! What book was it? I love getting book recommendations
                  </div>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">Stranger</div>
                  <div>
                    It was about sustainable living - really eye-opening! You
                    seem like someone who'd appreciate thoughtful discussions
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gray-900 text-white rounded-2xl px-4 py-3 text-sm">
                  <div className="opacity-70 text-xs mb-1">You</div>
                  <div>
                    That sounds fascinating! I'm always looking to learn more
                    about environmental topics
                  </div>
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

    // If user sends a message, generate bot response
    if (author === "You") {
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
    }
  };

  const saveCompliments = async () => {
    const trimmedP1 = p1.trim();
    if (!trimmedP1) return;

    try {
      // Generate stranger's compliment
      const strangerCompliment = await generateStrangerCompliment(
        convo.messages
      );

      const updated: Conversation = {
        ...convo,
        compliments: {
          person1: trimmedP1,
          stranger: strangerCompliment,
        },
        votes: convo.votes ?? { p1: 0, p2: 0 },
      };
      updateConvo(updated);
      onFinish();
    } catch (error) {
      console.error("Error generating stranger compliment:", error);
      // Fallback if AI fails
      const updated: Conversation = {
        ...convo,
        compliments: {
          person1: trimmedP1,
          stranger:
            "You have such a positive energy that really brightened our conversation!",
        },
        votes: convo.votes ?? { p1: 0, p2: 0 },
      };
      updateConvo(updated);
      onFinish();
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 h-[calc(100vh-180px)]">
      <div className="md:col-span-2 rounded-2xl bg-white shadow-sm border flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <h2 className="text-lg font-semibold">Live Chat</h2>
          <span className="text-sm px-3 py-1 rounded-full bg-white shadow-sm">
            {fmtTime(secondsLeft)}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gradient-to-b from-white to-gray-50">
          {convo.messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-end gap-3 ${
                m.author === "You" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  m.author === "You"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-400 text-white"
                }`}
              >
                {m.author === "You" ? "U" : "S"}
              </div>
              <div
                className={`max-w-[75%] ${
                  m.author === "You"
                    ? "flex flex-col items-end"
                    : "flex flex-col items-start"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1 px-2">
                  {m.author}
                </div>
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
                  window.location.href = "/";
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
                <h4 className="text-sm font-semibold text-blue-800 mb-2">
                  💬 Stranger's Compliment
                </h4>
                <p className="text-sm text-blue-700 italic">
                  "{convo.compliments.stranger}"
                </p>
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
  bottedConvos,
  setBottedConvos,
  onStartNew,
  onHome,
}: {
  bottedConvos: BottedConversation[];
  setBottedConvos: React.Dispatch<React.SetStateAction<BottedConversation[]>>;
  onStartNew: () => void;
  onHome: () => void;
}) {
  const [currentConvoIndex, setCurrentConvoIndex] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const currentConvo = bottedConvos[currentConvoIndex];

  const nextConvo = () => {
    setCurrentConvoIndex((prev) => (prev + 1) % bottedConvos.length);
    setHasVoted(false); // Reset voting state when changing conversations
  };

  const castVote = (userId: "stranger1" | "stranger2") => {
    setBottedConvos((prev) =>
      prev.map((c) => {
        if (c.id !== currentConvo.id) return c;
        return {
          ...c,
          votes: {
            ...c.votes,
            [userId]: c.votes[userId] + 1,
          },
        };
      })
    );
    setHasVoted(true); // Mark that user has voted
  };

  if (!currentConvo) {
    return (
      <div className="p-6 rounded-2xl bg-white shadow-sm border">
        <h2 className="text-lg font-semibold mb-2">
          No conversations available
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          There are no botted conversations to vote on at the moment.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onStartNew}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:opacity-90"
          >
            Start a New Chat
          </button>
          <button
            onClick={onHome}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  const totalVotes =
    currentConvo.votes.stranger1 + currentConvo.votes.stranger2;
  const stranger1Percentage =
    totalVotes > 0
      ? Math.round((currentConvo.votes.stranger1 / totalVotes) * 100)
      : 0;
  const stranger2Percentage =
    totalVotes > 0
      ? Math.round((currentConvo.votes.stranger2 / totalVotes) * 100)
      : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 p-4 rounded-2xl bg-white shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Vote: Which conversation resonated more with you?
          </h2>
          {!hasVoted && (
            <div className="text-sm text-gray-500">
              Conversation {currentConvoIndex + 1} of {bottedConvos.length}
            </div>
          )}
        </div>

        {/* Conversation Display */}
        <div className="mb-6 p-4 rounded-xl bg-gray-50 border">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">
            Conversation
          </h3>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {currentConvo.messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.author === "Stranger1" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    m.author === "Stranger1"
                      ? "bg-blue-100 text-blue-900"
                      : "bg-green-100 text-green-900"
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {m.author}
                  </div>
                  <div>{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliments */}
        <div className="space-y-4">
          <ComplimentCard
            label="Stranger 1's Compliment"
            text={currentConvo.compliments.stranger1}
            onVote={() => castVote("stranger1")}
            isUser1={true}
            disabled={hasVoted}
          />
          <ComplimentCard
            label="Stranger 2's Compliment"
            text={currentConvo.compliments.stranger2}
            onVote={() => castVote("stranger2")}
            isUser1={false}
            disabled={hasVoted}
          />
        </div>

        {/* Vote Statistics - Always show after user has voted */}
        {hasVoted && (
          <div className="mt-6 p-4 rounded-xl bg-gray-50 border">
            <h3 className="text-sm font-semibold mb-3">
              Community Vote Results
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {stranger1Percentage}%
                </div>
                <div className="text-xs text-gray-600">Stranger 1</div>
                <div className="text-xs text-gray-500">
                  ({currentConvo.votes.stranger1} votes)
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {stranger2Percentage}%
                </div>
                <div className="text-xs text-gray-600">Stranger 2</div>
                <div className="text-xs text-gray-500">
                  ({currentConvo.votes.stranger2} votes)
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-xs text-gray-500">
              Total votes: {totalVotes}
            </div>
          </div>
        )}

        {/* Next Conversation Button - Only show after user has voted */}
        {hasVoted && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={nextConvo}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
            >
              <span className="text-lg">➡️</span>
              Next Conversation
            </button>
          </div>
        )}
      </div>

      <aside className="p-4 rounded-2xl bg-white shadow-sm border h-fit">
        <div className="space-y-4">
          <button
            onClick={onStartNew}
            className="w-full px-6 py-4 rounded-xl bg-gray-900 text-white hover:opacity-90 text-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg border-2 border-gray-700"
          >
            Start New Conversation
          </button>

          <div className="p-4 rounded-xl bg-gray-50 border">
            <h3 className="font-semibold mb-3 text-center">Voting Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="text-gray-600">
                <div className="font-medium">Available Conversations:</div>
                <div className="text-lg font-bold text-blue-600">
                  {bottedConvos.length}
                </div>
              </div>
              <div className="text-gray-600">
                <div className="font-medium">Current Conversation:</div>
                <div className="text-lg font-bold text-purple-600">
                  {currentConvoIndex + 1}
                </div>
              </div>
              <div className="text-gray-600">
                <div className="font-medium">Total Votes Cast:</div>
                <div className="text-lg font-bold text-green-600">
                  {bottedConvos.reduce(
                    (sum, c) => sum + c.votes.stranger1 + c.votes.stranger2,
                    0
                  )}
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
  isUser1 = true,
  disabled = false,
}: {
  label: string;
  text: string;
  onVote: () => void;
  isUser1?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border bg-white flex items-start gap-3 ${
        isUser1 ? "border-blue-200" : "border-green-200"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <div
        className={`h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0 ${
          isUser1 ? "bg-blue-600" : "bg-green-600"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {isUser1 ? "1" : "2"}
      </div>
      <div className="flex-1">
        <div
          className={`text-sm font-medium mb-1 ${
            isUser1 ? "text-blue-800" : "text-green-800"
          }`}
        >
          {label}
        </div>
        <div className="text-sm text-gray-700">{text}</div>
      </div>
      <button
        onClick={onVote}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
          disabled
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : isUser1
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-green-600 hover:bg-green-700 text-white"
        }`}
      >
        {disabled ? "Voted" : "Vote"}
      </button>
    </div>
  );
}

function Stats({
  convos,
  onVote,
}: {
  convos: Conversation[];
  onVote: (id: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const mine = convos.filter((c) => c.compliments);

  // Filter conversations based on search term and date
  const filteredConvos = mine.filter((c) => {
    const matchesSearch =
      searchTerm === "" ||
      c.compliments!.person1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.compliments?.stranger &&
        c.compliments.stranger
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));

    const matchesDate =
      selectedDate === "" ||
      new Date(c.createdAt).toDateString() ===
        new Date(selectedDate).toDateString();

    return matchesSearch && matchesDate;
  });

  // Get unique dates for calendar
  const availableDates = [
    ...new Set(mine.map((c) => new Date(c.createdAt).toDateString())),
  ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (mine.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white shadow-sm border">
        <h2 className="text-lg font-semibold mb-2">No stats yet</h2>
        <p className="text-sm text-gray-600">
          Finish a chat and add compliments to see how people vote on them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="p-4 rounded-2xl bg-white shadow-sm border">
        <h2 className="text-lg font-semibold mb-4">My Conversation Stats</h2>

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
          Showing {filteredConvos.length} of {mine.length} conversations
          {searchTerm && ` matching "${searchTerm}"`}
          {selectedDate &&
            ` from ${new Date(selectedDate).toLocaleDateString()}`}
        </div>
      </div>

      {/* Conversations List */}
      <div className="grid gap-4">
        {filteredConvos.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white shadow-sm border text-center">
            <p className="text-gray-600">
              {searchTerm || selectedDate
                ? "No conversations match your filters. Try adjusting your search or date filter."
                : "No conversations found."}
            </p>
          </div>
        ) : (
          filteredConvos.map((c) => {
            const tv = (c.votes?.p1 ?? 0) + (c.votes?.p2 ?? 0);
            const p1 = tv ? Math.round(((c.votes?.p1 ?? 0) / tv) * 100) : 0;
            const p2 = tv ? Math.round(((c.votes?.p2 ?? 0) / tv) * 100) : 0;
            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-white border shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                  <button
                    onClick={() => onVote(c.id)}
                    className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
                  >
                    Open in Vote
                  </button>
                </div>
                <div className="text-sm text-gray-700 mb-2">Compliments</div>
                <div className="text-sm text-gray-800 space-y-3">
                  <div className="p-3 rounded-xl bg-gray-50 border">
                    <span className="font-medium">Your Compliment:</span>{" "}
                    {c.compliments!.person1}
                  </div>
                  {c.compliments?.stranger && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="font-medium">
                        Stranger's Compliment:
                      </span>{" "}
                      {c.compliments.stranger}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900"
                      style={{ width: `${p1}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-gray-600">
                    <span>
                      Person 1: {p1}% ({c.votes?.p1 ?? 0})
                    </span>
                    <span>
                      Person 2: {p2}% ({c.votes?.p2 ?? 0})
                    </span>
                    <span>Total: {tv}</span>
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
