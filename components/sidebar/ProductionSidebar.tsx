"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MessageSquare,
    Settings,
    Paperclip,
    Send,
    MoreHorizontal,
    LogOut,
} from "lucide-react";
import {
    MOCK_PROJECT,
    CURRENT_USER,
    MOCK_MESSAGES,
    Message,
} from "@/lib/mockData";
import { useStore } from "@/store/useStore";
import { useProject } from "@/store/ProjectContext";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserProfile } from "./UserProfile";

export function ProductionSidebar() {
    const { activeTab, setActiveTab } = useStore();
    const { currentProject, setCurrentProject } = useProject();
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [inputValue, setInputValue] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const router = useRouter();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load History when Project Changes
    React.useEffect(() => {
        if (!currentProject?.id) return;

        setIsLoading(true);
        fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/chat`)
            .then(res => res.json())
            .then(data => {
                // Map backend format to frontend Message
                // Backend: { id, role, content, timestamp }
                // Frontend: { id, senderId, text, timestamp }
                const mapped: Message[] = data.map((d: any) => ({
                    id: d.id,
                    senderId: d.role === "agent" ? "agent" : CURRENT_USER.id,
                    text: d.content,
                    timestamp: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));
                setMessages(mapped);
            })
            .catch(err => console.error("Failed to load history", err))
            .finally(() => setIsLoading(false));

    }, [currentProject?.id]);

    React.useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        if (currentProject?.id === undefined || currentProject?.id === null) {
            alert("No project selected.");
            return;
        }

        const userText = inputValue.trim();
        setInputValue("");
        setIsLoading(true);

        // Optimistic update
        const userMsg: Message = {
            id: Date.now().toString(),
            senderId: CURRENT_USER.id,
            text: userText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);

        if (currentProject.id === 0) {
            // Stateless Chat (Concept Phase)
            try {
                // Send history + new message to headless endpoint
                const response = await fetch("http://127.0.0.1:8000/api/chat/headless", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: messages, // Send full history for context
                        newMessage: userText
                    }),
                });

                if (!response.ok) throw new Error("Failed to send message");
                const data = await response.json();

                const agentMsg: Message = {
                    id: data.id,
                    senderId: "agent",
                    text: data.content,
                    timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                setMessages((prev) => [...prev, agentMsg]);
            } catch (error) {
                console.error("Error sending headless message:", error);
                const errorMsg: Message = {
                    id: Date.now().toString(),
                    senderId: "agent",
                    text: "Error: Could not reach the agent.",
                    timestamp: new Date().toLocaleTimeString()
                };
                setMessages((prev) => [...prev, errorMsg]);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Standard Project Chat
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({ content: userText }),
            });

            if (!response.ok) throw new Error("Failed to send message");

            const data = await response.json();

            // Agentic Refresh Logic
            if (data.action_taken) {
                console.log("Agent performed an action. Refreshing project data...");
                // Fetch updated project data
                try {
                    const projectRes = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}`, {
                        headers: {
                            "Authorization": token ? `Bearer ${token}` : ""
                        }
                    });
                    if (projectRes.ok) {
                        const updatedProject = await projectRes.json();
                        // Preserve local state if needed, but for now full replace is safer for deep changes
                        // Ensure we don't lose scenes if backend sends them, or we merge them?
                        // Backend Project model includes 'scenes' normally if relation lazy loading is handled or default.
                        // Our get_project_endpoint returns the ProjectDB.
                        // SQLAlchemy default loading might NOT include 'scenes' relationship unless joinedload is used or accessed.
                        // If 'scenes' is missing in response, we might lose them in context.
                        // Let's assume we merge:
                        setCurrentProject({ ...currentProject, ...updatedProject });
                    }
                } catch (refreshErr) {
                    console.error("Failed to refresh project:", refreshErr);
                }
            }

            const agentMsg: Message = {
                id: data.id,
                senderId: "agent",
                text: data.content,
                timestamp: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setMessages((prev) => [...prev, agentMsg]);
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMsg: Message = {
                id: Date.now().toString(),
                senderId: "agent",
                text: "Error: Could not reach the agent.",
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.refresh();
    };

    const handleValidateConcept = async () => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                alert("You must be logged in to create a project.");
                return;
            }

            const response = await fetch("http://127.0.0.1:8000/api/extract-concept", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ messages: messages }),
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error ${response.status}: ${errText}`);
            }
            const data = await response.json();
            setCurrentProject(data);
            alert(`Project "${data.title}" validated and created!`);
        } catch (error: any) {
            console.error("Extraction error:", error);
            alert("Failed to validate concept.\n" + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <aside className="border-r border-border bg-sidebar flex flex-col h-full text-sidebar-foreground">
            {/* Header - Simpler now, just Project Title */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 h-16 bg-sidebar/50 backdrop-blur-sm">
                <div className="flex flex-col w-full overflow-hidden">
                    {/* Project Title Input */}
                    <input
                        className="font-bold truncate text-base bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-full text-foreground"
                        value={currentProject ? currentProject.title : "Loading..."}
                        onChange={(e) => currentProject && setCurrentProject({ ...currentProject, title: e.target.value })}
                        onBlur={async (e) => {
                            if (!currentProject?.id) return;
                            try {
                                await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ title: e.target.value })
                                });
                            } catch (err) {
                                console.error(err);
                            }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        placeholder="Project Name"
                    />
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                        {currentProject?.status || "Draft"} • {currentProject?.genre || "No Genre"}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "chat" | "settings")}
                className="flex-1 flex flex-col h-full overflow-hidden"
            >
                <div className="px-4 pt-4 pb-2 shrink-0">
                    <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="chat" className="gap-2">
                            <MessageSquare className="h-4 w-4" /> Chat
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2">
                            <Settings className="h-4 w-4" /> Settings
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="chat" className="flex-1 flex flex-col mt-0 h-full overflow-hidden">
                    {/* Chat Body */}
                    <ScrollArea className="flex-1 p-4">
                        <div className="flex flex-col gap-4">
                            {!currentProject ? (
                                <div className="text-center text-muted-foreground text-sm p-4">
                                    Loading project context...
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg) => {
                                        const isMe = msg.senderId === CURRENT_USER.id;
                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex gap-3 max-w-[90%]",
                                                    isMe ? "ml-auto flex-row-reverse" : ""
                                                )}
                                            >
                                                {!isMe && (
                                                    <Avatar className="h-8 w-8 shrink-0">
                                                        <AvatarImage src="/avatars/agent.jpg" />
                                                        <AvatarFallback>AI</AvatarFallback>
                                                    </Avatar>
                                                )}
                                                <div
                                                    className={cn(
                                                        "rounded-lg p-3 text-sm",
                                                        isMe
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted text-foreground"
                                                    )}
                                                >
                                                    <p>{msg.text}</p>
                                                    <span className="text-[10px] opacity-50 mt-1 block">
                                                        {msg.timestamp}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {isLoading && (
                                        <div className="flex gap-3 max-w-[90%]">
                                            <Avatar className="h-8 w-8 shrink-0">
                                                <AvatarImage src="/avatars/agent.jpg" />
                                                <AvatarFallback>AI</AvatarFallback>
                                            </Avatar>
                                            <div className="bg-muted text-foreground rounded-lg p-3 text-sm flex items-center gap-2">
                                                <div className="animate-pulse w-2 h-2 bg-foreground/50 rounded-full"></div>
                                                <div className="animate-pulse w-2 h-2 bg-foreground/50 rounded-full delay-75"></div>
                                                <div className="animate-pulse w-2 h-2 bg-foreground/50 rounded-full delay-150"></div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t border-border mt-auto shrink-0 bg-sidebar/50 backdrop-blur-sm space-y-2">
                        <form
                            className="flex gap-2"
                            onSubmit={handleSendMessage}
                        >
                            <div className="relative flex-1">
                                <Input
                                    placeholder={isLoading ? "Waiting..." : "Write a message..."}
                                    className="pr-10 bg-background/50"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    disabled={isLoading || !currentProject}
                                />
                            </div>
                            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !currentProject}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </TabsContent>
                <TabsContent value="settings" className="p-4 mt-0">
                    <div className="text-sm text-muted-foreground text-center pt-8">
                        Settings panel placeholder
                    </div>
                </TabsContent>
            </Tabs>
        </aside>
    );
}
