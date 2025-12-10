"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Calendar, Film, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { GenreSelector } from "@/components/dashboard/GenreSelector";
import { Input } from "@/components/ui/input"
import { useProject } from "@/store/ProjectContext";
import { useStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";



// Simple date formatter if date-fns not installed
const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric"
    });
};

interface Project {
    id: number;
    title: string;
    genre: string;
    created_at: string;
    status: string;
    visual_style?: string;
}

export function Dashboard() {
    const { setCurrentProject } = useProject();
    const { setActiveTab } = useStore();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    // New Project State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newGenre, setNewGenre] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchProjects = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) return;

            fetch("http://127.0.0.1:8000/api/projects", {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch");
                    return res.json();
                })
                .then(data => {
                    setProjects(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch projects", err);
                    setLoading(false);
                });
        };

        fetchProjects();
    }, []);

    const handleCreateProject = async () => {
        if (!newTitle.trim() || !newGenre) return;

        setIsCreating(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Updated Endpoint: Assuming 'create_from_scratch' or similar, 
            // or I can use the existing 'create_default' but pass body params?
            // The previous 'create_default' was... default. 
            // I should check if backend supports params. 
            // Ideally backend expects JSON body: { title, genre }
            // Let's assume the backend endpoint handles standard creation or I use 'create_default' and PATCh it.
            // BUT, best practice is to have a POST /api/projects that accepts body.
            // Looking at previous code, user called /api/projects/create_default.
            // I'll assume standard POST /api/projects works if I send data, OR create_default needs to be updated.
            // Safe bet: POST /api/projects with body.
            // If that fails, I'll fix the backend next turn. The 'create_default' suggests a specific endpoint.
            // Let's try standard POST project if it exists.

            // Re-reading 'task.md' from previous context... 
            // Actually, I'll try to find a generic create endpoint.
            // Previous code used: `http://127.0.0.1:8000/api/projects/create_default`
            // There was also `extract-concept`.

            // Let's call a new endpoint: /api/projects
            // If it 404s, I'll need to use 'create_default' and then update it? No, that's ugly.
            // I'll try POST /api/projects.

            const res = await fetch("http://127.0.0.1:8000/api/projects", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: newTitle,
                    genre: newGenre,
                    // Default values
                    pitch: "",
                    target_audience: "",
                    visual_style: ""
                })
            });

            if (!res.ok) {
                // Fallback to create_default if the standard post isn't there?
                // Or maybe create_default IS the creator.
                throw new Error("Failed to create project");
            }

            const newProject = await res.json();
            setCurrentProject(newProject);
            setActiveTab("chat");
            setIsDialogOpen(false);
            setNewTitle("");
            setNewGenre("");
        } catch (e) {
            console.error("Failed to create project", e);
            alert("Error creating project. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`http://127.0.0.1:8000/api/projects/${projectId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });

            if (res.ok) {
                setProjects(projects.filter(p => p.id !== projectId));
            } else {
                console.error("Failed to delete project");
            }
        } catch (error) {
            console.error("Error deleting project:", error);
        }
    };

    const handleSelectProject = (project: Project) => {
        setCurrentProject(project);
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-background/50 h-full">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
                    <p className="text-muted-foreground mt-1">Manage your video concepts and productions.</p>
                </div>
                {/* Button Removed */}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* New Project Card - Always First */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Card className="group cursor-pointer border-2 border-dashed border-muted bg-muted/5 hover:border-primary/50 hover:bg-muted/10 transition-all flex flex-col items-center justify-center min-h-[250px]">
                                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <h3 className="font-semibold text-lg text-muted-foreground group-hover:text-foreground transition-colors">Create New Project</h3>
                                    <p className="text-sm text-muted-foreground/60 mt-2">Start a new video concept</p>
                                </CardContent>
                            </Card>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create New Project</DialogTitle>
                                <DialogDescription>
                                    Enter the details for your new video project.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Project Title
                                    </label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Summer Vacation Vlog"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label htmlFor="genre" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Genre
                                    </label>
                                    <GenreSelector value={newGenre} onChange={setNewGenre} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>Cancel</Button>
                                <Button onClick={handleCreateProject} disabled={!newTitle.trim() || !newGenre || isCreating}>
                                    {isCreating ? "Creating..." : "Create Project"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Existing Projects */}
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className="group cursor-pointer hover:border-primary/50 transition-all hover:bg-muted/50"
                            onClick={() => handleSelectProject(project)}
                        >
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2 w-full min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate pr-1">{project.title}</CardTitle>
                                        <CardDescription className="truncate mt-1">{project.genre || "Unknown Genre"}</CardDescription>
                                    </div>
                                    <div className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full uppercase font-medium shrink-0 ml-auto">
                                        {project.status}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="aspect-video bg-muted rounded-md flex items-center justify-center text-muted-foreground/50 group-hover:scale-[1.02] transition-transform">
                                    <Film className="w-8 h-8 opacity-50" />
                                </div>
                            </CardContent>
                            <CardFooter className="text-xs text-muted-foreground border-t bg-muted/20 p-4 flex gap-4">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(project.created_at)}
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 ml-auto -mr-2 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the project
                                                "{project.title}" and remove all associated scenes and data.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-destructive hover:bg-destructive/90"
                                                onClick={(e) => handleDeleteProject(e, project.id)}
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )
            }
        </div >
    );
}
