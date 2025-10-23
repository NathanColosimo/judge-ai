import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import Loader from "./loader";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const MIN_PASSWORD_LENGTH = 8;

// Define validation schema
const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters"),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpForm() {
  const navigate = useNavigate();
  const { isPending: isSessionPending } = authClient.useSession();

  // Initialize react-hook-form with zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: SignUpFormData) => {
    await authClient.signUp.email(
      {
        email: data.email,
        password: data.password,
        name: data.name,
      },
      {
        onSuccess: () => {
          navigate("/dashboard");
          toast.success("Sign up successful");
        },
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      }
    );
  };

  if (isSessionPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">
            Create Account
          </CardTitle>
          <CardDescription className="text-center">
            Get started with AI Judge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                type="text"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="you@example.com"
                type="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit button */}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => navigate("/signin")} variant="link">
            Already have an account? Sign In
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
