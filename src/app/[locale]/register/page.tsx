"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import Link from "next/link";

export default function Register() {
  const router = useRouter();
  const t = useTranslations("auth.register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError(t("agreeError"));
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("registrationFailed"));
      setLoading(false);
      return;
    }

    // Auto sign-in after registration
    await signIn("credentials", { email, password, redirect: false });
    router.push("/planner");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h1>
            <p className="text-gray-600">{t("subtitle")}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("nameLabel")}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("emailLabel")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("passwordLabel")}</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">{t("passwordHint")}</p>
            </div>
            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-600">
                  {t("agreeTerms")}{" "}
                  <Link href="/terms" className="text-teal-700 hover:underline">{t("termsOfService")}</Link>
                  {" "}{t("and")}{" "}
                  <Link href="/privacy" className="text-teal-700 hover:underline">{t("privacyPolicy")}</Link>
                </span>
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-60"
            >
              {loading ? t("creatingAccount") : t("createAccount")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {t("alreadyHaveAccount")}{" "}
              <Link href="/signin" className="text-teal-700 font-medium hover:text-teal-800">
                {t("signIn")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
