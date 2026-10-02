"use client";

import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator !== "undefined" && navigator.onLine);
  useEffect(() => {
    function handle() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", handle);
    window.addEventListener("offline", handle);
    return () => {
      window.removeEventListener("online", handle);
      window.removeEventListener("offline", handle);
    };
  }, []);
  return online;
}
