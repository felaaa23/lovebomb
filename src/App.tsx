import { useEffect, useMemo, useRef, useState } from "react";
import OpenAI from "openai";
import { socketService } from "./socketService";

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
};

type MatchData = {
  roomId: string;
  partnerId: string;
  startTime: number;
  duration: number;
};

type VotingPair = {
  id: string;
  messages: Array<{ userId: string; message: string; timestamp: number }>;
  compliments: Record<string, string>;
  timestamp: number;
  votes?: { choice1: number; choice2: number };
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
          <Home onStart={() => setRoute("chat-mode")} onVote={() => setRoute("vote")} />
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
                Tap <span className="font-bold text-blue-600">Chat</span> to
                start a 60-second conversation with an AI-powered stranger.
              </p>
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                When time runs out, you'll enter a compliment about your
                conversation partner.
              </p>
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                Head to <span className="font-bold text-blue-600">Vote</span>{" "}
                to see compliments and pick which one you like better.
              </p>
              <p className="text-2xl text-gray-700 leading-relaxed text-left">
                See live percentages and check{" "}
                <span className="font-bold text-blue-600">My Stats</span> to
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
  const [queuePosition, setQueuePosition] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);
  const [location, setLocation] = useState('Global');
  const [globalStats, setGlobalStats] = useState({
    queueLength: 0,
    totalOnline: 0,
    timestamp: 0
  });

  useEffect(() => {
    // Connect to socket when component mounts
    socketService.connect();

    // Set up socket listeners
    socketService.onQueueStatus((data) => {
      setQueuePosition(data.position);
      setTotalInQueue(data.total);
    });

    socketService.onMatched((matchData) => {
      setIsInQueue(false);
      onMatched(matchData);
    });

    socketService.onQueueLeft(() => {
      setIsInQueue(false);
    });

    // Listen for global queue status updates
    socketService.onGlobalQueueStatus((data) => {
      setGlobalStats(data);
    });

    return () => {
      // Clean up listeners when component unmounts
      socketService.removeAllListeners();
    };
  }, [onMatched]);

  const joinQueue = () => {
    setIsInQueue(true);
    socketService.joinQueue(location);
  };

  const leaveQueue = () => {
    socketService.leaveQueue();
    setIsInQueue(false);
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
        
        {/* Real-time Statistics */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{globalStats.totalOnline}</div>
              <div className="text-gray-600">Online Now</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{globalStats.queueLength}</div>
              <div className="text-gray-600">In Queue</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Updated {globalStats.timestamp ? new Date(globalStats.timestamp).toLocaleTimeString() : 'Loading...'}
          </div>
        </div>
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
              <p className="text-gray-600 mb-2">
                Position in queue: <span className="font-bold text-blue-600">{queuePosition}</span> of {totalInQueue}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Location: <span className="font-medium text-gray-700">{location}</span>
              </p>
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

  // Socket listeners for human chat mode
  useEffect(() => {
    if (convo.chatMode === "human") {
      // Listen for new messages from other users
      socketService.onNewMessage((data) => {
        const message: Message = {
          id: uid(),
          author: "Stranger",
          text: data.message,
          ts: data.timestamp,
        };
        const updatedConvo = { ...convo, messages: [...convo.messages, message] };
        updateConvo(updatedConvo);
      });

      // Listen for compliments from other users
      socketService.onComplimentReceived((data) => {
        const updatedConvo = {
          ...convo,
          compliments: {
            person1: convo.compliments?.person1 || "",
            stranger: data.compliment,
          },
        };
        updateConvo(updatedConvo);
      });

      // Listen for conversation completion
      socketService.onConversationComplete(() => {
        onFinish();
      });

      // Listen for user disconnection
      socketService.onUserDisconnected(() => {
        const message: Message = {
          id: uid(),
          author: "Stranger",
          text: "Your conversation partner has left the chat.",
          ts: Date.now(),
        };
        const updatedConvo = { ...convo, messages: [...convo.messages, message] };
        updateConvo(updatedConvo);
      });
    }

    return () => {
      if (convo.chatMode === "human") {
        socketService.removeAllListeners();
      }
    };
  }, [convo, updateConvo, onFinish]);

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
        // Human mode: send message via socket
        socketService.sendMessage(input.trim());
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
      // Human mode: submit compliment via socket
      socketService.submitCompliment(trimmedP1);
      
      const updated: Conversation = {
        ...convo,
        compliments: { 
          person1: trimmedP1,
          stranger: "" // Will be filled when other user submits their compliment
        },
        votes: convo.votes ?? { p1: 0, p2: 0 },
      };
      updateConvo(updated);
      // Note: onFinish will be called when both compliments are received via socket
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
  onHome,
}: {
  onStartNew: () => void;
  onHome: () => void;
}) {
  const [votingPairs, setVotingPairs] = useState<VotingPair[]>([]);
  const [currentPair, setCurrentPair] = useState<VotingPair | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteResults, setVoteResults] = useState<{
    choice1: number;
    choice2: number;
    totalVotes: number;
  } | null>(null);

  useEffect(() => {
    // Connect to socket when component mounts
    socketService.connect();

    // Listen for voting data
    socketService.onVotingData((data) => {
      setVotingPairs(data);
      if (data.length > 0) {
        setCurrentPair(data[0]);
        // Get initial vote results (blurred)
        socketService.getVoteResults(data[0].id, false);
      }
    });

    // Listen for vote results
    socketService.onVoteResults((data) => {
      setVoteResults({
        choice1: data.percentages.choice1,
        choice2: data.percentages.choice2,
        totalVotes: data.totalVotes
      });
      if (data.hasVoted) {
        setHasVoted(true);
      }
    });

    // Request voting data when component mounts
    socketService.getVotingData();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  const castVote = (choice: 1 | 2) => {
    if (!currentPair || hasVoted) return;
    
    // Submit vote via socket
    socketService.submitVote(currentPair.id, choice, socketService.connect().id || 'anonymous');
    setHasVoted(true);
  };

  const getNewPair = () => {
    if (votingPairs.length > 1) {
      const randomIndex = Math.floor(Math.random() * (votingPairs.length - 1));
      const newPair = votingPairs[randomIndex];
      setCurrentPair(newPair);
      setHasVoted(false);
      setVoteResults(null);
      // Get blurred results for new pair
      socketService.getVoteResults(newPair.id, false);
    }
  };

  if (!currentPair || votingPairs.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white shadow-sm border">
        <h2 className="text-lg font-semibold mb-2">
          {votingPairs.length === 0 ? "No conversations available to vote on" : "Loading conversations..."}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {votingPairs.length === 0 
            ? "No completed conversations are available for voting yet. Start some conversations to see voting options!" 
            : "Preparing conversations for you to vote on."}
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

  // Get compliments from the current voting pair
  const compliments = Object.values(currentPair.compliments);
  const compliment1 = compliments[0] || "";
  const compliment2 = compliments[1] || "";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 p-4 rounded-2xl bg-white shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Vote: Which compliment is better?
          </h2>
          <button
            onClick={getNewPair}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            🔄 New Pair
          </button>
        </div>

        <div className="space-y-4">
          <ComplimentCard
            label="Compliment A"
            text={compliment1}
            onVote={() => castVote(1)}
            disabled={hasVoted}
          />
          <ComplimentCard
            label="Compliment B"
            text={compliment2}
            onVote={() => castVote(2)}
            disabled={hasVoted}
          />
        </div>

        {/* Vote Statistics */}
        {voteResults && (
          <div className="mt-6 p-4 rounded-xl bg-gray-50 border">
            <h3 className="text-sm font-semibold mb-3">Vote Results</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className={`text-lg font-bold ${hasVoted ? 'text-blue-600' : 'text-gray-400 blur-sm'}`}>
                  {hasVoted ? `${voteResults.choice1}%` : '???'}
                </div>
                <div className="text-xs text-gray-600">Compliment A</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${hasVoted ? 'text-purple-600' : 'text-gray-400 blur-sm'}`}>
                  {hasVoted ? `${voteResults.choice2}%` : '???'}
                </div>
                <div className="text-xs text-gray-600">Compliment B</div>
              </div>
            </div>
            <div className="mt-3 text-center text-xs text-gray-500">
              {hasVoted ? `Total votes: ${voteResults.totalVotes}` : 'Vote to see results!'}
            </div>
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
                <div className="font-medium">Available Pairs:</div>
                <div className="text-lg font-bold text-blue-600">{votingPairs.length}</div>
              </div>
              <div className="text-gray-600">
                <div className="font-medium">Total Votes:</div>
                <div className="text-lg font-bold text-purple-600">{voteResults?.totalVotes || 0}</div>
              </div>
              <div className="text-gray-600">
                <div className="font-medium">Current Vote:</div>
                <div className="text-lg font-bold text-green-600">
                  {hasVoted ? 'Voted' : 'Pending'}
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
}: {
  label: string;
  text: string;
  onVote: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="p-4 rounded-2xl border bg-white flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
        {label.split(" ")[1] || label[0]}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-sm text-gray-700">{text}</div>
      </div>
      <button
        onClick={onVote}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
          disabled 
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
        }`}
      >
        {disabled ? 'Voted' : 'Vote'}
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
    const matchesSearch = searchTerm === "" || 
      c.compliments!.person1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.compliments?.stranger && c.compliments.stranger.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDate = selectedDate === "" || 
      new Date(c.createdAt).toDateString() === new Date(selectedDate).toDateString();
    
    return matchesSearch && matchesDate;
  });

  // Get unique dates for calendar
  const availableDates = [...new Set(mine.map(c => new Date(c.createdAt).toDateString()))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

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
            const tv = (c.votes?.p1 ?? 0) + (c.votes?.p2 ?? 0);
            const p1 = tv ? Math.round(((c.votes?.p1 ?? 0) / tv) * 100) : 0;
            const p2 = tv ? Math.round(((c.votes?.p2 ?? 0) / tv) * 100) : 0;
            return (
              <div key={c.id} className="p-4 rounded-2xl bg-white border shadow-sm">
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
                      <span className="font-medium">Stranger's Compliment:</span>{" "}
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
