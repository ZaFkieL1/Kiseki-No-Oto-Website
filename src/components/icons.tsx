export function Play(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5 13 8l-9 5.5z" />
    </svg>
  );
}

export function Pause(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 3h3v10H4zM9 3h3v10H9z" />
    </svg>
  );
}

export function Prev(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 3h1.6v10H4zM13 3v10L6 8z" />
    </svg>
  );
}

export function Next(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10.4 3H12v10h-1.6zM3 3l7 5-7 5z" />
    </svg>
  );
}

export function Speaker({ muted }: { muted: boolean }): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 6h2.5L9 3v10L5.5 10H3z" />
      {muted ? (
        <path d="M11 6.2l3.2 3.2-.8.8L10.2 7z M14.2 6.2l.8.8-3.2 3.2-.8-.8z" />
      ) : (
        <path d="M11 5.6a3.4 3.4 0 0 1 0 4.8l-.8-.8a2.3 2.3 0 0 0 0-3.2z" />
      )}
    </svg>
  );
}
