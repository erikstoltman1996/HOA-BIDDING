"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [status, setStatus] = useState<"idle" | "loading" | "check-email" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback`;

    if (mode === "password") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, org_name: orgName }, emailRedirectTo },
      });
      if (signUpError) {
        setStatus("error");
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        const { error: rpcError } = await supabase.rpc("create_org_and_admin", {
          p_org_name: orgName,
          p_admin_name: name,
        });
        if (rpcError) {
          setStatus("error");
          setError(rpcError.message);
          return;
        }
        router.push("/");
        return;
      }
      setStatus("check-email");
    } else {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { name, org_name: orgName },
          emailRedirectTo,
        },
      });
      if (otpError) {
        setStatus("error");
        setError(otpError.message);
        return;
      }
      setStatus("check-email");
    }
  }

  if (status === "check-email") {
    return (
      <div className="text-center text-sm text-ink">
        <p className="font-serif text-lg mb-2">Check your email</p>
        <p className="text-ink-soft">
          We sent a link to <span className="text-ink">{email}</span>. Click it to finish
          setting up {orgName || "your organization"}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName">HOA / organization name</Label>
        <Input
          id="orgName"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Elmhurst HOA"
        />
      </div>
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jordan Kim"
        />
      </div>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Creating…" : mode === "password" ? "Create account" : "Send magic link"}
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
        className="w-full text-center text-xs text-ink-soft hover:text-ink"
      >
        {mode === "password" ? "Use a magic link instead" : "Use a password instead"}
      </button>

      <p className="text-center text-xs text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
