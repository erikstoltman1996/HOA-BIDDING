"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/project";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const supabase = createClient();

    if (mode === "password") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setStatus("error");
        setError(signInError.message);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (otpError) {
      setStatus("error");
      setError(otpError.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="text-center text-sm text-ink">
        <p className="font-serif text-lg mb-2">Check your email</p>
        <p className="text-ink-soft">
          We sent a login link to <span className="text-ink">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
      </div>
      {mode === "password" && (
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "…" : mode === "password" ? "Log in" : "Send magic link"}
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
        className="w-full text-center text-xs text-ink-soft hover:text-ink"
      >
        {mode === "password" ? "Use a magic link instead" : "Use a password instead"}
      </button>

      <p className="text-center text-xs text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="text-ink underline">
          Create an organization
        </Link>
      </p>
    </form>
  );
}
