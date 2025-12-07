import React from "react";
import { Play, SkipBack, SkipForward, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlayerView() {
    return (
        <div className="w-full h-full flex flex-col bg-black relative group">
            {/* Video Placeholder */}
            <div className="flex-1 flex items-center justify-center relative bg-neutral-900 border-2 border-dashed border-neutral-800 m-4 rounded-lg">
                <div className="text-center text-neutral-500">
                    <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Video Preview Placeholder</p>
                    <p className="text-sm opacity-50">1920x1080</p>
                </div>
            </div>

            {/* Overlay Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="hover:bg-white/10 text-white">
                    <SkipBack className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="ghost" className="hover:bg-white/10 text-white">
                    <Play className="h-6 w-6 fill-current" />
                </Button>
                <Button size="icon" variant="ghost" className="hover:bg-white/10 text-white">
                    <SkipForward className="h-5 w-5" />
                </Button>
                <div className="h-4 w-px bg-white/20 mx-2" />
                <Button size="icon" variant="ghost" className="hover:bg-white/10 text-white">
                    <Maximize2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
