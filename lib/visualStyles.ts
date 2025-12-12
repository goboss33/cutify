// Visual styles configuration for project creation
// Featured styles appear at the top with thumbnails
// All styles available in "See more" modal

export interface VisualStyle {
    id: string;
    name: string;
    description: string;
    thumbnail?: string; // Only for featured styles
    category: string;
}

export const FEATURED_STYLES: VisualStyle[] = [
    {
        id: "photorealistic",
        name: "Photoréaliste",
        description: "Rendu ultra-réaliste, qualité cinématographique",
        thumbnail: "/styles/style_photorealistic_1765528639822.png",
        category: "Réaliste"
    },
    {
        id: "ghibli",
        name: "Style Ghibli",
        description: "Animation japonaise douce et onirique",
        thumbnail: "/styles/style_ghibli_1765528655613.png",
        category: "Animation 2D"
    },
    {
        id: "minecraft",
        name: "Style Minecraft",
        description: "Esthétique voxel et blocs pixelisés",
        thumbnail: "/styles/style_minecraft_1765528673104.png",
        category: "Jeux Vidéo"
    },
    {
        id: "pixar",
        name: "3D Pixar",
        description: "Animation 3D colorée et stylisée",
        thumbnail: "/styles/style_pixar_3d_1765528686441.png",
        category: "Animation 3D"
    }
];

export const ALL_STYLES: VisualStyle[] = [
    // Featured (also in full list)
    ...FEATURED_STYLES,
    // Additional styles
    {
        id: "cinematic",
        name: "Cinématique",
        description: "Style film hollywoodien classique",
        category: "Réaliste"
    },
    {
        id: "documentary",
        name: "Documentaire",
        description: "Style naturaliste et authentique",
        category: "Réaliste"
    },
    {
        id: "anime",
        name: "Anime",
        description: "Animation japonaise moderne",
        category: "Animation 2D"
    },
    {
        id: "watercolor",
        name: "Aquarelle",
        description: "Effet peinture à l'eau artistique",
        category: "Artistique"
    },
    {
        id: "retro",
        name: "Rétro / Vintage",
        description: "Esthétique années 70-80",
        category: "Artistique"
    },
    {
        id: "cyberpunk",
        name: "Cyberpunk",
        description: "Néons, futurisme dystopique",
        category: "Fantaisie"
    },
    {
        id: "noir",
        name: "Film Noir",
        description: "Noir et blanc contrasté, ombres dramatiques",
        category: "Artistique"
    },
    {
        id: "comic",
        name: "Bande Dessinée",
        description: "Style comic book avec contours marqués",
        category: "Animation 2D"
    },
    {
        id: "minimalist",
        name: "Minimaliste",
        description: "Épuré, formes simples, couleurs limitées",
        category: "Corporate"
    },
    {
        id: "corporate",
        name: "Corporate / Clean",
        description: "Professionnel et moderne",
        category: "Corporate"
    }
];

// Group styles by category for the modal
export const STYLE_CATEGORIES = [
    "Réaliste",
    "Animation 2D",
    "Animation 3D",
    "Jeux Vidéo",
    "Artistique",
    "Fantaisie",
    "Corporate"
];
