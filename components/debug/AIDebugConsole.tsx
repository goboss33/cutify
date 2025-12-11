import React, { useEffect, useState, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCcw, Trash2, Terminal, Image as ImageIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Types matching backend/services/ai_logger.py
interface AILog {
    id: string;
    timestamp: number;
    service: string;
    prompt: string;
    images: string[];
    response_images?: string[];
    response?: string;
    error?: string;
    status: "success" | "error";
}

// API Helper (assuming API_BASE is globally available or we use relative path)
const API_BASE = "http://localhost:8000";

export function AIDebugConsole() {
    const [logs, setLogs] = useState<AILog[]>([]);
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/debug/ai-logs`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
                if (!selectedLogId && data.length > 0) {
                    setSelectedLogId(data[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to fetch logs", e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearLogs = async () => {
        try {
            await fetch(`${API_BASE}/api/debug/ai-logs`, { method: "DELETE" });
            setLogs([]);
            setSelectedLogId(null);
        } catch (e) {
            console.error("Failed to clear logs", e);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000); // Polling every 3s
        return () => clearInterval(interval);
    }, []);

    const selectedLog = logs.find(l => l.id === selectedLogId);

    return (
        <div className="flex h-full w-full bg-background text-foreground overflow-hidden">
            {/* Sidebar List */}
            <div className="w-[350px] border-r border-border flex flex-col bg-muted/20">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-bold flex items-center gap-2">
                        <Terminal className="w-4 h-4" /> AI Console
                    </h2>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isLoading}>
                            <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={clearLogs}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col p-2 gap-2">
                        {logs.map((log) => (
                            <button
                                key={log.id}
                                onClick={() => setSelectedLogId(log.id)}
                                className={cn(
                                    "flex flex-col items-start p-3 rounded-lg text-left transition-colors border",
                                    selectedLogId === log.id
                                        ? "bg-primary/10 border-primary/50"
                                        : "bg-background border-border hover:bg-muted"
                                )}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <Badge variant="outline" className="text-[10px] bg-background/50">
                                        {log.service}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                        {new Date(log.timestamp * 1000).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-xs line-clamp-2 font-mono text-muted-foreground w-full">
                                    {log.prompt.slice(0, 100)}...
                                </div>
                                {log.status === "error" && (
                                    <Badge variant="destructive" className="mt-2 text-[10px] h-4">Error</Badge>
                                )}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Content (Chat View) */}
            <div className="flex-1 flex flex-col h-full bg-background/50 backdrop-blur-3xl">
                {selectedLog ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border bg-background/80 backdrop-blur-md z-10 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-lg">{selectedLog.service}</h3>
                                <p className="text-xs text-muted-foreground">ID: {selectedLog.id}</p>
                            </div>
                            <Badge variant={selectedLog.status === "success" ? "default" : "destructive"}>
                                {selectedLog.status.toUpperCase()}
                            </Badge>
                        </div>

                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-8 max-w-4xl mx-auto">
                                {/* PROMPT SECTION */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-primary font-medium">
                                        <MessageSquare className="w-4 h-4" /> USER (PROMPT)
                                    </div>

                                    {/* Images (Reference) */}
                                    {selectedLog.images && selectedLog.images.length > 0 && (
                                        <div className="flex gap-4 overflow-x-auto pb-2">
                                            {selectedLog.images.map((img, idx) => (
                                                <div key={idx} className="relative group rounded-md overflow-hidden border border-border shadow-sm">
                                                    <img
                                                        src={img.startsWith("http") ? img : `${API_BASE}${img.startsWith('/') ? '' : '/'}${img}`}
                                                        alt={`Reference ${idx}`}
                                                        className="h-32 w-auto object-cover"
                                                    />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-white truncate">
                                                        Ref Image
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}


                                    {/* Text Prompt */}
                                    <Card className="bg-muted/30 border-primary/20">
                                        <CardContent className="p-4">
                                            <pre className="whitespace-pre-wrap font-mono text-sm text-muted-foreground leading-relaxed">
                                                {selectedLog.prompt}
                                            </pre>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* RESPONSE SECTION */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-green-500 font-medium">
                                        <Terminal className="w-4 h-4" /> AI RESPONSE
                                    </div>

                                    {/* Response Images */}
                                    {selectedLog.response_images && selectedLog.response_images.length > 0 && (
                                        <div className="flex gap-4 overflow-x-auto pb-2 mb-2">
                                            {selectedLog.response_images.map((img, idx) => (
                                                <div key={idx} className="relative group rounded-md overflow-hidden border border-border shadow-sm">
                                                    <img
                                                        src={img.startsWith("http") ? img : `${API_BASE}${img.startsWith('/') ? '' : '/'}${img}`}
                                                        alt={`Result ${idx}`}
                                                        className="h-64 w-auto object-contain bg-black/20"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Card className={cn("border-l-4", selectedLog.status === "error" ? "border-l-destructive bg-destructive/10" : "border-l-green-500 bg-green-500/5")}>
                                        <CardContent className="p-4">
                                            {selectedLog.error ? (
                                                <div className="text-destructive font-mono text-sm">
                                                    Error: {selectedLog.error}
                                                </div>
                                            ) : (
                                                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                                    {selectedLog.response || "No text response"}
                                                </pre>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </ScrollArea>
                    </div >
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a log entry to view details
                    </div>
                )
                }
            </div >
        </div >
    );
}

export default AIDebugConsole;
