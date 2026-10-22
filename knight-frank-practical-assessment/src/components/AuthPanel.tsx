"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthMode = "login" | "signup";
type AuthResponse = {
  message: string;
  redirect_to: string | null;
  full_name?: string | null;
  access_token?: string | null;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

function isAuthResponse(value: unknown): value is AuthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    "redirect_to" in value &&
    (typeof value.redirect_to === "string" || value.redirect_to === null) &&
    (!("access_token" in value) ||
      typeof value.access_token === "string" ||
      value.access_token === null)
  );
}

function getErrorMessage(
  status: number,
  payload: unknown,
  mode: AuthMode
): string {
  if (status === 401) {
    return "That password doesn’t match this account. Check your details and try again.";
  }

  if (status === 404) {
    return "We couldn’t find an account with that email. Sign up to create one.";
  }

  if (status === 409) {
    return "An account with this email already exists. Log in instead.";
  }

  if (status === 422) {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      Array.isArray(payload.detail)
    ) {
      const fields = payload.detail
        .map((issue: unknown) => {
          if (
            typeof issue !== "object" ||
            issue === null ||
            !("loc" in issue) ||
            !Array.isArray(issue.loc)
          ) {
            return "";
          }

          return issue.loc.join(".");
        })
        .join(" ");

      if (fields.includes("email")) {
        return "Enter a valid email address and try again.";
      }
      if (fields.includes("password")) {
        return "Your password must be between 8 and 128 characters.";
      }
      if (fields.includes("full_name")) {
        return "Enter a name of up to 150 characters.";
      }
    }

    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      payload.detail === "Full name cannot be blank."
    ) {
      return "Full name is required.";
    }

    return "Some of your details are invalid. Check the form and try again.";
  }

  if (status === 429) {
    return "There have been too many attempts. Please wait a moment and try again.";
  }

  if (status === 503) {
    return "The sign-in service is temporarily unavailable. Please try again shortly.";
  }

  if (status >= 500 && mode === "signup") {
    return "We couldn’t create your account right now. Please try again shortly.";
  }

  if (status >= 500) {
    return "We couldn’t sign you in right now. Please try again shortly.";
  }

  return "We couldn’t complete your request. Check your details and try again.";
}

export default function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrors({});
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (mode === "signup" && !name.trim()) {
      nextErrors.name = "Full name is required.";
    } else if (mode === "signup" && name.trim().length > 150) {
      nextErrors.name = "Full name must be 150 characters or fewer.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length > 128) {
      nextErrors.password = "Password must be 128 characters or fewer.";
    } else if (mode === "signup" && password.length < 8) {
      nextErrors.password = "Password must contain at least 8 characters.";
    }

    if (mode === "signup" && !confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (mode === "signup" && password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!validateForm()) return;

    setIsSubmitting(true);

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { full_name: name.trim(), email: email.trim(), password }
            : { email: email.trim(), password }
        ),
      });
    } catch {
      setMessage(
        "We couldn’t reach the sign-in service. Check your connection and try again."
      );
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(getErrorMessage(response.status, payload, mode));
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    if (!isAuthResponse(payload)) {
      setMessage(
        "We received an unexpected response. Please try again, and contact support if the problem continues."
      );
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup") {
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setMessage(payload.message);
      setMessageType("success");
      setIsSubmitting(false);
      return;
    }

    if (payload.redirect_to !== "/landing") {
      setMessage(
        "You’re signed in, but we couldn’t open your portal. Please try again."
      );
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    if (!payload.access_token) {
      setMessage(
        "We received an unexpected response. Please try again, and contact support if the problem continues."
      );
      setMessageType("error");
      setIsSubmitting(false);
      return;
    }

    if (payload.full_name) {
      sessionStorage.setItem("kf_user_name", payload.full_name);
    }

    sessionStorage.setItem("kf_user_email", email.trim());
    sessionStorage.setItem("kf_auth_token", payload.access_token);

    router.push("/landing");
  }

  return (
    <section className="auth-card" aria-label="Account access">
      <div className="auth-heading">
        <h3>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h3>
        <p>
          {mode === "login"
            ? "Sign in to continue to your assessment."
            : "Register to get started with your assessment."}
        </p>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          aria-pressed={mode === "login"}
          disabled={isSubmitting}
          onClick={() => changeMode("login")}
        >
          Log in
        </button>

        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          aria-pressed={mode === "signup"}
          disabled={isSubmitting}
          onClick={() => changeMode("signup")}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {mode === "signup" && (
          <div className="form-group">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              maxLength={150}
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p className="error" id="name-error">
                {errors.name}
              </p>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p className="error" id="email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            maxLength={128}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "password-error" : undefined
            }
          />
          {errors.password && (
            <p className="error" id="password-error">
              {errors.password}
            </p>
          )}
        </div>

        {mode === "signup" && (
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword
                  ? "confirm-password-error"
                  : undefined
              }
            />
            {errors.confirmPassword && (
              <p className="error" id="confirm-password-error">
                {errors.confirmPassword}
              </p>
            )}
          </div>
        )}

        <button
          className="submit-button"
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting
            ? "Please wait..."
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>

        {message && (
          <p
            className={`form-message ${messageType}`}
            role={messageType === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}
      </form>

      <p className="auth-footer">
        {mode === "login"
          ? "New here? "
          : "Already have an account? "}

        <button
          type="button"
          className="text-button"
          disabled={isSubmitting}
          onClick={() =>
            changeMode(mode === "login" ? "signup" : "login")
          }
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </section>
  );
}
