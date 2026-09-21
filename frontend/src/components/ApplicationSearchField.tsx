export function ApplicationSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block min-w-[14rem] flex-1 sm:max-w-xs">
      <span className="sr-only">Search applications</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      >
        <path
          d="M8.5 14.5a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm6.15-1.35 3.35 3.35"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search company, title, or URL"
        className="input py-2 pl-9"
      />
    </label>
  );
}
