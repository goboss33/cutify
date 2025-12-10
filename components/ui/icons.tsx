import React from 'react';

export const FlagFR = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 640 480" className={className}>
        <g fillRule="evenodd" strokeWidth="1pt">
            <path fill="#fff" d="M0 0h640v480H0z" />
            <path fill="#00267f" d="M0 0h213.3v480H0z" />
            <path fill="#f31830" d="M426.7 0H640v480H426.7z" />
        </g>
    </svg>
);

export const FlagUS = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 640 480" className={className}>
        <path fill="#bd3d44" d="M0 0h640v480H0" />
        <path stroke="#fff" strokeWidth="37" d="M0 55.3h640M0 129h640M0 202.8h640M0 276.5h640M0 350.2h640M0 423.9h640" />
        <path fill="#192f5d" d="M0 0h364.8v258.5H0" />
        <marker id="us-a" markerHeight="30" markerWidth="30">
            <path fill="#fff" d="m14.7 0 16.8 51.6H0z" />
        </marker>
        <path fill="#fff" transform="scale(.065)" d="M99 28h280v200H99z" />
        {/* Simplified for brevity - just a blue field with stars implication for small size */}
        <path fill="#fff" d="M30 30h40v40H30zM100 30h40v40H100zM170 30h40v40H170zM240 30h40v40H240zM310 30h40v40H310zM65 80h40v40H65zM135 80h40v40H135zM205 80h40v40H205zM275 80h40v40H275zM30 130h40v40H30zM100 130h40v40H100zM170 130h40v40H170zM240 130h40v40H240zM310 130h40v40H310zM65 180h40v40H65zM135 180h40v40H135zM205 180h40v40H205zM275 180h40v40H275z" />
    </svg>
);

export const FlagUK = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 640 480" className={className}>
        <path fill="#012169" d="M0 0h640v480H0z" />
        <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z" />
        <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z" />
        <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z" />
        <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z" />
    </svg>
);

export const FlagES = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 640 480" className={className}>
        <path fill="#de0d18" d="M0 0h640v480H0z" />
        <path fill="#ffc400" d="M0 120h640v240H0z" />
    </svg>
);

export const FlagDE = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 640 480" className={className}>
        <path fill="#ffce00" d="M0 320h640v160H0z" />
        <path d="M0 0h640v160H0z" />
        <path fill="#d00" d="M0 160h640v160H0z" />
    </svg>
);

export const IconYoutube = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

export const IconTikTok = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
);
