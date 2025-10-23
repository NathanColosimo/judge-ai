import SignInForm from "@/components/sign-in-form";
import type { Route } from "./+types/signin";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sign In - AI Judge" },
    { name: "description", content: "Sign in to your AI Judge account" },
  ];
}

export default function SignIn() {
  return <SignInForm />;
}
