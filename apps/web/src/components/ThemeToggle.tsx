import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "../theme";

/** Switches the page between light and dark. */
export function ThemeToggle({ className = "quiet icon-only" }: { className?: string }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={className} onClick={() => setTheme(next)} aria-label={next === "dark" ? "Dark theme" : "Light theme"} title={next === "dark" ? "Dark theme" : "Light theme"}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
