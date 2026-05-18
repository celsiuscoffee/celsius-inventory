"use client";

import { useRef, useState, type ReactNode, type DragEvent } from "react";
import { Upload, X, FileText } from "lucide-react";

export type FileDropzoneProps = {
  /** Called when files are picked or dropped. */
  onFiles: (files: File[]) => void;
  /** Accept filter (e.g. ".csv,application/pdf,image/*"). Applied both to the
   *  native picker and the drop validator. */
  accept?: string;
  /** Allow multiple files. Default: false. */
  multiple?: boolean;
  /** Disable interaction. */
  disabled?: boolean;
  /** Optional label rendered above the drop hint. */
  label?: string;
  /** Optional helper text rendered under the drop hint. */
  hint?: ReactNode;
  /** Files currently "selected" — shown as chips below the drop area. Optional. */
  selected?: File[];
  /** Called when a chip's X is clicked. If omitted, chips have no remove button. */
  onRemove?: (file: File, index: number) => void;
  /** Visual variant. "area" (default) = full drop pad. "button" = compact button-sized affordance. */
  variant?: "area" | "button";
  /** Override CSS classes for the outer container. */
  className?: string;
  /** Custom child rendered inside the dropzone (overrides default text). */
  children?: ReactNode;
};

export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  label,
  hint,
  selected,
  onRemove,
  variant = "area",
  className,
  children,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null): void {
    if (!list || list.length === 0) return;
    const accepted = filterAccepted(Array.from(list), accept);
    if (accepted.length === 0) return;
    onFiles(multiple ? accepted : accepted.slice(0, 1));
  }

  function onDragOver(e: DragEvent<HTMLDivElement>): void {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }
  function onDrop(e: DragEvent<HTMLDivElement>): void {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const baseArea = "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors cursor-pointer";
  const baseButton = "relative inline-flex items-center gap-2 rounded-md border-2 border-dashed px-3 py-2 text-sm cursor-pointer transition-colors";

  const stateClasses = disabled
    ? "border-neutral-200 bg-neutral-50 text-muted-foreground cursor-not-allowed opacity-60 dark:border-neutral-800 dark:bg-neutral-900"
    : dragging
      ? "border-terracotta bg-terracotta/5 text-terracotta"
      : "border-neutral-300 bg-background hover:border-terracotta hover:bg-terracotta/5 dark:border-neutral-700";

  const containerClass = [
    variant === "area" ? baseArea : baseButton,
    stateClasses,
    className ?? "",
  ].join(" ");

  return (
    <div className="space-y-2">
      {label && variant === "area" && <div className="text-sm font-medium">{label}</div>}
      <div
        className={containerClass}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled) { e.preventDefault(); inputRef.current?.click(); }}}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          disabled={disabled}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        {children ?? (
          variant === "area" ? (
            <>
              <Upload className={`h-6 w-6 ${dragging ? "text-terracotta" : "text-muted-foreground"}`} />
              <div>
                <span className="font-medium">{dragging ? "Drop to upload" : "Drag & drop"}</span>
                <span className="text-muted-foreground"> or <span className="underline">browse</span></span>
              </div>
              {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>{dragging ? "Drop to upload" : (label ?? "Upload file")}</span>
            </>
          )
        )}
      </div>

      {selected && selected.length > 0 && (
        <ul className="space-y-1">
          {selected.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1 text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground">({formatBytes(f.size)})</span>
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(f, i)}
                  className="text-muted-foreground hover:text-rose-600"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function filterAccepted(files: File[], accept: string | undefined): File[] {
  if (!accept) return files;
  const matchers = accept.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return files.filter(f => {
    const ext  = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    const mime = (f.type || "").toLowerCase();
    return matchers.some(m => {
      if (m.startsWith("."))              return ext === m;
      if (m.endsWith("/*"))               return mime.startsWith(m.slice(0, -1));
      return mime === m;
    });
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
