import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = getDb();
        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(credentials.email) as any;

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        return { id: String(user.id), email: user.email, name: user.name };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const db = getDb();
        const existing = db
          .prepare("SELECT id FROM users WHERE email = ?")
          .get(user.email) as any;
        if (!existing) {
          db.prepare(
            "INSERT INTO users (email, name, provider) VALUES (?, ?, 'google')"
          ).run(user.email, user.name);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const db = getDb();
        const dbUser = db
          .prepare("SELECT id FROM users WHERE email = ?")
          .get(token.email) as any;
        if (dbUser) token.userId = String(dbUser.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },

  pages: {
    signIn: "/signin",
    newUser: "/register",
  },

  session: { strategy: "jwt" },
});
