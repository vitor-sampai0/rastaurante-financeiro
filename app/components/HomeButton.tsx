"use client";

import { useRouter } from "next/navigation";

export default function HomeButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="home-button"
      onClick={() => router.push("/dashboard")}
    >
      ← Início
    </button>
  );
}
