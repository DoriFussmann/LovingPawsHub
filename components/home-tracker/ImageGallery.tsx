export default function ImageGallery({ images }: { images: string[] | null }) {
  if (!images || images.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
        Images
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video rounded border border-border overflow-hidden hover:border-foreground/30 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Property image ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
