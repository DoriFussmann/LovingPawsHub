"use client";

import { useEffect, useRef, useState } from "react";

interface StreamingTextProps {
  stream: ReadableStream<Uint8Array> | null;
  onComplete?: (text: string) => void;
  className?: string;
}

// Split a line on **bold** markers and return React nodes with <strong> for bold spans
function renderInline(line: string, key: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return line;
  return (
    <span key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-medium text-foreground">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </span>
  );
}

function renderLine(line: string, i: number): React.ReactNode {
  const trimmed = line.trim();

  // Blank line → spacer
  if (trimmed === "") return <br key={i} />;

  // Heading: entire line is **text** or **text:** (possibly with trailing content after **)
  if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) {
    const inner = trimmed.replace(/^\*\*/, "").replace(/\*\*:?\s*$/, "");
    return (
      <h3 key={i} className="text-sm font-medium text-foreground mt-5 mb-2 tracking-wide first:mt-0">
        {inner}
      </h3>
    );
  }

  // Heading with inline content after the bold part: **Label:** rest of text
  if (/^\*\*[^*]+\*\*:/.test(trimmed)) {
    const match = trimmed.match(/^\*\*([^*]+)\*\*:\s*(.*)/s);
    if (match) {
      return (
        <p key={i} className="text-sm font-light text-foreground/90 leading-relaxed mb-2">
          <strong className="font-medium text-foreground">{match[1]}:</strong>{" "}
          {renderInline(match[2], `${i}-rest`)}
        </p>
      );
    }
  }

  // Numbered list: "1. " or "1) "
  if (/^\d+[.)]\s/.test(trimmed)) {
    const content = trimmed.replace(/^\d+[.)]\s/, "");
    return (
      <li key={i} className="text-sm font-light text-foreground/90 leading-relaxed mb-1.5 ml-4 list-decimal marker:text-muted-foreground">
        {renderInline(content, `${i}-li`)}
      </li>
    );
  }

  // Bullet list: "- " or "• "
  if (/^[-•]\s/.test(trimmed)) {
    const content = trimmed.replace(/^[-•]\s/, "");
    return (
      <li key={i} className="text-sm font-light text-foreground/90 leading-relaxed mb-1.5 ml-4 list-disc marker:text-muted-foreground">
        {renderInline(content, `${i}-li`)}
      </li>
    );
  }

  // Normal paragraph
  return (
    <p key={i} className="text-sm font-light text-foreground/90 leading-relaxed mb-3 last:mb-0">
      {renderInline(line, `${i}-p`)}
    </p>
  );
}

export default function StreamingText({ stream, onComplete, className }: StreamingTextProps) {
  const [text, setText] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    if (!stream) return;
    doneRef.current = false;
    setText("");

    if (stream.locked) return;

    const decoder = new TextDecoder();
    let reader: ReadableStreamDefaultReader<Uint8Array>;
    try {
      reader = stream.getReader();
    } catch {
      return;
    }

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
      {text.split("\n").map((line, i) => renderLine(line, i))}
    </div>
  );
}
