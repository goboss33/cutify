"use client";

import React, { useState, useEffect } from 'react';
import { useStore } from "@/store/useStore";
import { useProject } from "@/store/ProjectContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, Plus, User, MoreVertical, Pencil, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const API_BASE = "http://127.0.0.1:8000";

// Helper to get full image URL
const getFullImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url}`;
};

// Types for assets
interface Character {
    id: number;
    project_id: number;
    name: string;
    image_url: string | null;
}

interface Location {
    id: number;
    project_id: number;
    name: string;
    image_url: string | null;
}



export function AssetSidebar() {
    const { activeSceneId } = useStore();
    const { currentProject, refreshProject } = useProject();

    const [characters, setCharacters] = useState<Character[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);

    // Get active scene's associated assets
    const activeScene = currentProject?.scenes?.find(s => String(s.id) === String(activeSceneId));
    const sceneCharacterIds = new Set(activeScene?.characters?.map(c => c.id) || []);
    const sceneLocationId = activeScene?.location_id || activeScene?.location?.id || null;

    // Fetch project assets on mount and when scenes change (after generation)
    const projectId = currentProject?.id;
    const scenesCount = currentProject?.scenes?.length ?? 0;

    useEffect(() => {
        if (!projectId) return;

        const fetchAssets = async () => {
            setLoading(true);
            try {
                const [charsRes, locsRes] = await Promise.all([
                    fetch(`${API_BASE}/api/projects/${projectId}/characters`),
                    fetch(`${API_BASE}/api/projects/${projectId}/locations`)
                ]);
                if (charsRes.ok) setCharacters(await charsRes.json());
                if (locsRes.ok) setLocations(await locsRes.json());
            } catch (e) {
                console.error("Failed to fetch assets", e);
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, [projectId, scenesCount]);

    // Optimistic state for immediate UI feedback
    const [optimisticCharacterIds, setOptimisticCharacterIds] = useState<Set<number> | null>(null);
    const [optimisticLocationId, setOptimisticLocationId] = useState<number | null | undefined>(undefined);

    // Use optimistic state if available, otherwise use server state
    const displayCharacterIds = optimisticCharacterIds ?? sceneCharacterIds;
    const displayLocationId = optimisticLocationId !== undefined ? optimisticLocationId : sceneLocationId;

    // Toggle character association with scene (OPTIMISTIC)
    const toggleCharacter = async (characterId: number) => {
        if (!activeSceneId) return;

        // Optimistic update - toggle immediately
        const currentIds = new Set(displayCharacterIds);
        if (currentIds.has(characterId)) {
            currentIds.delete(characterId);
        } else {
            currentIds.add(characterId);
        }
        setOptimisticCharacterIds(currentIds);

        try {
            await fetch(`${API_BASE}/api/scenes/${activeSceneId}/characters/${characterId}`, {
                method: "POST"
            });
            // Sync with server in background (optional, for data consistency)
            refreshProject?.();
        } catch (e) {
            console.error("Toggle character failed", e);
            // Revert on error
            setOptimisticCharacterIds(null);
        }
    };

    // Toggle location association with scene (OPTIMISTIC)
    const toggleLocation = async (locationId: number) => {
        if (!activeSceneId) return;

        // Optimistic update - toggle immediately
        const newLocationId = displayLocationId === locationId ? null : locationId;
        setOptimisticLocationId(newLocationId);

        try {
            await fetch(`${API_BASE}/api/scenes/${activeSceneId}/location/${locationId}`, {
                method: "POST"
            });
            // Sync with server in background
            refreshProject?.();
        } catch (e) {
            console.error("Toggle location failed", e);
            // Revert on error
            setOptimisticLocationId(undefined);
        }
    };

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<"character" | "location">("character");
    const [editingAsset, setEditingAsset] = useState<{ id: number; name: string; description?: string; traits?: string; ambiance?: string; image_url?: string | null } | null>(null);

    // Open modal for character creation
    const openCharacterModal = () => {
        setEditingAsset(null); // Clear edit state
        setModalType("character");
        setModalOpen(true);
    };

    // Open modal for location creation
    const openLocationModal = () => {
        setEditingAsset(null); // Clear edit state
        setModalType("location");
        setModalOpen(true);
    };

    // Handle new asset created
    const handleAssetCreated = (asset: any) => {
        if (modalType === "character") {
            setCharacters(prev => [...prev, asset]);
        } else {
            setLocations(prev => [...prev, asset]);
        }
        refreshProject();
    };

    // Handle asset updated
    const handleAssetUpdated = (asset: any) => {
        if (modalType === "character") {
            setCharacters(prev => prev.map(c => c.id === asset.id ? asset : c));
        } else {
            setLocations(prev => prev.map(l => l.id === asset.id ? asset : l));
        }
        refreshProject();
    };

    // Delete character
    const deleteCharacter = async (charId: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger toggle
        if (!confirm("Supprimer ce personnage ?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/characters/${charId}`, { method: "DELETE" });
            if (res.ok) {
                setCharacters(prev => prev.filter(c => c.id !== charId));
            }
        } catch (e) {
            console.error("Delete character failed", e);
        }
    };

    // Delete location
    const deleteLocation = async (locId: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger toggle
        if (!confirm("Supprimer ce lieu ?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/locations/${locId}`, { method: "DELETE" });
            if (res.ok) {
                setLocations(prev => prev.filter(l => l.id !== locId));
            }
        } catch (e) {
            console.error("Delete location failed", e);
        }
    };

    // Edit asset - open modal with pre-filled data
    const editAsset = (asset: Character | Location, type: "character" | "location", e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAsset({
            id: asset.id,
            name: asset.name,
            description: (asset as any).description,
            traits: (asset as any).traits,
            ambiance: (asset as any).ambiance,
            image_url: asset.image_url,
        });
        setModalType(type);
        setModalOpen(true);
    };

    if (!currentProject || !activeSceneId) return null;

    // Import the modal component dynamically to avoid circular deps
    const AssetCreationModal = React.lazy(() =>
        import("./AssetCreationModal").then(mod => ({ default: mod.AssetCreationModal }))
    );

    return (
        <>
            {/* Modal */}
            <React.Suspense fallback={null}>
                <AssetCreationModal
                    open={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        setEditingAsset(null);
                    }}
                    type={modalType}
                    projectId={currentProject.id}
                    onCreated={handleAssetCreated}
                    onUpdated={handleAssetUpdated}
                    editAsset={editingAsset}
                />
            </React.Suspense>

            <div className="absolute left-0 top-0 h-full w-[320px] bg-background/95 backdrop-blur-sm border-r border-border flex flex-col z-40">
                {/* Header */}
                <div className="h-12 border-b border-border flex items-center px-4 bg-muted/20">
                    <span className="font-semibold text-sm">Project Assets</span>
                </div>

                {/* Tabs */}
                <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue="characters" className="w-full h-full flex flex-col">
                        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-10">
                            <TabsTrigger
                                value="characters"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/10 h-10 gap-2"
                            >
                                <Users className="h-4 w-4" /> Characters
                            </TabsTrigger>
                            <TabsTrigger
                                value="locations"
                                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/10 h-10 gap-2"
                            >
                                <MapPin className="h-4 w-4" /> Locations
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Characters Tab */}
                            <TabsContent value="characters" className="m-0">
                                {!activeSceneId && (
                                    <div className="text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded-md mb-3">
                                        Sélectionnez une scène pour associer des personnages
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-3">
                                    {characters.map((char) => {
                                        const isLinked = displayCharacterIds.has(char.id);
                                        return (
                                            <div
                                                key={char.id}
                                                className={cn(
                                                    "relative flex flex-col items-center gap-2 p-2 rounded-lg transition-all",
                                                    activeSceneId && "hover:bg-muted/50",
                                                    !activeSceneId && "opacity-50",
                                                    isLinked && "ring-2 ring-primary bg-primary/10"
                                                )}
                                            >
                                                {/* Menu ⋮ */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="absolute top-1 right-1 p-1 rounded-full hover:bg-muted/80 opacity-60 hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem onClick={(e) => editAsset(char, "character", e as any)}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Modifier
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={(e) => deleteCharacter(char.id, e as any)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Supprimer
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                {/* Clickable area for toggle */}
                                                <button
                                                    onClick={() => toggleCharacter(char.id)}
                                                    disabled={!activeSceneId}
                                                    className="flex flex-col items-center gap-2 w-full cursor-pointer disabled:cursor-not-allowed"
                                                    title={char.name}
                                                >
                                                    {/* Avatar */}
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold transition-all",
                                                        char.image_url
                                                            ? "bg-cover bg-center"
                                                            : "bg-neutral-700",
                                                        isLinked && "ring-2 ring-primary"
                                                    )}
                                                        style={char.image_url ? { backgroundImage: `url(${getFullImageUrl(char.image_url)})` } : {}}
                                                    >
                                                        {!char.image_url && (
                                                            <User className="h-5 w-5 text-neutral-400" />
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-center truncate w-full">{char.name}</span>
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Add Character Button */}
                                    <button
                                        onClick={openCharacterModal}
                                        className="flex flex-col items-center gap-2 p-2 rounded-lg transition-all hover:bg-muted/50 cursor-pointer border-2 border-dashed border-neutral-700 hover:border-primary"
                                    >
                                        <div className="h-12 w-12 rounded-full flex items-center justify-center border-2 border-dashed border-neutral-600">
                                            <Plus className="h-5 w-5 text-neutral-400" />
                                        </div>
                                        <span className="text-xs text-neutral-400">Ajouter</span>
                                    </button>
                                </div>
                            </TabsContent>

                            {/* Locations Tab */}
                            <TabsContent value="locations" className="m-0">
                                {!activeSceneId && (
                                    <div className="text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded-md mb-3">
                                        Sélectionnez une scène pour associer un lieu
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    {locations.map((loc) => {
                                        const isLinked = displayLocationId === loc.id;
                                        return (
                                            <div
                                                key={loc.id}
                                                className={cn(
                                                    "relative flex flex-col items-center gap-2 p-2 rounded-lg transition-all",
                                                    activeSceneId && "hover:bg-muted/50",
                                                    !activeSceneId && "opacity-50",
                                                    isLinked && "ring-2 ring-primary bg-primary/10"
                                                )}
                                            >
                                                {/* Menu ⋮ */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="absolute top-1 right-1 p-1 rounded-full hover:bg-muted/80 opacity-60 hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem onClick={(e) => editAsset(loc, "location", e as any)}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Modifier
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={(e) => deleteLocation(loc.id, e as any)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Supprimer
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                {/* Clickable area for toggle */}
                                                <button
                                                    onClick={() => toggleLocation(loc.id)}
                                                    disabled={!activeSceneId}
                                                    className="flex flex-col items-center gap-2 w-full cursor-pointer disabled:cursor-not-allowed"
                                                    title={loc.name}
                                                >
                                                    {/* Thumbnail */}
                                                    <div className={cn(
                                                        "h-16 w-full rounded-md flex items-center justify-center transition-all",
                                                        loc.image_url
                                                            ? "bg-cover bg-center"
                                                            : "bg-neutral-700",
                                                        isLinked && "ring-2 ring-primary"
                                                    )}
                                                        style={loc.image_url ? { backgroundImage: `url(${getFullImageUrl(loc.image_url)})` } : {}}
                                                    >
                                                        {!loc.image_url && (
                                                            <MapPin className="h-6 w-6 text-neutral-400" />
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-center truncate w-full">{loc.name}</span>
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Add Location Button */}
                                    <button
                                        onClick={openLocationModal}
                                        className="flex flex-col items-center gap-2 p-2 rounded-lg transition-all hover:bg-muted/50 cursor-pointer border-2 border-dashed border-neutral-700 hover:border-primary"
                                    >
                                        <div className="h-16 w-full rounded-md flex items-center justify-center border-2 border-dashed border-neutral-600">
                                            <Plus className="h-6 w-6 text-neutral-400" />
                                        </div>
                                        <span className="text-xs text-neutral-400">Ajouter</span>
                                    </button>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>
        </>
    );
}
