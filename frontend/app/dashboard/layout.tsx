import { ReactNode } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { ensureConvexUser } from "@/lib/server/convex";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await currentUser();
  if (user) {
    const userId = user.id;
    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      "";

    try {
      await ensureConvexUser(userId, email);
    } catch (error) {
      console.error(
        "[DashboardLayout] ensureConvexUser failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return <>{children}</>;
}
