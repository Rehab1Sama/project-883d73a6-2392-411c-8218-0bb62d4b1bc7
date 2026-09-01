import { useEffect, useState } from "react";

type Mode = "light" | "dark";

/** تبديل الوضع الليلي مع حفظ الاختيار في المتصفح */
export function useTheme() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("suhub-theme");
    const initial: Mode =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setMode(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggle() {
    setMode((prev) => {
      const next: Mode = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem("suhub-theme", next);
      return next;
    });
  }

  return { mode, toggle };
}
