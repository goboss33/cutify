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
    Folder,
} from "lucide-react";
import {
    MOCK_PROJECT,
    CURRENT_USER,
    MOCK_MESSAGES,
    Message,
} from "@/lib/mockData";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export function ProductionSidebar() {
    const { activeTab, setActiveTab } = useStore();

    return (
        <aside className="border-r border-border bg-sidebar flex flex-col h-full text-sidebar-foreground">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center shrink-0">
                        <span className="font-bold text-primary-foreground">C</span>
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold truncate text-sm">
                            {MOCK_PROJECT.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {MOCK_PROJECT.duration}
                        </span>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
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
                            {MOCK_MESSAGES.map((msg: Message) => {
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
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-4 border-t border-border mt-auto shrink-0 bg-sidebar/50 backdrop-blur-sm">
                        <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                // Handle submit
                            }}
                        >
                            <div className="relative flex-1">
                                <Input
                                    placeholder="Write a message..."
                                    className="pr-10 bg-background/50"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button type="submit" size="icon">
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
