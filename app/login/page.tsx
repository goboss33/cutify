import LoginButton from "@/components/auth/LoginButton";

export default function LoginPage() {
    return (
        <div className="flex h-screen items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-6 p-10 border border-gray-800 rounded-lg bg-gray-900 shadow-2xl">
                <h1 className="text-3xl font-bold tracking-tighter">Welcome to CUTIFY</h1>
                <p className="text-gray-400">Sign in to manage your video projects</p>
                <div className="w-full">
                    <LoginButton />
                </div>
            </div>
        </div>
    );
}
