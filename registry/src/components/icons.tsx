/** Inline SVG icons shared by all Agent shells. All track currentColor. */

interface IconProps {
  size?: number;
}

/** The Agent mark: a single filled dot. */
export function AgentIcon({ size = 15 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon({ size = 14 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function SendIcon({ size = 14 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
    </svg>
  );
}

export function StopIcon({ size = 12 }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16">
      <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon({ size = 12 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/** Detach: a panel lifting away from the edge it was pinned to. */
export function DetachIcon({ size = 14 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 2.5H3.5A1 1 0 0 0 2.5 3.5v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9" />
      <path d="M9.5 2.5h4v4M13.5 2.5L8 8" />
    </svg>
  );
}

/** Re-attach: the floating panel returning into its frame. */
export function AttachIcon({ size = 14 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
      <path d="M2.5 10h11" />
    </svg>
  );
}

export function RefreshIcon({ size = 14 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 1.5v3h-3" />
    </svg>
  );
}
