"use client";

import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex justify-center py-12 md:py-16">
      <SignUp signInUrl="/auth/login" redirectUrl="/dashboard" />
    </div>
  );
}

