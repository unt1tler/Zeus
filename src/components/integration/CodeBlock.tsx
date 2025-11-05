
"use client";

import { CopyButton } from '../CopyButton';

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <div className="relative rounded-b-md bg-muted/50 font-mono border">
      <CopyButton textToCopy={code} className="absolute right-2 top-2 h-7 w-7 text-muted-foreground" />
      <pre className="overflow-x-auto p-4 text-xs custom-scrollbar">
        <code className={`language-${language}`}>
            {code}
        </code>
      </pre>
    </div>
  );
}
