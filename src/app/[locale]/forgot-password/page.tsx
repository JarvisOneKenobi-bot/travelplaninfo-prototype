"use client";

import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import Link from "next/link";

export default function ForgotPassword() {
  const t = useTranslations("auth.forgotPassword");
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("title")}</h1>
          <p className="text-gray-600 mb-6">
            {t("message")}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/signin"
              className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors text-center"
            >
              {t("backToSignIn")}
            </Link>
            <Link
              href="/register"
              className="w-full border border-teal-700 text-teal-700 py-3 rounded-lg font-medium hover:bg-teal-50 transition-colors text-center"
            >
              {t("createNewAccount")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
