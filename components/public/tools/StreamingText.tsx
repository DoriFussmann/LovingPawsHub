"use client";

import { useEffect, useRef, useState } from "react";

interface StreamingTextProps {
  stream: ReadableStream<Uint8Array> | null;
  onComplete?: (text: string) => void;
  className?: string;
}

export default function StreamingText({ stream, onComplete, className }: StreamingTextProps) {
  const [text, setText] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    if (!stream) return;
    doneRef.current = false;
    setText("");

    const decoder = new TextDecoder();
    const reader = stream.getReader();

    let accumulated = "";

    async function pump() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setText(accumulated);
        }
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete?.(accumulated);
        }
      } catch {
        // Stream was cancelled or errored — that's fine
      }
    }

    pump();

    return () => {
      doneRef.current = true;
      reader.cancel().catch(() => {});
    };
  }, [stream, onComplete]);

  return (
    <div className={className}>
      {text.split("\n").map((line, i) =>
        line === "" ? (
          <br key={i} />
        ) : (
          <p key={i} className="text-sm font-light text-foreground/90 leading-relaxed mb-3 last:mb-0">
            {line}
          </p>
        )
      )}
    </div>
  );
}
