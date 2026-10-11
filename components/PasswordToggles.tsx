"use client";

import { useEffect } from "react";

/**
 * Port of public/assets/js/auth.js — delegated click handler for every
 * `.toggle-password` button (the PHP markup renders them without inline JS).
 */
export default function PasswordToggles() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>(".toggle-password");
      if (!btn) return;
      const input = document.getElementById(btn.getAttribute("data-target") ?? "") as HTMLInputElement | null;
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        btn.innerHTML = '<i class="fa fa-eye-slash"></i>';
      } else {
        input.type = "password";
        btn.innerHTML = '<i class="fa fa-eye"></i>';
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
