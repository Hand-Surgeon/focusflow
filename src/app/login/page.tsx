import { Suspense } from "react";
import { LoginClient } from "./login-client";

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" />
      }
    >
      <LoginClient />
    </Suspense>
  );
}
