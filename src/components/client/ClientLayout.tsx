
'use client';

import { hexToHsl } from '@/lib/utils';

interface ClientLayoutClientProps {
    children: React.ReactNode;
    accentColor?: string;
}

export function ClientLayoutClient({ children, accentColor = '#3b82f6' }: ClientLayoutClientProps) {
    const hsl = hexToHsl(accentColor);
    const ringColor = hsl ? `${hsl[0]} ${hsl[1]}% ${hsl[2]}%` : `217 91% 60%`;

    const gradientColor = `hsl(${hsl ? `${hsl[0]} ${hsl[1]}% ${hsl[2]}%` : '217 91% 60%'} / 0.15)`;
    const topGradientColor = `hsl(${hsl ? `${hsl[0]} ${hsl[1]}% ${hsl[2]}%` : '217 91% 60%'} / 0.25)`;


    const dynamicStyle = {
      '--accent-color': accentColor,
      '--ring': ringColor,
      background: `
        radial-gradient(ellipse 50% 20% at 50% 0%, ${topGradientColor} 0%, transparent 100%),
        radial-gradient(circle at center, ${gradientColor} 0%, transparent 40%)
      `,
    } as React.CSSProperties;

    return (
        <div 
            className="relative w-full min-h-screen text-white bg-[#111]"
            style={dynamicStyle}
        >
            {children}
        </div>
    );
}
