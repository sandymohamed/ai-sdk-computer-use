"use client";

import { useState, useEffect, useCallback } from "react";
import { getDesktopURL } from "@/lib/sandbox/utils";

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
}

type MobileTab = 'chat' | 'tools' | 'desktop';

// Mobile Menu Component
function MobileMenu({ isOpen, onClose, sessions, activeSessionId, onSwitchSession, onCreateSession, onDeleteSession }: { 
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
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-xl flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Sessions</h2>
          <button onClick={onClose} className="text-gray-500 text-xl">✕</button>
        </div>
        <div className="p-4">
          <button onClick={onCreateSession} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600">
            + New Session
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {sessions.map((session) => (
            <div key={session.id} className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-100 ${activeSessionId === session.id ? "bg-blue-50" : ""}`}>
              <span onClick={() => { onSwitchSession(session.id); onClose(); }} className="flex-1 text-sm">{session.name}</span>
              <button onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }} className="text-gray-400 hover:text-red-500 ml-2">×</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ResizablePanels({ children }: { children: [React.ReactNode, React.ReactNode] }) {
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

function useSimpleChat({ api, body, sessionId, onSaveSession }: { 
  api: string; 
  body: Record<string, unknown>;
  sessionId: string;
  onSaveSession: (messages: Message[], toolCalls: ToolCall[]) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  useEffect(() => {
    if (messages.length > 0 || toolCalls.length > 0) {
      onSaveSession(messages, toolCalls);
    }
  }, [messages, toolCalls, onSaveSession]);

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
        body: JSON.stringify({ messages: [...messages, userMessage], ...body, sessionId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        toolCalls: []
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
            assistantMessage.toolCalls = newToolCalls;
            setMessages(prev => prev.map(m => 
              m.id === assistantMessage.id ? { ...m, toolCalls: newToolCalls } : m
            ));
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
    toolCalls,
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value),
    handleSubmit,
    isLoading,
    setMessages,
    setToolCalls
  };
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolCall | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('chat');
  const [isMobile, setIsMobile] = useState(false);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  // Check mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const saveCurrentSession = useCallback((messages: Message[], toolCalls: ToolCall[]) => {
    if (!activeSessionId) return;
    
    setSessions(prev => prev.map(session => 
      session.id === activeSessionId 
        ? { ...session, messages, toolCalls }
        : session
    ));
  }, [activeSessionId]);

  const { messages, input, toolCalls, handleInputChange, handleSubmit, isLoading, setMessages, setToolCalls } = useSimpleChat({
    api: "/api/chat",
    body: { sandboxId },
    sessionId: activeSessionId,
    onSaveSession: saveCurrentSession
  });

  const createNewSession = useCallback(() => {
    const newId = crypto.randomUUID();
    const newSession: Session = {
      id: newId,
      name: `Session ${sessions.length + 1}`,
      messages: [],
      toolCalls: [],
      createdAt: Date.now()
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newId);
    setMessages([]);
    setToolCalls([]);
    setSelectedTool(null);
  }, [sessions.length, setMessages, setToolCalls]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("dashboard-sessions");
    if (stored) {
      const parsed = JSON.parse(stored) as Session[];
      setSessions(parsed);
      if (parsed.length > 0) {
        setActiveSessionId(parsed[0].id);
        setMessages(parsed[0].messages || []);
        setToolCalls(parsed[0].toolCalls || []);
      } else {
        createNewSession();
      }
    } else {
      createNewSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("dashboard-sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  const switchSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) return;
    
    saveCurrentSession(messages, toolCalls);
    
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setMessages(session.messages || []);
      setToolCalls(session.toolCalls || []);
      setSelectedTool(null);
    }
  }, [activeSessionId, messages, toolCalls, sessions, saveCurrentSession, setMessages, setToolCalls]);

  const deleteSession = useCallback((sessionId: string) => {
    if (sessions.length === 1) {
      setMessages([]);
      setToolCalls([]);
      setSelectedTool(null);
      return;
    }
    
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    
    if (activeSessionId === sessionId) {
      const newActive = newSessions[0];
      setActiveSessionId(newActive.id);
      setMessages(newActive.messages || []);
      setToolCalls(newActive.toolCalls || []);
      setSelectedTool(null);
    }
  }, [sessions, activeSessionId, setMessages, setToolCalls]);

  useEffect(() => {
    setMounted(true);
    getDesktopURL().then(({ streamUrl, id }) => {
      setStreamUrl(streamUrl);
      setSandboxId(id);
    });
  }, []);

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
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg text-xl">☰</button>
          <h1 className="font-semibold text-sm">AI Agent Dashboard</h1>
          <button onClick={createNewSession} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+ New</button>
        </div>

        <div className="bg-white border-b flex">
          {(['chat', 'tools', 'desktop'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveMobileTab(tab)} className={`flex-1 py-3 text-sm font-medium transition ${activeMobileTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
              {tab === 'chat' && '💬 Chat'}
              {tab === 'tools' && '🔧 Tools'}
              {tab === 'desktop' && '🖥️ Desktop'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {activeMobileTab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto p-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-20">
                    <p className="text-4xl mb-2">🤖</p>
                    <p className="font-medium">AI Agent Dashboard</p>
                    <p className="text-sm mt-2">Try: &quot;What is the weather in Dubai?&quot;</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"}`}>
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
              <div className="p-4 border-t bg-white">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input value={input} onChange={handleInputChange} placeholder="Ask a question..." disabled={isLoading} className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">Send</button>
                </form>
              </div>
            </div>
          )}

          {activeMobileTab === 'tools' && (
            <div className="p-4">
              <h3 className="font-semibold mb-3">🔧 Tool Calls ({toolCalls.length})</h3>
              {toolCalls.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">No tool calls yet.<br />Try asking about weather.</div>
              ) : (
                <div className="space-y-3">
                  {toolCalls.map((tool, idx) => (
                    <div key={idx} onClick={() => setSelectedTool(tool)} className={`border rounded-lg p-3 cursor-pointer ${selectedTool?.id === tool.id ? "border-blue-500 bg-blue-50" : "bg-white"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-bold text-blue-600">{tool.name}</span>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">success</span>
                      </div>
                      <pre className="text-xs bg-gray-100 p-2 rounded">{JSON.stringify(tool.arguments, null, 2)}</pre>
                      {selectedTool?.id === tool.id && tool.output && (
                        <div className="mt-2 pt-2 border-t">
                          <pre className="text-xs bg-green-50 p-2 rounded text-green-700">{JSON.stringify(tool.output, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMobileTab === 'desktop' && (
            <div className="h-full">
              <div className="h-96 bg-black">
                {streamUrl ? <iframe src={streamUrl} className="w-full h-full" title="Desktop" /> : <div className="flex items-center justify-center h-full text-white">Loading desktop...</div>}
              </div>
              <div className="border-t bg-white">
                <button onClick={() => setDebugOpen(!debugOpen)} className="w-full p-3 flex justify-between items-center">
                  <span>Debug Panel ({toolCalls.length} calls)</span>
                  <span>{debugOpen ? "▼" : "▶"}</span>
                </button>
                {debugOpen && (
                  <div className="h-32 overflow-auto p-2 bg-gray-50 text-xs">
                    {toolCalls.map((tool, i) => <div key={i} className="border-b py-1"><span className="font-bold">{tool.name}</span><pre className="text-[10px]">{JSON.stringify(tool.arguments, null, 2)}</pre></div>)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} sessions={sessions} activeSessionId={activeSessionId} onSwitchSession={switchSession} onCreateSession={createNewSession} onDeleteSession={deleteSession} />
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="border-b bg-white px-4 py-2 flex justify-between items-center">
        <h1 className="font-semibold">AI Agent Dashboard</h1>
        <button onClick={createNewSession} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">+ New Session</button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 border-r bg-gray-50 flex flex-col">
          <div className="p-2 border-b"><p className="text-xs font-semibold text-gray-500 uppercase">Sessions</p></div>
          <div className="flex-1 overflow-auto">
            {sessions.map((session) => (
              <div key={session.id} onClick={() => switchSession(session.id)} className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 ${activeSessionId === session.id ? "bg-blue-50 border-r-2 border-blue-500" : ""}`}>
                <span className="text-sm truncate flex-1">{session.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} className="text-gray-400 hover:text-red-500 ml-2">×</button>
              </div>
            ))}
          </div>
        </div>

        <ResizablePanels>
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto p-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-20">
                  <p className="text-4xl mb-2">🤖</p>
                  <p className="font-medium">AI Agent Dashboard</p>
                  <p className="text-sm mt-2">Try: &quot;What is the weather in Dubai?&quot;</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg p-3 ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && <div className="flex justify-start mb-4"><div className="bg-gray-100 rounded-lg p-3"><div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>}
            </div>
            <div className="p-4 border-t">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input value={input} onChange={handleInputChange} placeholder="Ask a question..." disabled={isLoading} className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">Send</button>
              </form>
            </div>
            <div className="border-t">
              <button onClick={() => setDebugOpen(!debugOpen)} className="w-full p-2 flex justify-between items-center hover:bg-gray-50 text-sm">
                <span>Debug Panel ({toolCalls.length} tool calls)</span>
                <span>{debugOpen ? "▼" : "▶"}</span>
              </button>
              {debugOpen && (
                <div className="h-40 overflow-auto p-2 bg-gray-50 text-xs font-mono">
                  {toolCalls.length === 0 && <div className="text-gray-400">No tool calls yet</div>}
                  {toolCalls.map((tool, i) => (
                    <div key={i} className="border-b py-1 cursor-pointer hover:bg-gray-100" onClick={() => setSelectedTool(tool)}>
                      <span className="font-bold">{tool.name}</span>
                      <pre className="text-[10px] mt-1">{JSON.stringify(tool.arguments, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="h-full flex flex-col">
            <div className="h-1/2 border-b bg-black">
              {streamUrl ? <iframe src={streamUrl} className="w-full h-full" title="Desktop Stream" /> : <div className="flex items-center justify-center h-full text-white">Loading desktop...</div>}
            </div>
            <div className="h-1/2 p-4 overflow-auto">
              <h3 className="font-semibold mb-3">🔧 Tool Calls ({toolCalls.length})</h3>
              {toolCalls.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">No tool calls yet.<br />Try asking about weather.</div>
              ) : (
                toolCalls.map((tool, idx) => (
                  <div key={idx} onClick={() => setSelectedTool(tool)} className={`border rounded-lg p-3 cursor-pointer mb-3 ${selectedTool?.id === tool.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold text-blue-600">{tool.name}</span>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">success</span>
                    </div>
                    <pre className="text-xs bg-gray-100 p-2 rounded">{JSON.stringify(tool.arguments, null, 2)}</pre>
                    {selectedTool?.id === tool.id && tool.output && (
                      <div className="mt-2 pt-2 border-t">
                        <pre className="text-xs bg-green-50 p-2 rounded text-green-700">{JSON.stringify(tool.output, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </ResizablePanels>
        
      </div>
    </div>
  );
}

