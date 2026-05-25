"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, Play, Trash2 } from "lucide-react";

interface CheckRow {
  uid: string;
  article: string;
  check: string;
  status: "pass" | "fail";
  detail: string;
}

type OverallResult = "pass" | "fail" | null;

export default function SmokeTestClient() {
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [running, setRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [overallResult, setOverallResult] = useState<OverallResult>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Track fail count without depending on stale state
  const failCountRef = useRef(0);

  const runTests = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setRows([]);
    setOverallResult(null);
    setErrorMsg(null);
    setCurrentStatus(null);
    failCountRef.current = 0;

    try {
      const res = await fetch("/api/admin/smoke-test", { cache: "no-store" });
      if (!res.ok || !res.body) {
        setErrorMsg(`Failed to start: HTTP ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are delimited by double newline
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === "check") {
              const status = event.status as "pass" | "fail";
              if (status === "fail") failCountRef.current++;
              setRows((prev) => [
                ...prev,
                {
                  uid: `${Date.now()}-${Math.random()}`,
                  article: String(event.article ?? ""),
                  check: String(event.check ?? ""),
                  status,
                  detail: String(event.detail ?? ""),
                },
              ]);
            } else if (event.type === "status") {
              setCurrentStatus(String(event.message ?? ""));
            } else if (event.type === "done") {
              setCurrentStatus(null);
              setOverallResult(failCountRef.current === 0 ? "pass" : "fail");
            } else if (event.type === "error") {
              setErrorMsg(String(event.message ?? "unknown error"));
            }
          }
        }
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "connection failed");
    }

    setCurrentStatus(null);
    setRunning(false);
  }, [running]);

  async function handleDeleteSeeds() {
    setDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(false);

    try {
      const res = await fetch("/api/admin/smoke-test/delete-seeds", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "delete failed");
      setDeleteSuccess(true);
      setShowDeleteConfirm(false);
      setRows([]);
      setOverallResult(null);
      setErrorMsg(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "delete failed");
    }

    setDeleting(false);
  }

  const passCount = rows.filter((r) => r.status === "pass").length;
  const failCount = rows.filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-6">
      {/* Overall result badge */}
      {overallResult && (
        <div
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md border text-sm font-mono font-semibold tracking-widest uppercase ${
            overallResult === "pass"
              ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
              : "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              overallResult === "pass" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {overallResult === "pass" ? "PASS" : "FAIL"}
          <span className="text-[10px] font-light normal-case tracking-normal opacity-70 ml-1">
            {passCount} pass · {failCount} fail
          </span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 text-xs font-light rounded-md border bg-foreground text-background border-foreground hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {running ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} />
          )}
          {running ? "running…" : "run tests"}
        </button>

        <button
          onClick={() => {
            setShowDeleteConfirm(true);
            setDeleteError(null);
          }}
          disabled={running || deleting}
          className="flex items-center gap-2 px-4 py-2 text-xs font-light rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 dark:border-red-900/60 dark:hover:bg-red-950/20 disabled:opacity-40 transition-colors"
        >
          <Trash2 size={12} />
          delete seed data
        </button>

        {deleteSuccess && (
          <span className="text-xs font-light text-green-600 dark:text-green-400">
            seed data deleted.
          </span>
        )}
      </div>

      {/* Live status ticker */}
      {running && currentStatus && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <Loader2 size={10} className="animate-spin shrink-0" />
          {currentStatus}
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 rounded-md px-4 py-3">
          <p className="text-xs font-light text-red-600 dark:text-red-400">
            {errorMsg}
          </p>
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs font-light">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-foreground/50 w-[28%]">
                  Check
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-foreground/50 w-[22%]">
                  Target
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-foreground/50 w-[9%]">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-foreground/50">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.uid}
                  className={`border-b border-border/40 last:border-b-0 ${
                    i % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  <td className="px-4 py-2.5 text-foreground/90">
                    {row.check}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/55 font-mono text-[10px] break-all leading-relaxed">
                    {row.article}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                        row.status === "pass"
                          ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                          : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground/55 font-mono text-[10px] break-all leading-relaxed whitespace-pre-wrap">
                    {row.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* In-progress footer */}
          {running && (
            <div className="border-t border-border/40 px-4 py-2.5 flex items-center gap-2 bg-muted/10">
              <Loader2 size={11} className="animate-spin text-foreground/30 shrink-0" />
              <span className="text-[10px] text-muted-foreground">
                running checks…
              </span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!running && rows.length === 0 && !errorMsg && (
        <div className="border border-border rounded-md px-6 py-10 text-center">
          <p className="text-xs font-light text-muted-foreground">
            click &ldquo;run tests&rdquo; to validate seed articles.
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            expects one core article and one spoke article with{" "}
            <span className="font-mono">is_seed = true</span> in the{" "}
            <span className="font-mono">articles</span> table.
          </p>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
          <div className="bg-background border border-border rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="text-[10px] tracking-widests uppercase text-foreground/40 mb-1">
              destructive action
            </p>
            <h2 className="text-sm font-light text-foreground mb-2">
              delete all seed data?
            </h2>
            <p className="text-xs font-light text-muted-foreground mb-6 leading-relaxed">
              this will permanently delete all rows in{" "}
              <span className="font-mono">articles</span> and{" "}
              <span className="font-mono">clusters</span> where{" "}
              <span className="font-mono">is_seed = true</span>. this cannot be
              undone.
            </p>

            {deleteError && (
              <p className="mb-4 text-[10px] text-red-500 font-mono">
                {deleteError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDeleteSeeds}
                disabled={deleting}
                className="flex-1 py-2 text-xs font-light rounded-md border border-red-300 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "deleting…" : "yes, delete"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="flex-1 py-2 text-xs font-light rounded-md border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
