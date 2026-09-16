"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type Command = {
  id: string;
  label: string;
  description?: string;
  action: () => void;
};

type Props = {
  commands: Command[];
  onClose: () => void;
};

export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter(
    (cmd) =>
      !query.trim() ||
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function handleKey(event: React.KeyboardEvent) {
    if (event.key === "Tab") {
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>(
        "input, button:not(:disabled)",
      );
      if (nodes?.length) {
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, Math.min(i + 1, filtered.length - 1)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (event.key === "Enter" && filtered[activeIndex]) {
      filtered[activeIndex].action();
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-5 py-4">
          <MagnifyingGlass size={18} className="shrink-0 text-[var(--muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search commands…"
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <kbd className="rounded-md border border-[var(--border-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              No commands match.
            </p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className={cn(
                  "flex w-full flex-col rounded-[1.2rem] px-4 py-3 text-left transition-colors",
                  i === activeIndex
                    ? "bg-[var(--accent-soft)]"
                    : "hover:bg-[var(--surface)]",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    i === activeIndex
                      ? "text-[var(--accent)]"
                      : "text-[var(--ink)]",
                  )}
                >
                  {cmd.label}
                </span>
                {cmd.description && (
                  <span className="mt-0.5 text-xs text-[var(--muted)]">
                    {cmd.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
