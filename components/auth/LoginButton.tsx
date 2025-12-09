"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

export default function LoginButton() {
    const handleLogin = async () => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        });
    };

    return (
        <Button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200"
        >
            <Chrome className="w-5 h-5" />
            Sign in with Google
        </Button>
    );
}
