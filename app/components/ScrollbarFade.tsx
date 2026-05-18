"use client";
import { useEffect } from "react";

export default function ScrollbarFade() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const show = () => {
      document.documentElement.classList.add("is-scrolling");
      clearTimeout(timer);
      timer = setTimeout(() => {
        document.documentElement.classList.remove("is-scrolling");
      }, 1000);
    };

    // Capture phase catches scroll from every nested scrollable element
    window.addEventListener("scroll", show, { passive: true, capture: true });

    return () => {
      window.removeEventListener("scroll", show, { capture: true });
      clearTimeout(timer);
    };
  }, []);

  return null;
}
