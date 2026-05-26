"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Document = {
  id: string;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
};

export default function DocumentUpload({
  propertyId,
  topicId,
  topicName,
  initialDocuments,
  userId,
  onFieldsExtracted,
}: {
  propertyId: string;
  topicId: string;
  topicName: string;
  initialDocuments: Document[];
  userId: string;
  onFieldsExtracted?: (fields: Record<string, string>) => void;
}) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");

    const supabase = createClient();

    // Upload to storage: {userId}/{propertyId}/{topicId}/{filename}
    const storagePath = `${userId}/${propertyId}/${topicId}/${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("home-tracker")
      .upload(storagePath, file, { upsert: true });

    if (storageError) {
      setUploadError(storageError.message);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // Get public URL (or signed URL for private buckets)
    const { data: urlData } = supabase.storage
      .from("home-tracker")
      .getPublicUrl(storagePath);
    const fileUrl = urlData?.publicUrl ?? null;

    // Insert document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        topic_id: topicId,
        property_id: propertyId,
        file_name: file.name,
        file_url: fileUrl,
        extracted_fields: {},
      })
      .select("id, file_name, file_url, created_at")
      .single();

    if (docError) {
      setUploadError(docError.message);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setDocuments([...documents, doc]);
    setUploading(false);

    // Trigger field extraction if we have a URL
    if (fileUrl) {
      setExtracting(true);
      try {
        const res = await fetch("/api/home-tracker/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl,
            fileType: file.type,
            topicName,
          }),
        });

        if (res.ok) {
          const { fields } = await res.json();

          // Update document with extracted fields
          await supabase
            .from("documents")
            .update({ extracted_fields: fields })
            .eq("id", doc.id);

          onFieldsExtracted?.(fields);
        }
      } catch {
        // Extraction failed — not critical
      } finally {
        setExtracting(false);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
        Documents
      </p>

      {/* Upload button */}
      <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-light bg-card border border-border rounded cursor-pointer hover:border-foreground/30 transition-colors">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v8M2.5 4.5L6 1l3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 9.5v1h10v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {uploading ? "Uploading…" : extracting ? "Extracting fields…" : "Upload document"}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          onChange={handleUpload}
          disabled={uploading || extracting}
          className="sr-only"
        />
      </label>

      {uploadError && (
        <p className="text-xs text-err-ink mt-2">{uploadError}</p>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="mt-3 space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-foreground/30 shrink-0">
                <rect x="1.5" y="0.5" width="9" height="11" rx="1" stroke="currentColor" strokeWidth="1" />
                <path d="M3.5 4h5M3.5 6.5h5M3.5 9h3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
              {doc.file_url ? (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-light text-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors truncate"
                >
                  {doc.file_name ?? "Document"}
                </a>
              ) : (
                <span className="text-xs font-light text-foreground/50 truncate">
                  {doc.file_name ?? "Document"}
                </span>
              )}
              <time className="ml-auto shrink-0 text-[10px] text-foreground/30">
                {new Date(doc.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
