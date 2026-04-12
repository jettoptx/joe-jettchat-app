import { Suspense } from "react";
import { LoginContent } from "./login-content";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-black" />}>
      <LoginContent />
    </Suspense>
  );
}
