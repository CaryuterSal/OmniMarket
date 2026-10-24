import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "mock-github-id",
      clientSecret: process.env.GITHUB_SECRET || "mock-github-secret",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
      }
      if (profile && !token.picture && "avatar_url" in profile) {
        token.picture = profile.avatar_url as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { provider?: string }).provider =
          (token.provider as string) || "oauth";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret:
    process.env.NEXTAUTH_SECRET ||
    "omnimarket-super-secret-hackathon-key-2026",
};
