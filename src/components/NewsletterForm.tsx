"use client";

import { useState } from "react";

export default function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "duplicate">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source }),
    });

    if (res.status === 201) {
      setStatus("success");
      setEmail("");
      return;
    }

    if (res.status === 409) {
      setStatus("duplicate");
      return;
    }

    setStatus("error");
  }

  if (status === "success") {
    return (
      <p className="text-white font-medium py-3">
        ✓ You are subscribed! Thanks for joining.
      </p>
    );
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          disabled={status === "loading"}
          className="flex-1 px-4 py-3 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "..." : "Subscribe"}
        </button>
      </form>
      {status === "duplicate" && (
        <p className="mt-2 text-xs text-teal-200 text-center">
          You are already subscribed!
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-xs text-red-300 text-center">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
