"use client"

import { useState, useEffect } from "react";
import {
    Plus,
    MoreVertical,
    Trash2,
    MessageSquare,
    Image as ImageIcon,
    Clock,
    Globe
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { GenreSelector } from "@/components/dashboard/GenreSelector";
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useProject } from "@/store/ProjectContext";
import { Project } from "@/types/project";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlagFR, FlagUK, FlagES, FlagDE, IconYoutube, IconTikTok } from "@/components/ui/icons";
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

const LANGUAGES = [
    { code: "French", label: "French", icon: FlagFR },
    { code: "English", label: "English", icon: FlagUK },
    { code: "Spanish", label: "Spanish", icon: FlagES },
    { code: "German", label: "German", icon: FlagDE },
];

const TARGET_AUDIENCES = [
    "General Audience",
    "Kids & Family",
    "Teens",
    "Young Adults",
    "Professionals",
    "Tech Enthusiasts",
    "Gamers",
    "Lifestyle"
];

const VISUAL_STYLES = [
    "Cinematic",
    "Minimalist",
    "Vlog / Handheld",
    "Documentary",
    "Animation / 3D",
    "Retro / Vintage",
    "Cyberpunk / Futuristic",
    "Corporate / Clean"
];

export function Dashboard() {
    const { currentProject, setCurrentProject } = useProject();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

    // Form State
    const [newTitle, setNewTitle] = useState("");
    const [newGenre, setNewGenre] = useState("");
    const [language, setLanguage] = useState("French");
    const [durationSeconds, setDurationSeconds] = useState([60]); // Default 60s
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [pitch, setPitch] = useState("");
    const [targetAudience, setTargetAudience] = useState("");
    const [visualStyle, setVisualStyle] = useState("");

    const [isCreating, setIsCreating] = useState(false);

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

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes} min${minutes > 1 ? 's' : ''}`;
    };

    const handleCreateProject = async () => {
        if (!newTitle.trim() || !newGenre) return;

        setIsCreating(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Convert slider value to string format backend expects
            const durationStr = formatDuration(durationSeconds[0]);

            const res = await fetch("http://127.0.0.1:8000/api/projects", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: newTitle,
                    genre: newGenre,
                    language,
                    target_duration: durationStr,
                    aspect_ratio: aspectRatio,
                    pitch: pitch,
                    target_audience: targetAudience,
                    visual_style: visualStyle
                })
            });

            if (!res.ok) {
                throw new Error("Failed to create project");
            }

            const newProject = await res.json();
            setCurrentProject(newProject);
            setIsDialogOpen(false);

            // Reset form
            setNewTitle("");
            setNewGenre("");
            setLanguage("French");
            setDurationSeconds([60]);
            setAspectRatio("16:9");
            setPitch("");
            setTargetAudience("");
            setVisualStyle("");
        } catch (e) {
            console.error("Failed to create project", e);
            alert("Error creating project. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

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
                        <DialogContent className="sm:max-w-[700px] overflow-y-auto max-h-[90vh]">
                            <DialogHeader>
                                <DialogTitle>Create New Project</DialogTitle>
                                <DialogDescription>
                                    Configure the foundations of your next video.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="grid gap-2">
                                    <label htmlFor="name" className="text-sm font-medium">
                                        Project Title
                                    </label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Summer Vacation Vlog"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">
                                        Genre
                                    </label>
                                    <GenreSelector value={newGenre} onChange={setNewGenre} />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Pitch / Key Ideas</label>
                                    <Textarea
                                        placeholder="Describe your video idea to guide the AI..."
                                        value={pitch}
                                        onChange={(e) => setPitch(e.target.value)}
                                        className="h-24 resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Target Audience</label>
                                        <Select value={targetAudience} onValueChange={setTargetAudience}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Who is this for?" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TARGET_AUDIENCES.map((a) => (
                                                    <SelectItem key={a} value={a}>{a}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Visual Style</label>
                                        <Select value={visualStyle} onValueChange={setVisualStyle}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Cinematic? Cartoon? Noir?" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {VISUAL_STYLES.map((s) => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Language</label>
                                        <Select value={language} onValueChange={setLanguage}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Select Language" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LANGUAGES.map((lang) => (
                                                    <SelectItem key={lang.code} value={lang.code}>
                                                        <div className="flex items-center gap-2">
                                                            <lang.icon className="w-5 h-4 rounded-sm object-cover shadow-sm" />
                                                            <span>{lang.label}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium flex justify-between">
                                            <span>Duration</span>
                                            <span className="text-muted-foreground font-normal">{formatDuration(durationSeconds[0])}</span>
                                        </label>
                                        <div className="pt-2 px-1">
                                            <Slider
                                                value={durationSeconds}
                                                onValueChange={setDurationSeconds}
                                                max={10800} // 3 hours (180 mins)
                                                min={10}    // 10 seconds
                                                step={10}
                                                className="cursor-pointer"
                                            />
                                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                                                <span>10s</span>
                                                <span>180m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Format</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className={`relative flex flex-col items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${aspectRatio === "16:9" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-muted hover:border-primary/50 hover:bg-muted/30"}`}
                                            onClick={() => setAspectRatio("16:9")}
                                        >
                                            <IconYoutube className={`w-8 h-8 ${aspectRatio === "16:9" ? "text-red-600" : "text-muted-foreground"}`} />
                                            <div className="text-center">
                                                <span className={`block text-sm font-semibold ${aspectRatio === "16:9" ? "text-primary" : "text-foreground"}`}>YouTube</span>
                                                <span className="text-xs text-muted-foreground">Landscape 16:9</span>
                                            </div>
                                            {aspectRatio === "16:9" && (
                                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <div
                                            className={`relative flex flex-col items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 ${aspectRatio === "9:16" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-muted hover:border-primary/50 hover:bg-muted/30"}`}
                                            onClick={() => setAspectRatio("9:16")}
                                        >
                                            <IconTikTok className={`w-8 h-8 ${aspectRatio === "9:16" ? "text-black dark:text-white" : "text-muted-foreground"}`} />
                                            <div className="text-center">
                                                <span className={`block text-sm font-semibold ${aspectRatio === "9:16" ? "text-primary" : "text-foreground"}`}>TikTok</span>
                                                <span className="text-xs text-muted-foreground">Portrait 9:16</span>
                                            </div>
                                            {aspectRatio === "9:16" && (
                                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>Cancel</Button>
                                <Button onClick={handleCreateProject} disabled={!newTitle.trim() || !newGenre || isCreating} className="min-w-[120px]">
                                    {isCreating ? (
                                        <>
                                            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Creating...
                                        </>
                                    ) : "Create Project"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

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
