export type DesignKey = "a" | "b" | "c";

export const designs = {
  a: { name: "Modern Travel Blog", color: "orange" },
  b: { name: "Destination Guide", color: "blue" },
  c: { name: "Interactive Planner", color: "green" },
} as const;

export function parseDesign(searchParams: { design?: string }): DesignKey {
  const d = searchParams?.design;
  if (d === "b" || d === "c") return d;
  return "a";
}

export function getDesign(searchParams: { design?: string }) {
  const key = parseDesign(searchParams);
  return { key, ...designs[key] };
}
