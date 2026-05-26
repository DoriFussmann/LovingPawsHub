"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; text: string; checked: boolean };

export default function NextStepsChecklist({
  propertyId,
  initialItems,
}: {
  propertyId: string;
  initialItems: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveItems(updated: Item[]) {
    const supabase = createClient();
    await supabase
      .from("properties")
      .update({ next_steps: updated })
      .eq("id", propertyId);
  }

  async function toggle(id: string) {
    const updated = items.map((i) =>
      i.id === id ? { ...i, checked: !i.checked } : i
    );
    setItems(updated);
    await saveItems(updated);
  }

  async function addItem() {
    if (!newText.trim()) return;
    setSaving(true);
    const item: Item = {
      id: crypto.randomUUID(),
      text: newText.trim(),
      checked: false,
    };
    const updated = [...items, item];
    setItems(updated);
    setNewText("");
    await saveItems(updated);
    setSaving(false);
  }

  async function removeItem(id: string) {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    await saveItems(updated);
  }

  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-foreground/40 mb-3">
        Next steps
      </p>

      <div className="space-y-2 mb-3">
        {items.length === 0 && (
          <p className="text-xs font-light text-muted-foreground">No next steps yet.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggle(item.id)}
              className="w-3.5 h-3.5 accent-accent shrink-0"
            />
            <span
              className={`text-sm font-light flex-1 ${
                item.checked ? "line-through text-foreground/30" : "text-foreground/80"
              }`}
            >
              {item.text}
            </span>
            <button
              onClick={() => removeItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-err-ink transition-all text-xs"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add next step…"
          className="flex-1 px-2.5 py-1.5 text-xs font-light bg-card border border-border rounded focus:outline-none focus:border-foreground/40 transition-colors placeholder:text-foreground/30"
        />
        <button
          onClick={addItem}
          disabled={saving || !newText.trim()}
          className="px-3 py-1.5 text-xs font-light bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Add
        </button>
      </div>
    </div>
  );
}
