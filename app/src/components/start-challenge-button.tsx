"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

type StartChallengeButtonProps = {
  href: string;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">;

export default function StartChallengeButton({
  href,
  className,
  children,
  ...props
}: StartChallengeButtonProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        window.dispatchEvent(new CustomEvent("evalarena:start"));
        props.onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
