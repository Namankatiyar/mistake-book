"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { Icon, SubjectIcon } from "./ui";
import { useSettings } from "@/lib/settings";
import { getSyllabus, chapterById, subjectById, subjectOfChapter, type Chapter } from "@/lib/syllabus";

/* -------------------------------------------------------------------------- */
/*                                Types & Models                               */
/* -------------------------------------------------------------------------- */

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  group?: string;
  disabled?: boolean;
  description?: string;
}

export type DropdownAlign = "start" | "end" | "auto";

export interface SelectDropdownProps {
  value?: string | null;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  children?: ReactNode;
  placeholder?: string;
  small?: boolean;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  align?: DropdownAlign;
  "aria-label"?: string;
  name?: string;
  id?: string;
}

export interface SearchableChapterSelectProps {
  value?: string | null;
  onChange?: (chapterId: string, subjectId?: string) => void;
  subjectId?: string | null; // Filter to specific subject (e.g. "phy", "chem", "math"), or null for all
  allowAllSubjects?: boolean; // When true, allows searching across all subjects even if subjectId is provided
  allOptionLabel?: string; // Optional label for an "All chapters" option (e.g. value "")
  placeholder?: string;
  small?: boolean;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  align?: DropdownAlign;
  "aria-label"?: string;
}

/* -------------------------------------------------------------------------- */
/*                         Viewport Collision Helpers                          */
/* -------------------------------------------------------------------------- */

