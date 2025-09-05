import NextAuth, { type NextAuthOptions } from 'next-auth';

// Minimal NextAuth configuration; expand providers as needed
const options: NextAuthOptions = {
  providers: [],
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user = (token as any).user;
      }
      return session;
    }
  }
};

const handler = NextAuth(options);
export { handler as GET, handler as POST };
