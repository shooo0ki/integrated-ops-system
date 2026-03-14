export const HOUR_PX    = 64;
export const START_HOUR = 7;
export const END_HOUR   = 31;  // 翌7時 (24+7)
export const GRID_H     = (END_HOUR - START_HOUR) * HOUR_PX; // 24 * 64 = 1536
export const TIME_W     = 52;
export const DAY_MIN_W  = 120;
export const HOURS      = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i); // 7..30

export const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];

export const COLORS = [
  { bg: "bg-blue-100",    text: "text-blue-800",    bl: "border-l-blue-400",    hex: "#60a5fa" },
  { bg: "bg-emerald-100", text: "text-emerald-800", bl: "border-l-emerald-400", hex: "#34d399" },
  { bg: "bg-violet-100",  text: "text-violet-800",  bl: "border-l-violet-400",  hex: "#a78bfa" },
  { bg: "bg-orange-100",  text: "text-orange-800",  bl: "border-l-orange-400",  hex: "#fb923c" },
  { bg: "bg-pink-100",    text: "text-pink-800",    bl: "border-l-pink-400",    hex: "#f472b6" },
  { bg: "bg-teal-100",    text: "text-teal-800",    bl: "border-l-teal-400",    hex: "#2dd4bf" },
  { bg: "bg-amber-100",   text: "text-amber-800",   bl: "border-l-amber-400",   hex: "#fbbf24" },
  { bg: "bg-rose-100",    text: "text-rose-800",    bl: "border-l-rose-400",    hex: "#fb7185" },
];
