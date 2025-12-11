"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, User, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "http://127.0.0.1:8000";

// Asset type for editing
interface EditableAsset {
    id: number;
    name: string;
    description?: string;
    traits?: string;      // For characters
    ambiance?: string;    // For locations
    image_url?: string | null;
}

interface AssetCreationModalProps {
    open: boolean;
    onClose: () => void;
    type: "character" | "location";
    projectId: number;
    onCreated: (asset: any) => void;
    onUpdated?: (asset: any) => void;
    editAsset?: EditableAsset | null; // If provided, we're in edit mode
    visualStyle?: string;
}

export function AssetCreationModal({
    open,
    onClose,
    type,
    projectId,
    onCreated,
    onUpdated,
    editAsset,
    visualStyle,
}: AssetCreationModalProps) {
    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [traits, setTraits] = useState(""); // For characters
    const [ambiance, setAmbiance] = useState(""); // For locations

    // UI state
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isCharacter = type === "character";
    const isEditMode = !!editAsset;

    // Reset form when modal opens, pre-fill if editing
    React.useEffect(() => {
        if (open) {
            if (editAsset) {
                // Edit mode - pre-fill
                setName(editAsset.name || "");
                setDescription(editAsset.description || "");
                setTraits(editAsset.traits || "");
                setAmbiance(editAsset.ambiance || "");
                setGeneratedImageUrl(editAsset.image_url || null);
            } else {
                // Create mode - reset
                setName("");
                setDescription("");
                setTraits("");
                setAmbiance("");
                setGeneratedImageUrl(null);
            }
            setError(null);
        }
    }, [open, editAsset]);

    // Generate image using Gemini
    const handleGenerateImage = async () => {
        if (!name.trim()) {
            setError("Veuillez d'abord entrer un nom");
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const prompt = isCharacter
                ? `${description} Traits: ${traits}`
                : `${description} Ambiance: ${ambiance}`;

            const response = await fetch(`${API_BASE}/api/generate-asset-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    type,
                    name,
                    style: visualStyle,
                }),
            });

            if (!response.ok) {
                throw new Error("Erreur lors de la génération");
            }

            const data = await response.json();
            setGeneratedImageUrl(data.image_url);
        } catch (e) {
            console.error("Image generation failed", e);
            setError("La génération a échoué. Réessayez.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Save asset (create or update)
    const handleSave = async () => {
        if (!name.trim()) {
            setError("Le nom est requis");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            let endpoint: string;
            let method: string;

            if (isEditMode && editAsset) {
                // Update existing asset
                endpoint = isCharacter
                    ? `${API_BASE}/api/characters/${editAsset.id}`
                    : `${API_BASE}/api/locations/${editAsset.id}`;
                method = "PUT";
            } else {
                // Create new asset
                endpoint = isCharacter
                    ? `${API_BASE}/api/projects/${projectId}/characters`
                    : `${API_BASE}/api/projects/${projectId}/locations`;
                method = "POST";
            }

            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    traits: isCharacter ? traits.trim() : undefined,
                    ambiance: !isCharacter ? ambiance.trim() : undefined,
                    image_url: generatedImageUrl,
                }),
            });

            if (!response.ok) {
                throw new Error("Erreur lors de la sauvegarde");
            }

            const savedAsset = await response.json();

            if (isEditMode && onUpdated) {
                onUpdated(savedAsset);
            } else {
                onCreated(savedAsset);
            }
            onClose();
        } catch (e) {
            console.error("Save failed", e);
            setError("La sauvegarde a échoué");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-border/50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {isCharacter ? (
                            <>
                                <User className="h-5 w-5 text-primary" />
                                {isEditMode ? "Modifier le Personnage" : "Nouveau Personnage"}
                            </>
                        ) : (
                            <>
                                <MapPin className="h-5 w-5 text-primary" />
                                {isEditMode ? "Modifier le Lieu" : "Nouveau Lieu"}
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? `Modifiez les informations de ${editAsset?.name || "cet asset"}`
                            : isCharacter
                                ? "Créez un personnage pour votre projet"
                                : "Ajoutez un lieu/décor pour vos scènes"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Preview Area */}
                    <div className="flex justify-center">
                        <div
                            className={cn(
                                "relative flex items-center justify-center overflow-hidden transition-all bg-muted/30 border-2 border-dashed border-muted-foreground/20",
                                isCharacter
                                    ? "h-32 w-32 rounded-full aspect-square"
                                    : "w-full aspect-video rounded-lg"
                            )}
                            style={
                                generatedImageUrl
                                    ? {
                                        backgroundImage: `url(${generatedImageUrl.startsWith("http")
                                            ? generatedImageUrl
                                            : `${API_BASE}${generatedImageUrl}`
                                            })`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                        borderStyle: "solid",
                                        borderColor: "hsl(var(--primary))",
                                    }
                                    : {}
                            }
                        >
                            {!generatedImageUrl && !isGenerating && (
                                <div className="text-center text-muted-foreground/50 text-sm">
                                    {isCharacter ? (
                                        <User className="h-10 w-10 mx-auto mb-1" />
                                    ) : (
                                        <MapPin className="h-10 w-10 mx-auto mb-1" />
                                    )}
                                    Pas d'image
                                </div>
                            )}
                            {isGenerating && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nom *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={isCharacter ? "Ex: Sarah" : "Ex: Café parisien"}
                            className="bg-muted/30"
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={
                                isCharacter
                                    ? "Femme de 30 ans, cheveux noirs, regard intense..."
                                    : "Petit café chaleureux, lumière tamisée, murs en brique..."
                            }
                            className="bg-muted/30 min-h-[80px] resize-none"
                        />
                    </div>

                    {/* Type-specific field */}
                    {isCharacter ? (
                        <div className="grid gap-2">
                            <Label htmlFor="traits">Traits de personnalité</Label>
                            <Input
                                id="traits"
                                value={traits}
                                onChange={(e) => setTraits(e.target.value)}
                                placeholder="Mystérieux, déterminé, vulnérable..."
                                className="bg-muted/30"
                            />
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <Label htmlFor="ambiance">Ambiance</Label>
                            <Input
                                id="ambiance"
                                value={ambiance}
                                onChange={(e) => setAmbiance(e.target.value)}
                                placeholder="Mélancolique, vibrant, mystérieux..."
                                className="bg-muted/30"
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={handleGenerateImage}
                        disabled={isGenerating || !name.trim()}
                        className="gap-2"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        Générer l'image
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="gap-2">
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {isEditMode ? "Enregistrer" : "Créer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
