import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCcw, Trash2, Terminal, Image as ImageIcon, MessageSquare, Code, FileJson, ArrowLeft, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/store/ProjectContext";
import { Project } from "@/lib/mockData";
import { createClient } from "@/lib/supabase/client";

// Types matching backend/services/ai_logger.py
interface AILog {
    id: string;
    timestamp: number;
    service: string;
    prompt: string;
    prompt_template?: string;  // Raw template with {{placeholders}}
    images: string[];
    response_images?: string[];
    response?: string;
    error?: string;
    status: "success" | "error";
}

// API Helper (assuming API_BASE is globally available or we use relative path)
const API_BASE = "http://localhost:8000";

// Helper function to render prompt with highlighting
// RAW mode: Shows template with {{placeholders}} highlighted in orange
// PAYLOAD mode: Shows interpolated prompt - only highlight values that replaced {{placeholders}}
function renderHighlightedPrompt(
    promptPayload: string,
    promptTemplate: string | undefined,
    mode: "raw" | "payload"
): React.ReactNode {

    if (mode === "raw" && promptTemplate) {
        // RAW MODE: Display template with {{placeholders}} highlighted in orange
        const lines = promptTemplate.split('\n');
        return lines.map((line, idx) => {
            // Highlight {{placeholder}} patterns
            const parts = line.split(/(\{\{[^}]+\}\})/g);
            return (
                <span key={idx}>
                    {parts.map((part, partIdx) => {
                        if (part.match(/^\{\{[^}]+\}\}$/)) {
                            // This is a placeholder - highlight in orange
                            return (
                                <span key={partIdx} className="bg-orange-500/30 text-orange-400 px-1 rounded font-semibold">
                                    {part}
                                </span>
                            );
                        }
                        return <span key={partIdx}>{part}</span>;
                    })}
                    {"\n"}
                </span>
            );
        });
    } else if (mode === "payload" && promptTemplate) {
        // PAYLOAD MODE with template: Compare line by line
        const templateLines = promptTemplate.split('\n');
        const payloadLines = promptPayload.split('\n');

        return payloadLines.map((payloadLine, idx) => {
            const templateLine = templateLines[idx] || "";

            // Check if template line contains {{placeholders}}
            if (templateLine.includes("{{")) {
                // Extract static parts from template (everything except placeholders)
                const staticParts = templateLine.split(/\{\{[^}]+\}\}/g).filter(p => p.length > 0);

                // Find the interpolated values in the payload line
                let result: React.ReactNode[] = [];
                let remaining = payloadLine;
                let partIndex = 0;

                for (const staticPart of staticParts) {
                    const staticIdx = remaining.indexOf(staticPart);

                    if (staticIdx > 0) {
                        // Part before static = interpolated value
                        const interpolated = remaining.slice(0, staticIdx);
                        result.push(
                            <span key={`val-${partIndex}`} className="bg-green-500/30 text-green-400 px-0.5 rounded">
                                {interpolated}
                            </span>
                        );
                    } else if (staticIdx === -1) {
                        // Static part not found, line changed completely
                        return <span key={idx} className="bg-green-500/30 text-green-400 px-0.5 rounded">{payloadLine}{"\n"}</span>;
                    }

                    // Add the static part as-is
                    result.push(<span key={`static-${partIndex}`}>{staticPart}</span>);
                    remaining = remaining.slice(staticIdx + staticPart.length);
                    partIndex++;
                }

                // Any remaining text is an interpolated value at the end
                if (remaining.length > 0) {
                    result.push(
                        <span key={`val-end`} className="bg-green-500/30 text-green-400 px-0.5 rounded">
                            {remaining}
                        </span>
                    );
                }

                return <span key={idx}>{result}{"\n"}</span>;
            }

            // No placeholders in template - show as-is
            return <span key={idx}>{payloadLine}{"\n"}</span>;
        });
    } else {
        // No template available - just show payload without highlighting
        return promptPayload.split('\n').map((line, idx) => (
            <span key={idx}>{line}{"\n"}</span>
        ));
    }
}

