import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("app-theme") || "dark";
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("app-theme", theme);
  }, [theme, mounted]);

  const toggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <button
        className="group h-10 w-10 rounded-full border border-border bg-card/60 flex items-center justify-center text-muted-foreground shadow-sm"
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      onClick={toggle}
      className="group h-10 w-10 rounded-full border border-border bg-card/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shadow-sm"
      title={theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"}
    >
      {theme === "dark" ? (
        <Sun className="h-[18px] w-[18px] stroke-[1.5] transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="h-[18px] w-[18px] stroke-[1.5] transition-transform duration-300 group-hover:-rotate-12" />
      )}
    </button>
  );
}