interface MenuPosition {
  top: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

function calculateMenuPosition(
  triggerEl: HTMLElement,
  menuEl: HTMLElement,
  align: DropdownAlign = "auto",
  gap = 4,
  padding = 8,
): MenuPosition {
  const triggerRect = triggerEl.getBoundingClientRect();
  const menuRect = menuEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - triggerRect.bottom - gap - padding;
  const spaceAbove = triggerRect.top - gap - padding;

  let placement: "bottom" | "top" = "bottom";
  let maxHeight = 320;

  // Decide whether to flip to top based on space availability
  if (spaceBelow < 180 && spaceAbove > spaceBelow) {
    placement = "top";
    maxHeight = Math.min(360, Math.max(120, spaceAbove));
  } else {
    placement = "bottom";
    maxHeight = Math.min(360, Math.max(120, spaceBelow));
  }

  // Calculate top coordinate
  let top = 0;
  if (placement === "bottom") {
    top = triggerRect.bottom + gap;
  } else {
    // When opening above, place menu immediately above triggerRect.top
    const menuHeight = Math.min(menuRect.height || 260, maxHeight);
    top = Math.max(padding, triggerRect.top - gap - menuHeight);
  }

  // Calculate horizontal position
  const minWidth = Math.max(triggerRect.width, 160);
  const effectiveMenuWidth = Math.max(menuRect.width || minWidth, minWidth);

  let left = triggerRect.left;
  if (align === "end") {
    left = triggerRect.right - effectiveMenuWidth;
  } else if (align === "auto") {
    // If opening at start overflows right edge, try end alignment
    if (left + effectiveMenuWidth > vw - padding) {
      left = triggerRect.right - effectiveMenuWidth;
    }
  }

  // Clamp left so it stays within viewport boundaries
  if (left + effectiveMenuWidth > vw - padding) {
    left = Math.max(padding, vw - effectiveMenuWidth - padding);
  }
  if (left < padding) {
    left = padding;
  }

  const maxWidth = Math.max(160, vw - 2 * padding);

  return {
    top,
    left,
    minWidth,
    maxWidth,
    maxHeight,
    placement,
  };
}

/* -------------------------------------------------------------------------- */
/*                       Standard Global Select Component                      */
/* -------------------------------------------------------------------------- */

export function SelectDropdown({
  value,
  defaultValue,
  onChange,
  options: propOptions,
  children,
  placeholder = "Select...",
  small = false,
  disabled = false,
  className = "",
  menuClassName = "",
  align = "auto",
  "aria-label": ariaLabel,
  name,
  id,
}: SelectDropdownProps) {
  const [internalValue, setInternalValue] = useState<string>(
    value ?? defaultValue ?? "",
  );
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const isControlled = value !== undefined;
  const currentValue = isControlled ? (value ?? "") : internalValue;

  // Extract options from props or children (<option> elements)
  const options = useMemo<SelectOption[]>(() => {
    if (propOptions && propOptions.length > 0) {
      return propOptions;
    }
    const extracted: SelectOption[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child)) {
        const c = child as ReactElement<{
          value?: string;
          children?: ReactNode;
          disabled?: boolean;
        }>;
        if (c.type === "option") {
          const val = c.props.value !== undefined ? String(c.props.value) : "";
          const label =
            typeof c.props.children === "string"
              ? c.props.children
              : String(c.props.children ?? val);
          extracted.push({
            value: val,
            label,
            disabled: c.props.disabled,
          });
        }
      }
    });
    return extracted;
  }, [propOptions, children]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === currentValue),
    [options, currentValue],
  );

  const openMenu = useCallback(() => {
    const idx = options.findIndex((opt) => opt.value === currentValue);
    setFocusedIndex(idx >= 0 ? idx : 0);
    setIsOpen(true);
  }, [options, currentValue]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (val: string) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(val);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, onChange],
  );

  // Position synchronization with viewport edges
  useLayoutEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      // Hide if trigger is scrolled completely out of view
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        setIsOpen(false);
        return;
      }

      const pos = calculateMenuPosition(trigger, menu, align);
      menu.style.position = "fixed";
      menu.style.top = `${Math.round(pos.top)}px`;
      menu.style.left = `${Math.round(pos.left)}px`;
      menu.style.minWidth = `${Math.round(pos.minWidth)}px`;
      menu.style.maxWidth = `${Math.round(pos.maxWidth)}px`;
      menu.style.maxHeight = `${Math.round(pos.maxHeight)}px`;
      menu.setAttribute("data-placement", pos.placement);
      menu.style.opacity = "1";
      menu.style.pointerEvents = "auto";
    };

    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, align]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [isOpen, closeMenu]);

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, focusedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === "Escape" || e.key === "Tab") {
      closeMenu();
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev + 1;
        while (next < options.length && options[next]?.disabled) {
          next++;
        }
        return next < options.length ? next : prev;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && options[next]?.disabled) {
          next--;
        }
        return next >= 0 ? next : prev;
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const targetOpt = options[focusedIndex];
      if (targetOpt && !targetOpt.disabled) {
        handleSelect(targetOpt.value);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(options.length - 1);
    }
  };

  // Group options if any option specifies group
  const groupedOptions = useMemo(() => {
    const hasGroups = options.some((opt) => !!opt.group);
    if (!hasGroups) return null;

    const map = new Map<string, SelectOption[]>();
    options.forEach((opt) => {
      const grp = opt.group ?? "";
      if (!map.has(grp)) map.set(grp, []);
      map.get(grp)!.push(opt);
    });
    return Array.from(map.entries());
  }, [options]);

  const heightClass = small ? "h-7 text-[13px] px-2" : "h-8 text-sm px-2.5";

  return (
    <div className={`relative inline-block text-left ${className}`} id={id}>
      {/* Hidden input for HTML form integration */}
      {name && <input type="hidden" name={name} value={currentValue} />}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`group flex w-full items-center justify-between gap-1.5 rounded-[6px] border border-line bg-surface text-fg font-normal transition-[border-color,background-color,box-shadow] duration-120 outline-none select-none ${heightClass} ${
          isOpen
            ? "border-muted ring-1 ring-fg/10"
            : "hover:border-fg/30 hover:bg-soft/30 focus-visible:border-muted focus-visible:ring-1 focus-visible:ring-fg"
        } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none bg-soft/50" : "cursor-pointer"}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 flex items-center justify-center">
              {selectedOption.icon}
            </span>
          )}
          <span
            className={`truncate ${!selectedOption && !currentValue ? "text-muted" : "text-fg"}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <span
          className={`shrink-0 text-muted transition-transform duration-150 group-hover:text-fg ${
            isOpen ? "rotate-180 text-fg" : ""
          }`}
          aria-hidden="true"
        >
          <Icon name="chevron-down" size={small ? 12 : 13} />
        </span>
      </button>

      {/* Dropdown Menu Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            style={{ opacity: 0, pointerEvents: "none" }}
            className={`dropdown-menu fixed z-50 flex flex-col rounded-[8px] border border-line bg-surface text-fg shadow-lg shadow-black/8 dark:shadow-black/40 overflow-hidden ${menuClassName}`}
            onKeyDown={handleKeyDown}
          >
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-1 text-[13px] overscroll-contain"
            >
              {options.length === 0 ? (
                <div className="px-3 py-2.5 text-center text-muted text-[13px]">
                  No options available
                </div>
              ) : groupedOptions ? (
                groupedOptions.map(([groupName, groupOpts]) => (
                  <div key={groupName} className="mb-1 last:mb-0">
                    {groupName && (
                      <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted select-none">
                        {groupName}
                      </div>
                    )}
                    {groupOpts.map((opt) => {
                      const isSelected = opt.value === currentValue;
                      return (
                        <div
                          key={opt.value}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={opt.disabled}
                          onClick={() => {
                            if (!opt.disabled) handleSelect(opt.value);
                          }}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-[5px] cursor-pointer select-none transition-colors ${
                            opt.disabled
                              ? "opacity-40 cursor-not-allowed pointer-events-none"
                              : isSelected
                                ? "bg-soft/80 font-medium text-fg"
                                : "text-fg/90 hover:bg-soft hover:text-fg"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                            {opt.icon && (
                              <span className="shrink-0 flex items-center justify-center">
                                {opt.icon}
                              </span>
                            )}
                            <span className="truncate">{opt.label}</span>
                          </span>
                          {isSelected && (
                            <Icon
                              name="check"
                              size={13}
                              className="shrink-0 text-fg"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                options.map((opt, idx) => {
                  const isSelected = opt.value === currentValue;
                  const isFocused = idx === focusedIndex;
                  return (
                    <div
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      data-focused={isFocused || undefined}
                      onClick={() => {
                        if (!opt.disabled) handleSelect(opt.value);
                      }}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer select-none transition-colors ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed pointer-events-none"
                          : isSelected
                            ? "bg-soft/80 font-medium text-fg"
                            : isFocused
                              ? "bg-soft text-fg"
                              : "text-fg/90 hover:bg-soft hover:text-fg"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
                        {opt.icon && (
                          <span className="shrink-0 flex items-center justify-center">
                            {opt.icon}
                          </span>
                        )}
                        <span className="truncate">{opt.label}</span>
                      </span>
                      {isSelected && (
                        <Icon
                          name="check"
                          size={13}
                          className="shrink-0 text-fg"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             Searchable Chapter Select Variant (Chapter Names Only)         */
/* -------------------------------------------------------------------------- */

export function SearchableChapterSelect({
  value,
  onChange,
  subjectId,
  allowAllSubjects = false,
  allOptionLabel,
  placeholder = "Search chapter...",
  small = false,
  disabled = false,
  className = "",
  menuClassName = "",
  align = "auto",
  "aria-label": ariaLabel = "Select chapter",
}: SearchableChapterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const { settings } = useSettings();
  const syllabus = useMemo(
    () => getSyllabus(settings.examMode),
    [settings.examMode],
  );

  // Retrieve selected chapter and subject info
  const selectedChapter = useMemo(() => {
    if (!value) return null;
    return chapterById(value);
  }, [value]);

  const selectedSubject = useMemo(() => {
    if (!selectedChapter) {
      return subjectId ? subjectById(subjectId) : null;
    }
    return (
      syllabus.find((s) =>
        s.chapters.some((c) => c.id === selectedChapter.id),
      ) ?? subjectOfChapter(selectedChapter.id)
    );
  }, [selectedChapter, subjectId, syllabus]);

  // Build the list of chapters to display
  const chaptersList = useMemo<{
    chapter: Chapter;
    subjectId: string;
    subjectName: string;
  }[]>(() => {
    const list: { chapter: Chapter; subjectId: string; subjectName: string }[] =
      [];

    if (subjectId && !allowAllSubjects) {
      const s = subjectById(subjectId);
      if (s) {
        s.chapters.forEach((c) => {
          list.push({ chapter: c, subjectId: s.id, subjectName: s.name });
        });
      }
    } else {
      // All subjects in active syllabus
      syllabus.forEach((s) => {
        s.chapters.forEach((c) => {
          list.push({ chapter: c, subjectId: s.id, subjectName: s.name });
        });
      });
    }
    return list;
  }, [subjectId, allowAllSubjects, syllabus]);

  // Filter chapters based on search query
  const filteredChapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chaptersList;
    return chaptersList.filter(
      (item) =>
        item.chapter.name.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q),
    );
  }, [chaptersList, query]);

  const openMenu = useCallback(() => {
    setQuery("");
    setHighlightedIndex(0);
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (chId: string, subId?: string) => {
      onChange?.(chId, subId);
      setIsOpen(false);
    },
    [onChange],
  );

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [isOpen, closeMenu]);

  // Synchronize positioning with viewport edges
  useLayoutEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        setIsOpen(false);
        return;
      }

      const pos = calculateMenuPosition(trigger, menu, align, 4, 8);
      menu.style.position = "fixed";
      menu.style.top = `${Math.round(pos.top)}px`;
      menu.style.left = `${Math.round(pos.left)}px`;
      menu.style.minWidth = `${Math.round(Math.max(pos.minWidth, 240))}px`;
      menu.style.maxWidth = `${Math.round(pos.maxWidth)}px`;
      menu.style.maxHeight = `${Math.round(pos.maxHeight)}px`;
      menu.setAttribute("data-placement", pos.placement);
      menu.style.opacity = "1";
      menu.style.pointerEvents = "auto";
    };

    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, align, filteredChapters.length]);

  // Keep highlighted item in view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      // Accounting for allOption if present
      const targetEl = listRef.current.children[
        allOptionLabel ? highlightedIndex : highlightedIndex
      ] as HTMLElement | undefined;
      targetEl?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, highlightedIndex, allOptionLabel]);

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }

    const totalCount = filteredChapters.length + (allOptionLabel ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < totalCount ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allOptionLabel && highlightedIndex === 0) {
        handleSelect("", subjectId ?? undefined);
        return;
      }
      const actualIdx = allOptionLabel ? highlightedIndex - 1 : highlightedIndex;
      const target = filteredChapters[actualIdx];
      if (target) {
        handleSelect(target.chapter.id, target.subjectId);
      }
    }
  };

  // Highlight matched search text
  const renderHighlighted = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight.trim()})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.trim().toLowerCase() ? (
        <span
          key={i}
          className="font-semibold text-fg underline decoration-fg/40 underline-offset-2"
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const heightClass = small ? "h-7 text-[13px] px-2" : "h-8 text-sm px-2.5";

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`group flex w-full items-center justify-between gap-1.5 rounded-[6px] border border-line bg-surface text-fg font-normal transition-[border-color,background-color,box-shadow] duration-120 outline-none select-none ${heightClass} ${
          isOpen
            ? "border-muted ring-1 ring-fg/10"
            : "hover:border-fg/30 hover:bg-soft/30 focus-visible:border-muted focus-visible:ring-1 focus-visible:ring-fg"
        } ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none bg-soft/50" : "cursor-pointer"}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {selectedSubject && (
            <SubjectIcon
              subject={selectedSubject.id}
              size={small ? 13 : 14}
              className="shrink-0"
            />
          )}
          <span
            className={`truncate ${!selectedChapter && !value ? "text-muted" : "text-fg"}`}
          >
            {selectedChapter
              ? selectedChapter.name
              : value === "" && allOptionLabel
                ? allOptionLabel
                : placeholder}
          </span>
        </span>
        <span
          className={`shrink-0 text-muted transition-transform duration-150 group-hover:text-fg ${
            isOpen ? "rotate-180 text-fg" : ""
          }`}
          aria-hidden="true"
        >
          <Icon name="chevron-down" size={small ? 12 : 13} />
        </span>
      </button>

      {/* Embedded Search Dropdown Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            style={{ opacity: 0, pointerEvents: "none" }}
            className={`dropdown-menu fixed z-50 flex flex-col rounded-[8px] border border-line bg-surface text-fg shadow-lg shadow-black/8 dark:shadow-black/40 overflow-hidden ${menuClassName}`}
            onKeyDown={handleKeyDown}
          >
            {/* Embedded Search Header */}
            <div className="border-b border-line p-1.5 bg-surface sticky top-0 z-10">
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-2 text-muted">
                  <Search size={13} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Search chapter name..."
                  className="w-full h-7 pl-7 pr-7 rounded-[5px] bg-soft/50 text-[13px] text-fg placeholder:text-muted focus:outline-none focus:bg-soft/90 focus:ring-1 focus:ring-line transition-colors"
                  data-esc-local
                  onClick={(e) => e.stopPropagation()}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-muted hover:text-fg"
                    aria-label="Clear search"
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* List of Chapters with Subject Badges */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-1 text-[13px] overscroll-contain"
            >
              {allOptionLabel && !query && (
                <div
                  role="option"
                  aria-selected={value === ""}
                  onClick={() => handleSelect("", subjectId ?? undefined)}
                  onMouseEnter={() => setHighlightedIndex(0)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer select-none transition-colors ${
                    value === ""
                      ? "bg-soft/80 font-medium text-fg"
                      : highlightedIndex === 0
                        ? "bg-soft text-fg"
                        : "text-fg/90 hover:bg-soft hover:text-fg"
                  }`}
                >
                  <span className="truncate">{allOptionLabel}</span>
                  {value === "" && (
                    <Icon name="check" size={13} className="shrink-0 text-fg" />
                  )}
                </div>
              )}

              {filteredChapters.length === 0 ? (
                <div className="px-3 py-6 text-center text-muted text-[13px]">
                  No chapters matching &ldquo;{query}&rdquo;
                </div>
              ) : (
                filteredChapters.map((item, idx) => {
                  const effectiveIdx = allOptionLabel && !query ? idx + 1 : idx;
                  const isSelected = item.chapter.id === value;
                  const isHighlighted = effectiveIdx === highlightedIndex;

                  return (
                    <div
                      key={item.chapter.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        handleSelect(item.chapter.id, item.subjectId)
                      }
                      onMouseEnter={() => setHighlightedIndex(effectiveIdx)}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer select-none transition-colors ${
                        isSelected
                          ? "bg-soft/80 font-medium text-fg"
                          : isHighlighted
                            ? "bg-soft text-fg"
                            : "text-fg/90 hover:bg-soft hover:text-fg"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
                        <SubjectIcon
                          subject={item.subjectId}
                          size={14}
                          className="shrink-0"
                        />
                        <span className="truncate">
                          {renderHighlighted(item.chapter.name, query)}
                        </span>
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <Icon
                            name="check"
                            size={13}
                            className="shrink-0 text-fg"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Chapter Count indicator */}
            <div className="px-2.5 py-1 border-t border-line bg-surface/80 text-[11px] text-muted flex items-center justify-between select-none">
              <span>
                {filteredChapters.length} chapter
                {filteredChapters.length === 1 ? "" : "s"}
              </span>
              <span className="text-[10px] opacity-75">
                ↑↓ Navigate · ↵ Select
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
