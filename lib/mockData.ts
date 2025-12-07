export interface User {
    id: string;
    name: string;
    avatar: string; // URL or fallback
    role: 'user' | 'agent';
}

export interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: string;
}

export interface Shot {
    id: string;
    label: string; // e.g. "Plan 1 - Wide"
    thumbnail: string;
    status: 'pending' | 'generating' | 'done';
}

export interface Scene {
    id: string;
    title: string;
    duration: string;
    status: 'done' | 'in-progress' | 'pending';
    shotsCount: number;
    totalShots: number;
    script: string;
    shots: Shot[]; // For the storyboard grid
}

export interface Project {
    id: string;
    name: string;
    duration: string;
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

export const MOCK_PROJECT: Project = {
    id: 'p1',
    name: 'Neo-Noir Film',
    duration: '2h',
};

export const MOCK_MESSAGES: Message[] = [
    {
        id: 'm1',
        senderId: 'a1',
        text: 'Salut! Ready to work on Scene 1?',
        timestamp: '10:00 AM',
    },
    {
        id: 'm2',
        senderId: 'u1',
        text: 'Yes, let\'s focus on the rainy mood.',
        timestamp: '10:01 AM',
    },
    {
        id: 'm3',
        senderId: 'a1',
        text: 'Understood. I have prepared a draft with high contrast lighting.',
        timestamp: '10:01 AM',
    },
    {
        id: 'm4',
        senderId: 'a1',
        text: 'Check the storyboard for the "Arrival" scene.',
        timestamp: '10:02 AM',
    },
];

const generateMockShots = (count: number): Shot[] => {
    return Array.from({ length: count }).map((_, i) => ({
        id: `shot-${i}`,
        label: `Plan ${i + 1} - ${i % 2 === 0 ? 'Wide' : 'Close-up'}`,
        thumbnail: 'https://placehold.co/600x400/1a1a1a/FFF?text=Shot+' + (i + 1),
        status: 'done',
    }));
};

export const MOCK_SCENES: Scene[] = [
    {
        id: 's1',
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
        id: 's2',
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
        id: 's3',
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