export function AIDebugConsole() {
    const [logs, setLogs] = useState<AILog[]>([]);
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [promptViewMode, setPromptViewMode] = useState<"raw" | "payload">("payload");
    const scrollRef = useRef<HTMLDivElement>(null);
    const userHasSelectedRef = useRef(false); // Track if user manually selected a log

    // Projects list for dropdown
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);

    // Get current project from context
    const { currentProject, setCurrentProject } = useProject();
    const router = useRouter();

    // Fetch all projects for dropdown
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                // Get Supabase session for auth token
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    console.log("No session found, user might not be logged in");
                    setIsLoadingProjects(false);
                    return;
                }

                const res = await fetch(`${API_BASE}/api/projects`, {
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log("Loaded projects:", data);
                    setProjects(data);
                } else {
                    console.error("Failed to fetch projects:", res.status, res.statusText);
                }
            } catch (e) {
                console.error("Failed to fetch projects", e);
            } finally {
                setIsLoadingProjects(false);
            }
        };
        fetchProjects();
    }, []);

    // Handle project selection from dropdown
    const handleProjectChange = (projectId: string) => {
        const project = projects.find(p => String(p.id) === projectId);
        if (project) {
            setCurrentProject(project);
            setLogs([]);
            setSelectedLogId(null);
            userHasSelectedRef.current = false;
        }
    };

    const fetchLogs = async () => {
        // Only fetch if a project is selected
        if (!currentProject?.id) {
            setLogs([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/debug/ai-logs?project_id=${currentProject.id}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
                // Only auto-select if user hasn't manually selected anything yet
                if (!userHasSelectedRef.current && data.length > 0) {
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
        if (!currentProject?.id) return;
        try {
            await fetch(`${API_BASE}/api/debug/ai-logs?project_id=${currentProject.id}`, { method: "DELETE" });
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
    }, [currentProject?.id]); // Re-fetch when project changes

    const selectedLog = logs.find(l => l.id === selectedLogId);

    return (
        <div className="flex h-full w-full bg-background text-foreground overflow-hidden">
            {/* Sidebar List */}
            <div className="w-[350px] border-r border-border flex flex-col bg-muted/20">
                <div className="p-4 border-b border-border flex flex-col gap-2">
                    {/* Back to project button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
                        onClick={() => router.push("/")}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour au projet
                    </Button>
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold flex items-center gap-2">
                            <Terminal className="w-4 h-4" /> AI Console
                        </h2>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isLoading || !currentProject}>
                                <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={clearLogs} disabled={!currentProject}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                    {/* Project Selector Dropdown */}
                    <Select
                        value={currentProject?.id ? String(currentProject.id) : ""}
                        onValueChange={handleProjectChange}
                    >
                        <SelectTrigger className="w-full bg-background/50 border-border">
                            <SelectValue placeholder={isLoadingProjects ? "Chargement..." : "Sélectionner un projet"} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map((project) => (
                                <SelectItem key={project.id} value={String(project.id)}>
                                    {project.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* Template Editor Button */}
                    <Link href="/templates">
                        <Button variant="outline" size="sm" className="w-full mt-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                            <Settings className="w-4 h-4 mr-2" />
                            Template Editor
                        </Button>
                    </Link>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col p-2 gap-2">
                        {logs.map((log) => (
                            <button
                                key={log.id}
                                onClick={() => {
                                    userHasSelectedRef.current = true;
                                    setSelectedLogId(log.id);
                                }}
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
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="p-4 border-b border-border bg-background/80 backdrop-blur-md z-10 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-semibold text-lg">{selectedLog.service}</h3>
                                <p className="text-xs text-muted-foreground">ID: {selectedLog.id}</p>
                            </div>
                            <Badge variant={selectedLog.status === "success" ? "default" : "destructive"}>
                                {selectedLog.status.toUpperCase()}
                            </Badge>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            <div className="space-y-8 max-w-4xl mx-auto pb-8">
                                {/* PROMPT SECTION */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-primary font-medium">
                                            <MessageSquare className="w-4 h-4" /> USER (PROMPT)
                                        </div>
                                        {/* RAW / PAYLOAD Toggle */}
                                        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                            <button
                                                onClick={() => setPromptViewMode("raw")}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                                    promptViewMode === "raw"
                                                        ? "bg-orange-500/20 text-orange-400 shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                )}
                                            >
                                                <Code className="w-3 h-3" />
                                                RAW
                                            </button>
                                            <button
                                                onClick={() => setPromptViewMode("payload")}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                                    promptViewMode === "payload"
                                                        ? "bg-green-500/20 text-green-400 shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                )}
                                            >
                                                <FileJson className="w-3 h-3" />
                                                PAYLOAD
                                            </button>
                                        </div>
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


                                    {/* Text Prompt with Highlighting */}
                                    <Card className={cn(
                                        "border-l-4 transition-colors",
                                        promptViewMode === "raw"
                                            ? "bg-orange-500/5 border-l-orange-500/50"
                                            : "bg-green-500/5 border-l-green-500/50"
                                    )}>
                                        <CardContent className="p-4">
                                            <pre className="whitespace-pre-wrap font-mono text-sm text-muted-foreground leading-relaxed">
                                                {renderHighlightedPrompt(selectedLog.prompt, selectedLog.prompt_template, promptViewMode)}
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
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                        <Terminal className="w-12 h-12 text-muted-foreground/30" />
                        {currentProject ? (
                            <>
                                <p>Sélectionnez un log pour voir les détails</p>
                                {logs.length === 0 && (
                                    <p className="text-sm text-muted-foreground/60">
                                        Aucun log AI pour ce projet. Lancez une génération pour voir les logs.
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-medium">Aucun projet sélectionné</p>
                                <p className="text-sm text-muted-foreground/60">
                                    Sélectionnez un projet dans la liste déroulante pour voir les logs AI.
                                </p>
                            </>
                        )}
                    </div>
                )
                }
            </div >
        </div >
    );
}

export default AIDebugConsole;
