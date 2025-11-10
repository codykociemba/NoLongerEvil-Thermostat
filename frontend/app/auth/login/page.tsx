"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex justify-center py-12 md:py-16">
      <SignIn signUpUrl="/auth/register" redirectUrl="/dashboard" />
    </div>
  );
}

