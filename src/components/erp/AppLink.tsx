import { forwardRef, type AnchorHTMLAttributes } from "react";
import { useRouter } from "@tanstack/react-router";

/** Anchor for dynamic in-app paths (strings from data). Navigates client-side so session state is kept. */
export const AppLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
  function AppLink({ href, onClick, ...rest }, ref) {
    const router = useRouter();
    return (
      <a
        ref={ref}
        href={href}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || !href.startsWith("/")) return;
          e.preventDefault();
          router.history.push(href);
        }}
        {...rest}
      />
    );
  },
);
