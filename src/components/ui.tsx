"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { FlaskConical, HotAirBalloon, Sigma, Dna } from "lucide-react";
import type { MistakeTone } from "@/lib/model";
import {
  Tooltip,
  type TooltipProps,
  type TooltipSide,
  type TooltipAlign,
} from "./tooltip";
import {
  SelectDropdown,
  SearchableChapterSelect,
  type SelectOption,
  type DropdownAlign,
} from "./select-dropdown";

export {
  Tooltip,
  type TooltipProps,
  type TooltipSide,
  type TooltipAlign,
  SelectDropdown,
  SearchableChapterSelect,
  type SelectOption,
  type DropdownAlign,
};

/* ---- Icons: quiet 16px strokes ---- */

export type IconName =
  | "plus"
  | "x"
  | "check"
  | "eye"
  | "eye-off"
  | "pencil"
  | "archive"
  | "unarchive"
  | "rotate"
  | "trash"
  | "chevron-down"
  | "chevron-right"
  | "arrow-left"
  | "arrow-right"
  | "image"
  | "sun"
  | "moon"
  | "sliders"
  | "upload"
  | "settings"
  | "cog";

const PATHS: Record<IconName, ReactNode> = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </>
  ),
  pencil: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  archive: (
    <>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>
  ),
  unarchive: (
    <>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h2" />
      <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
      <path d="m9 15 3-3 3 3" />
      <path d="M12 12v6" />
    </>
  ),
  rotate: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sliders: (
    <>
      <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" />
      <path d="M14 2v4M8 10v4M16 18v4" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function SubjectIcon({
  subject,
  size = 15,
  className = "",
}: {
  subject: string;
  size?: number;
  className?: string;
}) {
  const s = subject.toLowerCase();
  let icon: ReactNode = null;
  if (s === "phy" || s === "physics") {
    icon = (
      <HotAirBalloon
        size={size}
        className={`shrink-0 text-blue-500 dark:text-blue-400 ${className}`}
        aria-hidden="true"
      />
    );
  } else if (s === "chem" || s === "chemistry") {
    icon = (
      <FlaskConical
        size={size}
        className={`shrink-0 text-pink-500 dark:text-pink-400 ${className}`}
        aria-hidden="true"
      />
    );
  } else if (s === "math" || s === "maths" || s === "mathematics") {
    icon = (
      <Sigma
        size={size}
        className={`shrink-0 text-yellow-500 dark:text-yellow-400 ${className}`}
        aria-hidden="true"
      />
    );
  } else if (s === "bio" || s === "biology") {
    icon = (
      <Dna
        size={size}
        className={`shrink-0 text-emerald-500 dark:text-emerald-400 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (!icon) return null;

  return (
    <span
      className="flex h-5 w-5 flex-none items-center justify-center"
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

/* ---- Buttons ---- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger" | "warn";
  size?: "md" | "sm";
};

export function Button({
  variant = "outline",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}
      {...rest}
    />
  );
}

export function IconButton({
  name,
  label,
  active,
  className = "",
  size = 16,
  tooltip,
  tooltipSide,
  tooltipAlign,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  name: IconName;
  label: string;
  active?: boolean;
  size?: number;
  tooltip?: ReactNode | false;
  tooltipSide?: TooltipSide;
  tooltipAlign?: TooltipAlign;
}) {
  const content = tooltip === false ? null : (tooltip ?? label);

  const button = (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      data-active={active || undefined}
      {...rest}
    >
      <Icon name={name} size={size} />
    </button>
  );

  if (!content) {
    return button;
  }

  return (
    <Tooltip content={content} side={tooltipSide} align={tooltipAlign} asChild>
      {button}
    </Tooltip>
  );
}

/* ---- Two-step destructive confirmation, inline ---- */

export function ConfirmAction({
  icon,
  label,
  confirmText,
  warning,
  tone = "danger",
  size = 16,
  className = "",
  tooltipSide,
  tooltipAlign,
  onConfirm,
}: {
  icon: IconName;
  label: string;
  confirmText: string;
  warning?: string;
  tone?: "danger" | "warn";
  size?: number;
  className?: string;
  tooltipSide?: TooltipSide;
  tooltipAlign?: TooltipAlign;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (!armed) {
    return (
      <IconButton
        name={icon}
        label={label}
        size={size}
        className={className}
        tooltipSide={tooltipSide}
        tooltipAlign={tooltipAlign}
        onClick={() => setArmed(true)}
      />
    );
  }

  return (
    <span className="fade-in inline-flex items-center gap-1.5 text-[13px]">
      <span
        className={`font-medium ${tone === "danger" ? "text-red" : "text-orange"}`}
      >
        {warning ?? label}
      </span>
      <Button
        size="sm"
        variant={tone === "danger" ? "danger" : "warn"}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmText}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}

/* ---- Modal: 1px border carries the structure, no shadow ---- */

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function Modal({
  open,
  onClose,
  label,
  wide,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const mounted = useIsMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Fields marked data-esc-local handle Escape themselves.
        const target = e.target as HTMLElement | null;
        if (target?.closest?.("[data-esc-local]")) return;
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const widthClass = className.includes("max-w-")
    ? ""
    : wide
      ? "max-w-[640px]"
      : "max-w-[520px]";

  const content = (
    <div
      className="fixed inset-0 z-50 flex min-h-full justify-center overflow-y-auto bg-black/40 p-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`fade-in m-auto w-full ${widthClass} rounded-[10px] border border-line bg-surface ${className}`.trim()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/* ---- Form primitives ---- */

export function Select({
  className = "",
  small,
  children,
  value,
  onChange,
  disabled,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  small?: boolean;
  options?: SelectOption[];
  align?: DropdownAlign;
}) {
  return (
    <SelectDropdown
      className={className}
      small={small}
      value={value !== undefined ? String(value) : undefined}
      onChange={(val) => {
        if (onChange) {
          onChange({
            target: { value: val },
            currentTarget: { value: val },
          } as unknown as React.ChangeEvent<HTMLSelectElement>);
        }
      }}
      disabled={disabled}
      options={rest.options}
      align={rest.align}
      aria-label={rest["aria-label"]}
      id={rest.id}
      name={rest.name}
    >
      {children}
    </SelectDropdown>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[13px] font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      data-on={checked || undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function Kbd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <kbd className={`kbd ${className}`}>{children}</kbd>;
}

/* ---- Semantic bits ---- */

export function MistakeDot({ tone }: { tone: MistakeTone }) {
  return (
    <span
      className="dot"
      style={{ background: `var(--${tone}-text)` }}
      aria-hidden="true"
    />
  );
}

export function RevisionBadge({
  count,
  tooltipSide = "top",
  className = "",
  size = "md",
}: {
  count: number;
  tooltipSide?: TooltipSide;
  className?: string;
  size?: "sm" | "md";
}) {
  const tone =
    count === 0
      ? "border-orange-500/90 text-orange-500 dark:text-orange-400 bg-surface/90 dark:bg-[#1c1c1c]/90"
      : count < 3
        ? "border-line text-muted bg-surface/90 dark:bg-[#1c1c1c]/90"
        : "border-green-500/90 text-green-500 dark:text-green-400 bg-surface/90 dark:bg-[#1c1c1c]/90";

  const tooltipText =
    count === 0
      ? "Not revised yet"
      : `Revised ${count} time${count === 1 ? "" : "s"}`;

  const sizeClass =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px]"
      : "px-2.5 py-0.5 text-[12px]";

  return (
    <Tooltip content={tooltipText} side={tooltipSide} asChild>
      <span
        tabIndex={0}
        role="status"
        aria-label={tooltipText}
        className={`tnum inline-flex items-center justify-center rounded-full border ${sizeClass} font-bold leading-none cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-fg/30 select-none backdrop-blur-xs shadow-xs ${tone} ${className}`}
      >
        {count}×
      </span>
    </Tooltip>
  );
}

export function SourceChip({ name }: { name: string }) {
  return <span className="chip">{name}</span>;
}
