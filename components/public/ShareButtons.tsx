"use client";

import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
  variant?: "inline" | "sidebar";
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function ShareButtons({ url, title, variant = "inline" }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const linkClass =
    "flex items-center gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors";

  if (variant === "sidebar") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[9px] tracking-widest uppercase text-foreground/30">share</p>
        <a href={xUrl} target="_blank" rel="noopener noreferrer" className={linkClass} title="Share on X">
          <XIcon />
        </a>
        <a href={fbUrl} target="_blank" rel="noopener noreferrer" className={linkClass} title="Share on Facebook">
          <FacebookIcon />
        </a>
        <a href={liUrl} target="_blank" rel="noopener noreferrer" className={linkClass} title="Share on LinkedIn">
          <LinkedInIcon />
        </a>
        <button onClick={handleCopy} className={linkClass} title="Copy link">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 mb-8 pb-8 border-b border-border/20">
      <p className="text-[10px] tracking-widest uppercase text-foreground/30 shrink-0">share</p>
      <div className="flex items-center gap-4 flex-wrap">
        <a href={xUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <XIcon />
          <span>X</span>
        </a>
        <a href={fbUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <FacebookIcon />
          <span>Facebook</span>
        </a>
        <a href={liUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <LinkedInIcon />
          <span>LinkedIn</span>
        </a>
        <button onClick={handleCopy} className={linkClass}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? "copied!" : "copy link"}</span>
        </button>
      </div>
    </div>
  );
}
