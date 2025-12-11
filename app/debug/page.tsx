'use client';

import { AIDebugConsole } from "@/components/debug/AIDebugConsole";
import { GlobalSidebar } from "@/components/sidebar/GlobalSidebar";

export default function DebugPage() {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
            <GlobalSidebar />
            <main className="flex-1 h-full overflow-hidden relative">
                <AIDebugConsole />
            </main>
        </div>
    );
}
