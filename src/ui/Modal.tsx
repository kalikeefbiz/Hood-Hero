import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
// Native dialog supplies background inertness, a focus trap, and focus restoration.
export function Modal({
  children,
  label,
  onDismiss,
}: {
  children: ReactNode;
  label: string;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useLayoutEffect(() => {
    const dialog = ref.current!,
      y = window.scrollY;
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
    dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      dismiss.current();
    };
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        !dialog.contains(document.activeElement) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("keydown", trap);
      dialog.close();
      Object.assign(document.body.style, previous);
      window.scrollTo(0, y);
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="encounter-modal"
      aria-label={label}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          dismiss.current();
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
