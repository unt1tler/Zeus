import type { SVGProps } from 'react';
import Image from 'next/image';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m10 10.5 4 4" />
      <path d="m14 10.5-4 4" />
    </svg>
  );
}

export function DiscordIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <Image src="https://i.ibb.co/wY6YyM3/discord-logo-white.png" alt="Discord Icon" width={20} height={20} {...props} />
    )
}

export function NodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        {...props}
    >
        <path d="M7.5 7.5L3 12l4.5 4.5"/>
        <path d="M16.5 7.5l4.5 4.5-4.5 4.5"/>
        <path d="M14 17l-4-10"/>
    </svg>
  );
}

export function JavaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        {...props}
    >
        <path d="M7.5 7.5L3 12l4.5 4.5"/>
        <path d="M16.5 7.5l4.5 4.5-4.5 4.5"/>
        <path d="M14 17l-4-10"/>
    </svg>
  );
}

export function PythonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        {...props}
    >
        <path d="M7.5 7.5L3 12l4.5 4.5"/>
        <path d="M16.5 7.5l4.5 4.5-4.5 4.5"/>
        <path d="M14 17l-4-10"/>
    </svg>
  );
}
