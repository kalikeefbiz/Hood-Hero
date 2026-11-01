const paths = {
  save: "M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-8h8v8",
  load: "M5 5h14v16H5zM8 12l4-4 4 4m-4-4v9M9 2h6",
  pulse: "M2 12h5l3-8 4 16 3-8h5",
  message: "M3 4h18v13H9l-6 4zM7 8h10m-10 5h7",
  City: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  People:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75",
  Actions: "M9 4H5v18h14V4h-4M9 2h6v4H9zM8 11h8m-8 5h6",
  Set: "m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM8 12l3 3 5-6",
  Finances: "M3 5h16v4H3zM3 9v11h18V9zM16 13h5v4h-5z",
  Activity: "M4 3h16v18H4zM8 8h8m-8 4h8m-8 4h5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  cash: "M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M5 9v6m14-6v6",
  ap: "m13 2-9 12h7l-1 8 10-13h-8z",
  heat: "M12 3c1 5 6 7 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 1 4 2 4 2-3 2-6 1-10z",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
