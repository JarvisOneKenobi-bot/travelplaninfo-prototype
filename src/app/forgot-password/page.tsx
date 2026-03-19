"use client";

import Header from "@/components/Header";
import Link from "next/link";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Password reset unavailable</h1>
          <p className="text-gray-600 mb-6">
            Password reset is not yet available. Please register a new account or sign in with Google.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/signin"
              className="w-full bg-teal-700 text-white py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors text-center"
            >
              Back to Sign In
            </Link>
            <Link
              href="/register"
              className="w-full border border-teal-700 text-teal-700 py-3 rounded-lg font-medium hover:bg-teal-50 transition-colors text-center"
            >
              Create New Account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
