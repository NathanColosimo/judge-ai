import SignUpForm from "@/components/sign-up-form";
import type { Route } from "./+types/signup";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sign Up - AI Judge" },
    { name: "description", content: "Create your AI Judge account" },
  ];
}

export default function SignUp() {
  return <SignUpForm />;
}
