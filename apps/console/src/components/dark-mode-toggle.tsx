"use client";

import { useEffect, useState } from "react";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("agentmesh-dark");
    if (saved === "true") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem("agentmesh-dark", String(newDark));
    if (newDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  return (
    <button onClick={toggle} className="modern-mono text-[10px] border border-black/10 rounded-full px-3 py-1.5 hover:bg-black hover:text-white transition-colors">
      {isDark ? "LIGHT • ☀" : "DARK • ◐"} • {isDark ? "ON" : "OFF"}
    </button>
  );
}
