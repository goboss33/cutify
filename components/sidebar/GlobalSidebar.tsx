"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
    Folder,
    Image as ImageIcon,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    Terminal
} from "lucide-react";
import { UserProfile } from "./UserProfile";
import { useStore } from "@/store/useStore";
import { useProject } from "@/store/ProjectContext";

export function GlobalSidebar() {
    const [isCollapsed, setIsCollapsed] = useState(true); // Default collapsed
    const { currentView, setCurrentView } = useStore();
    const { setCurrentProject } = useProject();
    const router = useRouter();

    // Navigation Items
    const navItems = [
        {
            label: "My Projects",
            icon: Folder,
            view: 'dashboard',
            onClick: () => {
                setCurrentProject(null);
                setCurrentView('dashboard');
                router.push('/');
            }
        },
        {
            label: "My Assets",
            icon: ImageIcon,
            view: 'assets',
            onClick: () => {
                setCurrentProject(null);
                setCurrentView('assets');
                router.push('/');
            }
        },
        {
            label: "AI Console",
            icon: Terminal,
            view: 'debug',
            onClick: () => router.push('/debug')
        }
    ];

    return (
        <div
            className={cn(
                "h-full border-r border-border bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 relative z-50",
                isCollapsed ? "w-[70px]" : "w-[240px]"
            )}
        >
            {/* Logo Area */}
            <div className="h-16 flex items-center justify-center border-b border-border/50 shrink-0 relative">
                <div className="flex items-center gap-2 overflow-hidden px-4 w-full">
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                        <span className="font-bold text-primary-foreground text-lg">C</span>
                    </div>

                    {!isCollapsed && (
                        <span className="font-bold text-lg tracking-tight animate-in fade-in duration-200">
                            Cutify
                        </span>
                    )}
                </div>
            </div>

            {/* Toggle Button - Floating or Inline? Let's put it absolute on border */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-background shadow-sm hover:bg-muted z-50 hidden md:flex"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>


            {/* Navigation Body */}
            <div className="flex-1 py-6 flex flex-col gap-2 px-2">
                {navItems.map((item) => (
                    <Button
                        key={item.label}
                        variant={currentView === item.view ? "secondary" : "ghost"}
                        className={cn(
                            "w-full justify-start h-10 mb-1",
                            isCollapsed ? "px-0 justify-center" : "px-3"
                        )}
                        onClick={item.onClick}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-3", currentView === item.view && "text-primary")} />

                        {!isCollapsed && (
                            <span className="truncate">{item.label}</span>
                        )}
                    </Button>
                ))}
            </div>

            {/* Footer: User Profile */}
            <UserProfile isCollapsed={isCollapsed} />
        </div>
    );
}
