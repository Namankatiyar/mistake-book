"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "center" | "start" | "end";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  offset?: number;
  delay?: number;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  asChild?: boolean;
}

interface PositionResult {
  x: number;
  y: number;
  actualSide: TooltipSide;
  arrowOffset: number;
}

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function calculatePosition(
  triggerEl: HTMLElement,
  tooltipEl: HTMLElement,
  preferredSide: TooltipSide = "top",
  preferredAlign: TooltipAlign = "center",
  offset = 7,
  padding = 8,
): PositionResult {
  const triggerRect = triggerEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let actualSide = preferredSide;

  // 1. Collision detection on primary axis (flip if no room)
  if (preferredSide === "top") {
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const needed = tooltipRect.height + offset + padding;
    if (spaceTop < needed && spaceBottom >= needed) {
      actualSide = "bottom";
    }
  } else if (preferredSide === "bottom") {
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const needed = tooltipRect.height + offset + padding;
    if (spaceBottom < needed && spaceTop >= needed) {
      actualSide = "top";
    }
  } else if (preferredSide === "left") {
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;
    const needed = tooltipRect.width + offset + padding;
    if (spaceLeft < needed && spaceRight >= needed) {
      actualSide = "right";
    }
  } else if (preferredSide === "right") {
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;
    const needed = tooltipRect.width + offset + padding;
    if (spaceRight < needed && spaceLeft >= needed) {
      actualSide = "left";
    }
  }

  let x = 0;
  let y = 0;
  let arrowOffset = 0;

  if (actualSide === "top" || actualSide === "bottom") {
    // Primary axis
    if (actualSide === "top") {
      y = triggerRect.top - tooltipRect.height - offset;
    } else {
      y = triggerRect.bottom + offset;
    }

    // Secondary axis (horizontal)
    let idealX: number;
    if (preferredAlign === "start") {
      idealX = triggerRect.left;
    } else if (preferredAlign === "end") {
      idealX = triggerRect.right - tooltipRect.width;
    } else {
      idealX = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    }

    // Clamp horizontally to remain fully inside the viewport
    x = Math.max(padding, Math.min(idealX, viewportWidth - tooltipRect.width - padding));

    // Calculate arrow position pointing to trigger's center
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const rawArrowX = triggerCenterX - x;
    // Keep arrow away from rounded corners (min 7px, max width - 7px)
    arrowOffset = Math.max(7, Math.min(rawArrowX, tooltipRect.width - 7));
  } else {
    // Secondary axis (vertical for left/right)
    if (actualSide === "left") {
      x = triggerRect.left - tooltipRect.width - offset;
    } else {
      x = triggerRect.right + offset;
    }

    let idealY: number;
    if (preferredAlign === "start") {
      idealY = triggerRect.top;
    } else if (preferredAlign === "end") {
      idealY = triggerRect.bottom - tooltipRect.height;
    } else {
      idealY = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
    }

    // Clamp vertically to remain fully inside the viewport
    y = Math.max(padding, Math.min(idealY, viewportHeight - tooltipRect.height - padding));

    // Calculate arrow position pointing to trigger's center
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const rawArrowY = triggerCenterY - y;
    arrowOffset = Math.max(7, Math.min(rawArrowY, tooltipRect.height - 7));
  }

  return { x, y, actualSide, arrowOffset };
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  offset = 7,
  delay = 180,
  disabled = false,
  className = "",
  wrapperClassName = "",
  asChild = false,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMounted = useIsMounted();
  const id = useId();

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleOpen = useCallback((immediate = false) => {
    if (disabled || !content) return;
    clearTimer();
    if (immediate || delay === 0) {
      setIsOpen(true);
    } else {
      timerRef.current = setTimeout(() => {
        setIsOpen(true);
      }, delay);
    }
  }, [disabled, content, clearTimer, delay]);

  const handleClose = useCallback(() => {
    clearTimer();
    setIsOpen(false);
  }, [clearTimer]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, handleClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Synchronize layout, viewport reactivity, and repositioning
  useLayoutEffect(() => {
    if (!isOpen || !isMounted) return;

    const update = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const rect = trigger.getBoundingClientRect();
      // Hide if trigger has scrolled outside the visible viewport
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        tooltip.style.opacity = "0";
        return;
      }

      const { x, y, actualSide, arrowOffset } = calculatePosition(
        trigger,
        tooltip,
        side,
        align,
        offset,
        8,
      );

      tooltip.style.left = `${Math.round(x)}px`;
      tooltip.style.top = `${Math.round(y)}px`;
      tooltip.setAttribute("data-side", actualSide);
      tooltip.style.opacity = "1";

      const arrow = arrowRef.current;
      if (arrow) {
        arrow.setAttribute("data-side", actualSide);
        if (actualSide === "top" || actualSide === "bottom") {
          arrow.style.left = `${Math.round(arrowOffset)}px`;
          arrow.style.top = actualSide === "top" ? "100%" : "0";
          arrow.style.transform = "translate(-50%, -50%) rotate(45deg)";
        } else {
          arrow.style.top = `${Math.round(arrowOffset)}px`;
          arrow.style.left = actualSide === "left" ? "100%" : "0";
          arrow.style.transform = "translate(-50%, -50%) rotate(45deg)";
        }
      }
    };

    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, isMounted, side, align, offset]);

  if (!content || disabled) {
    return <>{children}</>;
  }

  // Trigger handlers
  const triggerProps = {
    onMouseEnter: () => handleOpen(false),
    onMouseLeave: handleClose,
    onFocus: () => handleOpen(true),
    onBlur: handleClose,
    onPointerDown: handleClose,
    "aria-describedby": isOpen ? id : undefined,
  };

  const renderedTrigger = (
    <span
      ref={triggerRef}
      className={`inline-flex shrink-0 ${wrapperClassName}`}
      {...triggerProps}
    >
      {children}
    </span>
  );

  const tooltipElement =
    isOpen && isMounted ? (
      createPortal(
        <div
          ref={tooltipRef}
          id={id}
          role="tooltip"
          data-side={side}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            opacity: 0,
            zIndex: 9999,
            transition: "opacity 100ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className={`pointer-events-none select-none rounded-[5px] bg-[#1a1a1a] px-2.5 py-1 text-[11.5px] font-medium text-neutral-100 shadow-md border border-neutral-700/60 dark:bg-[#222222] dark:text-[#f4f4f4] dark:border-neutral-700 tracking-tight ${className}`}
        >
          {content}
          <span
            ref={arrowRef}
            aria-hidden="true"
            className="tooltip-arrow bg-[#1a1a1a] dark:bg-[#222222] border-neutral-700/60 dark:border-neutral-700"
          />
        </div>,
        document.body,
      )
    ) : null;

  return (
    <>
      {renderedTrigger}
      {tooltipElement}
    </>
  );
}
