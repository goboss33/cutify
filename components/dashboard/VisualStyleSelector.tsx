"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { FEATURED_STYLES, ALL_STYLES, STYLE_CATEGORIES, VisualStyle } from "@/lib/visualStyles";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VisualStyleSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

export function VisualStyleSelector({ value, onChange }: VisualStyleSelectorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSelect = (styleId: string) => {
        onChange(styleId);
    };

    const handleModalSelect = (styleId: string) => {
        onChange(styleId);
        setIsModalOpen(false);
    };

    // Find the selected style name for display
    const selectedStyle = ALL_STYLES.find(s => s.id === value);

    return (
        <div className="space-y-3">
            {/* Featured Styles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FEATURED_STYLES.map((style) => (
                    <button
                        key={style.id}
                        type="button"
                        onClick={() => handleSelect(style.id)}
                        className={cn(
                            "group relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all duration-200",
                            "hover:scale-[1.02] hover:shadow-lg",
                            value === style.id
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        {/* Thumbnail Image */}
                        <img
                            src={style.thumbnail}
                            alt={style.name}
                            className="w-full h-full object-cover"
                        />

                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Selected Checkmark */}
                        {value === style.id && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                        )}

                        {/* Label */}
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-white text-sm font-medium truncate">
                                {style.name}
                            </p>
                            <p className="text-white/70 text-xs truncate">
                                {style.description}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {/* See More Button */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "w-full py-2 px-4 rounded-lg border border-dashed border-border",
                            "text-sm text-muted-foreground hover:text-foreground hover:border-primary/50",
                            "transition-colors flex items-center justify-center gap-2"
                        )}
                    >
                        <Plus className="w-4 h-4" />
                        Voir tous les styles ({ALL_STYLES.length})
                    </button>
                </DialogTrigger>

                <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Choisir un style visuel</DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="h-[60vh] pr-4">
                        <div className="space-y-6">
                            {STYLE_CATEGORIES.map((category) => {
                                const categoryStyles = ALL_STYLES.filter(s => s.category === category);
                                if (categoryStyles.length === 0) return null;

                                return (
                                    <div key={category}>
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                                            {category}
                                        </h3>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {categoryStyles.map((style) => (
                                                <button
                                                    key={style.id}
                                                    type="button"
                                                    onClick={() => handleModalSelect(style.id)}
                                                    className={cn(
                                                        "relative rounded-lg overflow-hidden border-2 transition-all p-3",
                                                        "hover:scale-[1.02] hover:shadow-md text-left",
                                                        value === style.id
                                                            ? "border-primary bg-primary/10"
                                                            : "border-border hover:border-primary/50 bg-muted/30"
                                                    )}
                                                >
                                                    {/* Thumbnail if available */}
                                                    {style.thumbnail ? (
                                                        <div className="aspect-video rounded-md overflow-hidden mb-2">
                                                            <img
                                                                src={style.thumbnail}
                                                                alt={style.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-video rounded-md bg-muted mb-2 flex items-center justify-center">
                                                            <span className="text-2xl">🎨</span>
                                                        </div>
                                                    )}

                                                    {/* Selected Checkmark */}
                                                    {value === style.id && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-primary-foreground" />
                                                        </div>
                                                    )}

                                                    <p className="text-sm font-medium truncate">
                                                        {style.name}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Currently Selected Display (when not in featured) */}
            {selectedStyle && !FEATURED_STYLES.find(s => s.id === value) && (
                <div className="text-sm text-muted-foreground">
                    Sélectionné: <span className="text-foreground font-medium">{selectedStyle.name}</span>
                </div>
            )}
        </div>
    );
}
