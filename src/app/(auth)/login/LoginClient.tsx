
"use client";

import dynamic from "next/dynamic";

const GradientBlinds = dynamic(
  () => import("@/components/GradientBlinds").then((mod) => mod.GradientBlinds),
  { ssr: false }
);

export function LoginClient({ accentColor, children }: { accentColor: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#1E1E1E]">
      <GradientBlinds
        className="absolute inset-0"
        gradientColors={[accentColor, "#7289DA", "#99AAB5"]}
        spotlightRadius={0.4}
        noise={0.15}
        distortAmount={0.2}
      />
      {children}
    </div>
  );
}
