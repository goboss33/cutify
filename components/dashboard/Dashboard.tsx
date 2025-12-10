"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Calendar, Film } from "lucide-react";
import { useProject } from "@/store/ProjectContext";
import { useStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client"; // Added import
import { formatDistanceToNow } from "date-fns"; // Make sure to install or use raw date

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

    const handleNewProject = async () => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch("http://127.0.0.1:8000/api/projects/create_default", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });

            if (res.ok) {
                const newProject = await res.json();
                setCurrentProject(newProject);
                setActiveTab("chat");
            }
        } catch (e) {
            console.error("Failed to create project", e);
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
                <Button onClick={handleNewProject} size="lg" className="gap-2">
                    <Plus className="w-5 h-5" /> New Project
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-muted rounded-xl bg-muted/10">
                    <Folder className="w-16 h-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-xl font-medium">No projects yet</h3>
                    <p className="text-muted-foreground mb-6">Start your first video creation journey.</p>
                    <Button onClick={handleNewProject}>Create Project</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className="group cursor-pointer hover:border-primary/50 transition-all hover:bg-muted/50"
                            onClick={() => handleSelectProject(project)}
                        >
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="truncate pr-4">{project.title}</CardTitle>
                                        <CardDescription className="truncate mt-1">{project.genre || "Unknown Genre"}</CardDescription>
                                    </div>
                                    <div className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full uppercase font-medium">
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
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
