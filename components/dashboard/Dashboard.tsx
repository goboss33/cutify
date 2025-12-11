"use client"

import { useState, useEffect } from "react";
import {
    Plus,
    Trash2,
    Image as ImageIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/store/ProjectContext";
import { Project } from "@/types/project";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconYoutube, IconTikTok } from "@/components/ui/icons";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateProjectWizard } from "@/components/dashboard/CreateProjectWizard";

export function Dashboard() {
    const { currentProject, setCurrentProject } = useProject();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "create">("list");
    const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

    const confirmDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`http://127.0.0.1:8000/api/projects/${projectToDelete}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            });

            if (res.ok) {
                setProjects(projects.filter(p => p.id !== projectToDelete));
                if (currentProject?.id === projectToDelete) {
                    setCurrentProject(null);
                }
            } else {
                console.error("Failed to delete project");
                alert("Failed to delete project");
            }
        } catch (error) {
            console.error("Error deleting project:", error);
            alert("Error deleting project");
        } finally {
            setProjectToDelete(null);
        }
    };

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

    const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this project?")) return;

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
                if (currentProject?.id === projectId) {
                    setCurrentProject(null);
                }
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

    const handleProjectCreated = (newProject: Project) => {
        setProjects(prev => [...prev, newProject]);
        setCurrentProject(newProject);
        setViewMode("list");
    };

    if (viewMode === "create") {
        return (
            <div className="flex-1 p-8 overflow-y-auto bg-background/50 h-full">
                <CreateProjectWizard
                    onCancel={() => setViewMode("list")}
                    onProjectCreated={handleProjectCreated}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-background/50 h-full">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
                    <p className="text-muted-foreground mt-1">Manage your video concepts and productions.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* New Project Card */}
                    <Card
                        className="group cursor-pointer border-2 border-dashed border-muted bg-muted/5 hover:border-primary/50 hover:bg-muted/10 transition-all flex flex-col items-center justify-center min-h-[250px]"
                        onClick={() => setViewMode("create")}
                    >
                        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                                <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <h3 className="font-semibold text-lg text-muted-foreground group-hover:text-foreground transition-colors">Create New Project</h3>
                            <p className="text-sm text-muted-foreground/60 mt-2">Start a new video concept</p>
                        </CardContent>
                    </Card>

                    {/* Existing Projects */}
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className={`group cursor-pointer transition-all hover:shadow-md border-muted ${currentProject?.id === project.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
                            onClick={() => handleSelectProject(project)}
                        >
                            <CardHeader className="p-0">
                                <div className="aspect-video w-full bg-muted relative overflow-hidden rounded-t-lg">
                                    {/* Placeholder Gradient based on ID for visuals */}
                                    <div className={`absolute inset-0 opacity-20 bg-linear-to-br from-primary to-purple-500`} style={{ filter: `hue-rotate(${project.id * 137}deg)` }} />

                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProjectToDelete(project.id);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="absolute bottom-2 left-2 flex gap-1">
                                        {project.aspect_ratio && (
                                            <Badge variant="secondary" className="text-[10px] h-5 opacity-90 backdrop-blur-xs">
                                                {project.aspect_ratio === "16:9" ? <IconYoutube className="w-3 h-3 mr-1" /> : <IconTikTok className="w-3 h-3 mr-1" />}
                                                {project.aspect_ratio}
                                            </Badge>
                                        )}
                                        <Badge variant="secondary" className="text-[10px] h-5 opacity-90 backdrop-blur-xs">
                                            {project.language?.slice(0, 2).toUpperCase() || "FR"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <CardTitle className="text-lg leading-tight mb-2 truncate" title={project.title}>{project.title}</CardTitle>
                                <CardDescription className="flex items-center gap-2 text-xs">
                                    <span className="font-medium text-foreground/80">{project.genre}</span>
                                    <span>•</span>
                                    <span>{project.target_duration || "60s"}</span>
                                </CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the project and all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
