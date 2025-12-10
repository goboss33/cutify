"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MessageSquare,
    Send,
    X,
    Minimize2,
    Maximize2
} from "lucide-react";
import {
    CURRENT_USER,
    Message,
} from "@/lib/mockData";
import { useProject } from "@/store/ProjectContext";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function ChatWidget() {
    const { currentProject, setCurrentProject } = useProject();
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [inputValue, setInputValue] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load History when Project Changes or Widget Opens
    React.useEffect(() => {
        if (!currentProject?.id || !isOpen) return;

        // If we already have messages for this project, maybe don't re-fetch immediately? 
        // For simplicity, let's fetch to be safe aka "re-connect".
        setIsLoading(true);
        fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/chat`)
            .then(res => res.json())
            .then(data => {
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

    }, [currentProject?.id, isOpen]);

    React.useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        if (!currentProject) {
            alert("No project selected.");
            return;
        }

        const userText = inputValue.trim();
        setInputValue("");
        setIsLoading(true);

        const userMsg: Message = {
            id: Date.now().toString(),
            senderId: CURRENT_USER.id,
            text: userText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Handle Stateless Chat (Concept Phase ID=0) differently if needed, 
            // but for now assuming standard flow as per previous code structure, 
            // or we adapt the 'headless' check from previous sidebar if ID=0.
            let response;
            if (currentProject.id === 0) {
                response = await fetch("http://127.0.0.1:8000/api/chat/headless", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: messages,
                        newMessage: userText
                    }),
                });
            } else {
                response = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/chat`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": token ? `Bearer ${token}` : ""
                    },
                    body: JSON.stringify({ content: userText }),
                });
            }

            if (!response.ok) throw new Error("Failed to send message");

            const data = await response.json();

            // Refetch project if agent took action (only for real projects)
            if (data.action_taken && currentProject.id !== 0) {
                const projectRes = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}`, {
                    headers: {
                        "Authorization": token ? `Bearer ${token}` : ""
                    }
                });
                if (projectRes.ok) {
                    const updatedProject = await projectRes.json();
                    setCurrentProject({ ...currentProject, ...updatedProject });
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

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <Card className="w-[400px] h-[600px] flex flex-col shadow-2xl border-primary/20 pointer-events-auto bg-background/95 backdrop-blur-sm animate-in slide-in-from-bottom-5">
                    <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="/avatars/agent.jpg" />
                                <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-sm font-bold">Assistant</CardTitle>
                                <p className="text-xs text-muted-foreground">{currentProject?.title || "No Project"}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full p-4">
                            <div className="flex flex-col gap-4">
                                {!currentProject ? (
                                    <div className="text-center text-muted-foreground text-sm p-4">
                                        Select a project to start chatting.
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
                                                        <Avatar className="h-6 w-6 shrink-0 mt-1">
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
                                                <Avatar className="h-6 w-6 shrink-0 mt-1">
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
                    </CardContent>

                    <CardFooter className="p-3 border-t bg-muted/20">
                        <form
                            className="flex gap-2 w-full"
                            onSubmit={handleSendMessage}
                        >
                            <Input
                                placeholder={isLoading ? "Waiting..." : "Ask for help..."}
                                className="flex-1 bg-background"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading || !currentProject}
                            />
                            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !currentProject}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            {/* Toggle Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    size="lg"
                    className="h-14 w-14 rounded-full shadow-lg pointer-events-auto bg-primary hover:bg-primary/90 transition-transform hover:scale-105"
                >
                    <MessageSquare className="h-6 w-6 text-primary-foreground" />
                </Button>
            )}
        </div>
    );
}
