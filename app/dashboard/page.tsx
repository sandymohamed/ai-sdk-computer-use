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
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

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
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("dashboard-sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="border-b bg-white px-4 py-2 flex justify-between items-center">
        <h1 className="font-semibold">AI Agent Dashboard</h1>
        <button
          onClick={createNewSession}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          + New Session
        </button>
      </div>

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
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 transition ${
                  activeSessionId === session.id ? "bg-blue-50 border-r-2 border-blue-500" : ""
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

        <ResizablePanels>
          {/* Left Panel - Chat */}
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
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
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

            <div className="p-4 border-t">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask a question..."
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

            <div className="border-t">
              <button
                onClick={() => setDebugOpen(!debugOpen)}
                className="w-full p-2 flex justify-between items-center hover:bg-gray-50 text-sm"
              >
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

          {/* Right Panel - VNC + Tool Details */}
          <div className="h-full flex flex-col">
            {/* VNC Viewer */}
            <div className="h-1/2 border-b bg-black">
              {streamUrl ? (
                <iframe src={streamUrl} className="w-full h-full" title="Desktop Stream" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-4">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🖥️</div>
                    <p className="text-sm font-medium">Desktop Stream</p>
                    <p className="text-xs text-gray-400 mt-2">Loading...</p>
                  </div>
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
                  Try asking: &quot;What is the weather in Dubai?&quot;
                </div>
              ) : (
                <div className="space-y-3">
                  {toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTool(tool)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedTool?.name === tool.name && selectedTool?.id === tool.id
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
                      {selectedTool?.id === tool.id && selectedTool.output && (
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
