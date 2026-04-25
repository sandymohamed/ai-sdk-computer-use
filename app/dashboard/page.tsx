"use client";

import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { getDesktopURL } from "@/lib/sandbox/utils";

// Define proper types
interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  output?: Record<string, unknown>;
}

interface Session {
  id: string;
  name: string;
  messages: Message[];
  toolCalls: ToolCall[];
  createdAt: number;
  isActive: boolean;
}

// Mobile menu component
function MobileMenu({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateSession,
  onDeleteSession
}: {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  activeSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-gray-50 z-50 shadow-xl flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Sessions</h2>
          <button onClick={onClose} className="text-gray-500 text-xl">✕</button>
        </div>
        <div className="p-4">
          <button
            onClick={onCreateSession}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
          >
            + New Session
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => {
                onSwitchSession(session.id);
                onClose();
              }}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100 transition ${activeSessionId === session.id ? "bg-blue-50 border-r-2 border-blue-500" : ""
                }`}
            >
              <span className="text-sm truncate flex-1">{session.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="text-gray-400 hover:text-red-500 ml-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Resizable Panel Component (Desktop only)
function ResizablePanels({ children }: { children: [ReactNode, ReactNode] }) {
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const container = document.getElementById("panels-container");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    if (newWidth > 20 && newWidth < 80) {
      setLeftWidth(newWidth);
      localStorage.setItem("panel-width", newWidth.toString());
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const saved = localStorage.getItem("panel-width");
    if (saved) setLeftWidth(parseFloat(saved));
  }, []);

  return (
    <div id="panels-container" className="flex-1 flex overflow-hidden">
      <div style={{ width: `${leftWidth}%` }} className="min-w-[300px]">
        {children[0]}
      </div>
      <div
        className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors"
        onMouseDown={() => setIsDragging(true)}
      />
      <div style={{ width: `${100 - leftWidth}%` }} className="min-w-[300px]">
        {children[1]}
      </div>
    </div>
  );
}

// Simple chat hook
interface UseSimpleChatProps {
  api: string;
  body: Record<string, unknown>;
}

interface UseSimpleChatReturn {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  isLoading: boolean;
  toolCalls: ToolCall[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setToolCalls: React.Dispatch<React.SetStateAction<ToolCall[]>>;
}

function useSimpleChat({ api, body }: UseSimpleChatProps): UseSimpleChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage], ...body }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        role: "assistant",
        content: "",
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("0:")) {
            const content = JSON.parse(line.slice(2));
            assistantMessage.content += content;
            setMessages(prev => prev.map(m =>
              m.id === assistantMessage.id ? { ...m, content: assistantMessage.content } : m
            ));
          } else if (line.startsWith("c:")) {
            const newToolCalls = JSON.parse(line.slice(2));
            setToolCalls(prev => [...prev, ...newToolCalls]);
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    input,
    handleInputChange: (e: any) => setInput(e.target.value),
    handleSubmit,
    isLoading,
    toolCalls,
    setMessages,
    setToolCalls
  };
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolCall | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("default");
  const [debugOpen, setDebugOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'tools' | 'desktop'>('chat');
  const [isMobile, setIsMobile] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, toolCalls, setMessages, setToolCalls } = useSimpleChat({
    api: "/api/chat",
    body: { sandboxId },
  });

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setMounted(true);
    getDesktopURL().then(({ streamUrl, id }) => {
      setStreamUrl(streamUrl);
      setSandboxId(id);
    });
  }, []);

  // Load sessions from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboard-sessions');
      if (stored) {
        const parsed = JSON.parse(stored) as Session[];
        setSessions(parsed);
        if (parsed.length > 0) {
          const active = parsed.find((s: Session) => s.isActive) || parsed[0];
          setActiveSessionId(active.id);
          if (active.messages) setMessages(active.messages);
          if (active.toolCalls) setToolCalls(active.toolCalls);
        }
      } else {
        const defaultSession: Session = {
          id: 'default',
          name: 'Session 1',
          messages: [],
          toolCalls: [],
          createdAt: Date.now(),
          isActive: true
        };
        setSessions([defaultSession]);
      }
    }
  }, [setMessages, setToolCalls]);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0 && typeof window !== 'undefined' && mounted) {
      const updatedSessions = sessions.map(s => ({
        ...s,
        messages: s.id === activeSessionId ? messages : s.messages,
        toolCalls: s.id === activeSessionId ? toolCalls : s.toolCalls,
        isActive: s.id === activeSessionId
      }));
      localStorage.setItem('dashboard-sessions', JSON.stringify(updatedSessions));
    }
  }, [sessions, activeSessionId, messages, toolCalls, mounted]);

  const createSession = useCallback(() => {
    const newId = crypto.randomUUID();
    const newSession: Session = {
      id: newId,
      name: `Session ${sessions.length + 1}`,
      messages: [],
      toolCalls: [],
      createdAt: Date.now(),
      isActive: true
    };
    setSessions(prev => prev.map(s => ({ ...s, isActive: false })));
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newId);
    setMessages([]);
    setToolCalls([]);
    setSelectedTool(null);
  }, [sessions.length, setMessages, setToolCalls]);

  const switchSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;

    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setMessages(session.messages || []);
      setToolCalls(session.toolCalls || []);
      setSelectedTool(null);
      setSessions(prev => prev.map(s => ({ ...s, isActive: s.id === sessionId })));
    }
  }, [activeSessionId, sessions, setMessages, setToolCalls]);

  const deleteSession = useCallback((sessionId: string) => {
    if (sessions.length === 1) return;
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (activeSessionId === sessionId) {
      const newActive = newSessions[0];
      setActiveSessionId(newActive.id);
      setMessages(newActive.messages || []);
      setToolCalls(newActive.toolCalls || []);
    }
  }, [sessions, activeSessionId, setMessages, setToolCalls]);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Mobile Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ☰
          </button>
          <h1 className="font-semibold text-sm">AI Agent Dashboard</h1>
          <button
            onClick={createSession}
            className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm"
          >
            + New
          </button>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="bg-white border-b flex">
          {[
            { id: 'chat', label: '💬 Chat', icon: '💬' },
            { id: 'tools', label: '🔧 Tools', icon: '🔧' },
            { id: 'desktop', label: '🖥️ Desktop', icon: '🖥️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-medium transition ${activeMobileTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500'
                }`}
            >
              <span className="hidden xs:inline">{tab.label}</span>
              <span className="xs:hidden">{tab.icon}</span>
            </button>
          ))}
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-auto">
          {/* Chat Tab */}
          {activeMobileTab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto p-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-20">
                    <p className="text-4xl mb-2">🤖</p>
                    <p className="font-medium">AI Agent Dashboard</p>
                    <p className="text-sm mt-2">Try: "What's the weather in Dubai?"</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-gray-100 rounded-lg p-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t bg-white">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask something..."
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeMobileTab === 'tools' && (
            <div className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                🔧 Tool Calls
                {toolCalls.length > 0 && (
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">{toolCalls.length}</span>
                )}
              </h3>

              {toolCalls.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No tool calls yet.<br />
                  Try asking: "What's the weather in Dubai?"
                </div>
              ) : (
                <div className="space-y-3">
                  {toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTool(tool)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${selectedTool?.name === tool.name
                          ? "border-blue-500 bg-blue-50"
                          : "bg-white hover:border-gray-300"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-600">{tool.name}</span>
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">success</span>
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">Input:</span>
                        <pre className="mt-1 text-[11px] bg-gray-100 p-2 rounded overflow-auto">
                          {JSON.stringify(tool.arguments, null, 2)}
                        </pre>
                      </div>
                      {selectedTool?.name === tool.name && selectedTool.output && (
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-xs font-semibold text-gray-600">Output:</span>
                          <pre className="mt-1 text-[11px] bg-green-50 p-2 rounded overflow-auto text-green-700">
                            {JSON.stringify(selectedTool.output, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desktop Tab */}
          {activeMobileTab === 'desktop' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 bg-black">
                {streamUrl ? (
                  <iframe src={streamUrl} className="w-full h-full" title="Desktop Stream" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-900 text-white">
                    Loading desktop...
                  </div>
                )}
              </div>
              {/* Debug Panel on Mobile */}
              <div className="border-t bg-white">
                <button
                  onClick={() => setDebugOpen(!debugOpen)}
                  className="w-full p-3 flex justify-between items-center hover:bg-gray-50 text-sm"
                >
                  <span>🐛 Debug Panel ({toolCalls.length} tool calls)</span>
                  <span>{debugOpen ? "▼" : "▶"}</span>
                </button>
                {debugOpen && (
                  <div className="h-32 overflow-auto p-2 bg-gray-50 text-xs font-mono">
                    {toolCalls.length === 0 && <div className="text-gray-400">No tool calls yet</div>}
                    {toolCalls.map((tool, i) => (
                      <div key={i} className="border-b py-1">
                        <span className="font-bold">{tool.name}</span>
                        <pre className="text-[10px] mt-1">{JSON.stringify(tool.arguments, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={switchSession}
          onCreateSession={createSession}
          onDeleteSession={deleteSession}
        />
      </div>
    );
  }

  // Desktop Layout (Original)
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header with Session Controls */}
      <div className="border-b bg-white px-4 py-2 flex items-center justify-between">
        <h1 className="font-semibold">AI Agent Dashboard</h1>
        <button
          onClick={createSession}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          + New Session
        </button>
      </div>

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Session Sidebar */}
        <div className="w-48 border-r bg-gray-50 flex flex-col">
          <div className="p-2 border-b">
            <p className="text-xs font-semibold text-gray-500 uppercase">Sessions</p>
          </div>
          <div className="flex-1 overflow-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => switchSession(session.id)}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 transition ${activeSessionId === session.id ? "bg-blue-50 border-r-2 border-blue-500" : ""
                  }`}
              >
                <span className="text-sm truncate flex-1">{session.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="text-gray-400 hover:text-red-500 ml-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Resizable Panels */}
        <ResizablePanels>
          {/* Left Panel - Chat */}
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto p-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-20">
                  <p className="text-4xl mb-2">🤖</p>
                  <p className="font-medium">AI Agent Dashboard</p>
                  <p className="text-sm mt-2">Try: <span className="bg-gray-100 px-2 py-1 rounded">"What's the weather in Dubai?"</span></p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
                      }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask 'What's the weather in Dubai?'..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Debug Panel */}
            <div className="border-t">
              <button
                onClick={() => setDebugOpen(!debugOpen)}
                className="w-full p-2 flex justify-between items-center hover:bg-gray-50 text-sm"
              >
                <span>🐛 Debug Panel ({toolCalls.length} tool calls)</span>
                <span>{debugOpen ? "▼" : "▶"}</span>
              </button>
              {debugOpen && (
                <div className="h-40 overflow-auto p-2 bg-gray-50 text-xs font-mono">
                  {toolCalls.length === 0 && <div className="text-gray-400">No tool calls yet</div>}
                  {toolCalls.map((tool, i) => (
                    <div key={i} className="border-b py-1">
                      <span className="font-bold">{tool.name}</span>
                      <pre className="text-[10px] mt-1">{JSON.stringify(tool.arguments, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Tool Details + VNC */}
          <div className="h-full flex flex-col">
            {/* VNC Viewer */}
            <div className="h-1/2 border-b bg-black">
              {streamUrl ? (
                <iframe src={streamUrl} className="w-full h-full" title="Desktop Stream" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-900 text-white">
                  Loading desktop...
                </div>
              )}
            </div>

            {/* Tool Calls Section */}
            <div className="h-1/2 p-4 overflow-auto">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                🔧 Tool Calls
                {toolCalls.length > 0 && (
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">{toolCalls.length}</span>
                )}
              </h3>

              {toolCalls.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No tool calls yet.<br />
                  Try asking: "What's the weather in Dubai?"
                </div>
              ) : (
                <div className="space-y-3">
                  {toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTool(tool)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${selectedTool?.name === tool.name && selectedTool?.arguments?.location === tool.arguments?.location
                          ? "border-blue-500 bg-blue-50"
                          : "hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-600">{tool.name}</span>
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">success</span>
                        </div>
                        <span className="text-xs text-gray-400">click to expand →</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">Input:</span>
                        <pre className="mt-1 text-[11px] bg-gray-100 p-2 rounded overflow-auto">
                          {JSON.stringify(tool.arguments, null, 2)}
                        </pre>
                      </div>
                      {selectedTool?.name === tool.name && selectedTool?.arguments?.location === tool.arguments?.location && selectedTool.output && (
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-xs font-semibold text-gray-600">Output:</span>
                          <pre className="mt-1 text-[11px] bg-green-50 p-2 rounded overflow-auto text-green-700">
                            {JSON.stringify(selectedTool.output, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ResizablePanels>
      </div>
    </div>
  );
}