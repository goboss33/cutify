export interface User {
    id: string;
    name: string;
    avatar: string; // URL or fallback
    role: 'user' | 'agent';
}

export interface Message {
    id: string; // or number, backend sends int usually but we convert to string or handle mixed
    senderId: string;
    text: string;
    timestamp: string;
}

// Asset Types
export interface Character {
    id: number;
    project_id: number;
    name: string;
    image_url: string | null;
}

export interface Location {
    id: number;
    project_id: number;
    name: string;
    image_url: string | null;
}

export interface Shot {
    id: number; // Changed to number to match ID
    scene_id: number;
    shot_number: number;
    visual_prompt: string;
    image_url?: string;
    status: 'pending' | 'generating' | 'done' | 'failed';
    thumbnail?: string; // fallback UI prop if needed, or map image_url to it
    label?: string; // UI prop
}

// Aligning with Backend SceneDB
export interface Scene {
    id: number;
    project_id?: number;
    sequence_order?: number;
    title: string;
    summary?: string;
    estimated_duration?: string;
    master_image_url?: string;
    status: 'pending' | 'scripted' | 'storyboarded' | 'done' | 'in-progress';
    location_id?: number | null;
    location?: Location | null;
    characters?: Character[];

    // UI specific (optional or computed later)
    shotsCount?: number;
    totalShots?: number;
    script?: string;
    shots?: Shot[];
    duration?: string; // mapping to estimated_duration
}

export interface Project {
    id: number;
    title: string;
    genre?: string;
    pitch?: string;
    visual_style?: string;
    target_audience?: string;
    language?: string;
    target_duration?: string;
    aspect_ratio?: string;
    status: string;
    created_at?: string;
    scenes?: Scene[]; // Included in fetch
    characters?: Character[];
    locations?: Location[];
}

// MOCK DATA

export const CURRENT_USER: User = {
    id: 'u1',
    name: 'Director',
    avatar: '/avatars/director.jpg',
    role: 'user',
};

export const AGENT_USER: User = {
    id: 'a1',
    name: 'Cutify Agent',
    avatar: '/avatars/agent.jpg',
    role: 'agent',
};

// MOCK DATA used for generic fallback or tests
export const MOCK_PROJECT: Project = {
    id: 1,
    title: 'Neo-Noir Film',
    genre: 'Thriller',
    pitch: 'A detective chases a shadow.',
    visual_style: 'Dark',
    status: 'concept',
    scenes: []
};

export const MOCK_MESSAGES: Message[] = [];

const generateMockShots = (count: number): Shot[] => {
    return Array.from({ length: count }).map((_, i) => ({
        id: i + 1,
        scene_id: 0,
        shot_number: i + 1,
        visual_prompt: `Mock prompt for shot ${i + 1}`,
        image_url: 'https://placehold.co/600x400/1a1a1a/FFF?text=Shot+' + (i + 1),
        status: 'done',
        label: `Plan ${i + 1} - ${i % 2 === 0 ? 'Wide' : 'Close-up'}`,
        thumbnail: 'https://placehold.co/600x400/1a1a1a/FFF?text=Shot+' + (i + 1),
    }));
};

export const MOCK_SCENES: Scene[] = [
    {
        id: 101,
        title: 'Scene 1: The Arrival',
        duration: '~45s',
        status: 'done',
        shotsCount: 9,
        totalShots: 9,
        script: `EXT. CITY STREET - NIGHT

Rain pours down on the neon-lit pavement. A lone figure walks into the frame, silhouette reflected in a puddle.

DETECTIVE (V.O.)
It was the kind of night that washes away the sins of the city... or drowns them.`,
        shots: generateMockShots(9),
    },
    {
        id: 102,
        title: 'Scene 2: The Meeting',
        duration: '~1m 30s',
        status: 'in-progress',
        shotsCount: 4,
        totalShots: 9,
        script: `INT. DIMLY LIT BAR - NIGHT

Smoke hangs in the air. The Detective sits opposite a nervous INFORMANT.

INFORMANT
I shouldn't be here. If they see me...

DETECTIVE
Relax. Nobody's looking at you.`,
        shots: generateMockShots(4),
    },
    {
        id: 103,
        title: 'Scene 3: The Chase',
        duration: '~30s',
        status: 'pending',
        shotsCount: 0,
        totalShots: 6,
        script: `EXT. ALLEYWAY - NIGHT

Footsteps echo against the brick walls. The Informant runs, glancing back. A shadow follows.`,
        shots: [],
    },
];
