import React from "react";
import { Slider } from "@/components/ui/slider"; // Need to check if slider is installed. PRD didn't require slider, but mentions "zoom slider". I will check/install or mock it.
import {
    ZoomIn,
    ZoomOut,
    Settings2,
    Volume2,
    Video,
    Music,
} from "lucide-react";

export function TimelineAssembly() {
    return (
        <section className="flex flex-col h-full bg-[#0a0a0a] text-xs select-none">
            {/* Timeline Header */}
            <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-neutral-900">
                <div className="flex items-center gap-4 text-neutral-400">
                    <span className="font-mono text-blue-400 font-medium text-sm">
                        00:00:15:00
                    </span>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-2">
                        <span className="hover:text-white cursor-pointer">00:00:00:00</span>
                        <span>/</span>
                        <span className="hover:text-white cursor-pointer">02:35:12:00</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <ZoomOut className="h-4 w-4 text-neutral-500" />
                    <div className="w-24 h-1 bg-neutral-800 rounded-full relative">
                        <div className="absolute left-0 top-0 h-full w-1/3 bg-neutral-600 rounded-full" />
                    </div>
                    <ZoomIn className="h-4 w-4 text-neutral-500" />
                    <Settings2 className="h-4 w-4 text-neutral-500 ml-2" />
                </div>
            </div>

            {/* Timeline Tracks Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                {/* Ruler */}
                <div className="h-6 border-b border-white/5 bg-neutral-900/50 flex items-center text-[10px] text-neutral-600 font-mono relative">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="flex-1 border-l border-white/5 h-full pl-1 uppercase">
                            {i}s
                        </div>
                    ))}
                </div>

                {/* Tracks Container */}
                <div className="p-2 space-y-1">
                    {/* Video Track */}
                    <div className="h-16 bg-neutral-900/30 rounded border border-white/5 relative flex items-center">
                        <div className="w-8 flex flex-col items-center gap-1 text-neutral-600 border-r border-white/5 h-full justify-center mr-2 shrink-0 bg-neutral-900/80 z-10">
                            <Video className="h-3 w-3" />
                            <span className="text-[9px]">V1</span>
                        </div>

                        {/* Mock Clips */}
                        <div className="absolute left-10 top-1 bottom-1 w-32 bg-indigo-900/50 border border-indigo-500/30 rounded flex items-center justify-center overflow-hidden">
                            <span className="text-indigo-200/50 truncate px-2">Scene 1 Full</span>
                        </div>
                        <div className="absolute left-44 top-1 bottom-1 w-24 bg-indigo-900/50 border border-indigo-500/30 rounded flex items-center justify-center overflow-hidden">
                            <span className="text-indigo-200/50 truncate px-2">S2 Cut</span>
                        </div>
                        <div className="absolute left-72 top-1 bottom-1 w-48 bg-indigo-900/50 border border-indigo-500/30 rounded flex items-center justify-center overflow-hidden">
                            <span className="text-indigo-200/50 truncate px-2">S3 Chase</span>
                        </div>

                        {/* Playhead Line */}
                        <div className="absolute left-[150px] top-0 bottom-0 w-px bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] z-20">
                            <div className="absolute -top-1 -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500" />
                        </div>
                    </div>

                    {/* Audio Track 1 */}
                    <div className="h-12 bg-neutral-900/30 rounded border border-white/5 relative flex items-center">
                        <div className="w-8 flex flex-col items-center gap-1 text-neutral-600 border-r border-white/5 h-full justify-center mr-2 shrink-0 bg-neutral-900/80 z-10">
                            <Volume2 className="h-3 w-3" />
                            <span className="text-[9px]">A1</span>
                        </div>
                        <div className="absolute left-10 top-1 bottom-1 w-32 bg-emerald-900/50 border border-emerald-500/30 rounded flex items-center justify-center">
                            <span className="text-emerald-200/50 text-[10px]">Dial. S1</span>
                        </div>
                        <div className="absolute left-44 top-1 bottom-1 w-24 bg-emerald-900/50 border border-emerald-500/30 rounded flex items-center justify-center">
                            <span className="text-emerald-200/50 text-[10px]">Dial. S2</span>
                        </div>
                    </div>

                    {/* Audio Track 2 */}
                    <div className="h-12 bg-neutral-900/30 rounded border border-white/5 relative flex items-center">
                        <div className="w-8 flex flex-col items-center gap-1 text-neutral-600 border-r border-white/5 h-full justify-center mr-2 shrink-0 bg-neutral-900/80 z-10">
                            <Music className="h-3 w-3" />
                            <span className="text-[9px]">A2</span>
                        </div>
                        {/* Continuous background track */}
                        <div className="absolute left-10 top-1 bottom-1 w-[400px] bg-amber-900/40 border border-amber-500/20 rounded flex items-center justify-center">
                            <span className="text-amber-200/50 text-[10px]">Ambient Audio</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
