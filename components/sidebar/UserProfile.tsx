"use client";

import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function UserProfile() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
    };

    if (!user) return null;

    return (
        <div className="p-4 border-t border-border mt-auto">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 w-full hover:bg-muted/50 p-2 rounded-lg transition-colors text-left">
                        <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={user.user_metadata?.avatar_url} />
                            <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <span className="text-sm font-medium truncate">
                                {user.user_metadata?.full_name || "User"}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                                {user.email}
                            </span>
                        </div>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start" forceMount>
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-500 max-w-full">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
