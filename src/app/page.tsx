"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "admin" | "agent" | "customer";

export default function Home() {
  const router = useRouter();

  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // ============================================================
      // 1. Login through our authentication API
      // ============================================================

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      // Login failed
      if (!response.ok || !data.success) {
        setError(data.error || "Authentication failed.");
        return;
      }

      // ============================================================
      // 2. Verify the authenticated session
      // ============================================================

      const meResponse = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
      });

      const meData = await meResponse.json();

      if (!meResponse.ok || !meData.success) {
        setError(
          meData.error || "Unable to load authenticated user profile."
        );
        return;
      }

      // ============================================================
      // 3. Get the ACTUAL role from Supabase
      // ============================================================

      const actualRole = meData.profile?.role;

      if (!actualRole) {
        setError("User role could not be determined.");
        return;
      }

      // ============================================================
      // 4. Remember terminal preference
      // ============================================================

      if (remember) {
        localStorage.setItem("logistics_remember", "true");
      } else {
        localStorage.removeItem("logistics_remember");
      }

      // ============================================================
      // 5. Redirect according to the role stored in Supabase
      // ============================================================

      setSuccess(
        `Authentication successful as ${actualRole}. Redirecting...`
      );

      if (actualRole === "delivery_agent") {
        router.push("/dashboard/agent");
        return;
      }

      if (actualRole === "customer") {
        router.push("/dashboard/customer");
        return;
      }

      if (actualRole === "admin") {
        router.push("/dashboard/admin");
        return;
      }

      // Unknown role
      setError(`Unknown user role: ${actualRole}`);
    } catch (error) {
      console.error("Login error:", error);

      setError(
        "Unable to connect to the authentication server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      {/* Background pattern */}
      <div className="login-grid" />

      {/* Logistics background */}
      <div className="login-map" />

      <section className="login-container">
        <div className="glass-card">

          {/* ======================================================
              Branding
          ====================================================== */}

          <div className="branding">
            <div className="logo-box">
              <span className="shipping-icon">🚚</span>
            </div>

            <h1>LogisticsPro</h1>

            <p>Secure Terminal Access</p>
          </div>

          {/* ======================================================
              Role Selector
          ====================================================== */}

          <div className="role-selector">

            <div
              className="role-indicator"
              style={{
                transform: `translateX(${
                  ["admin", "agent", "customer"].indexOf(role) * 100
                }%)`,
              }}
            />

            <button
              type="button"
              className={`role-button ${
                role === "admin" ? "active" : ""
              }`}
              onClick={() => setRole("admin")}
            >
              ADMIN
            </button>

            <button
              type="button"
              className={`role-button ${
                role === "agent" ? "active" : ""
              }`}
              onClick={() => setRole("agent")}
            >
              AGENT
            </button>

            <button
              type="button"
              className={`role-button ${
                role === "customer" ? "active" : ""
              }`}
              onClick={() => setRole("customer")}
            >
              CLIENT
            </button>
          </div>

          {/* ======================================================
              Login Form
          ====================================================== */}

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >

            {/* Email */}
            <div className="field-group">
              <label htmlFor="email">
                Operator ID / Email
              </label>

              <div className="input-wrapper">
                <span className="input-icon">◉</span>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="user@logisticspro.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label htmlFor="password">
                Security Key
              </label>

              <div className="input-wrapper">
                <span className="input-icon">◆</span>

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "◉" : "◌"}
                </button>
              </div>
            </div>

            {/* ==================================================
                Error Message
            ================================================== */}

            {error && (
              <div className="message error-message">
                <strong>
                  Authentication Failed
                </strong>

                <span>{error}</span>
              </div>
            )}

            {/* ==================================================
                Success Message
            ================================================== */}

            {success && (
              <div className="message success-message">
                <strong>
                  Authentication Successful
                </strong>

                <span>{success}</span>
              </div>
            )}

            {/* ==================================================
                Options
            ================================================== */}

            <div className="options-row">

              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) =>
                    setRemember(
                      event.target.checked
                    )
                  }
                />

                <span>
                  Remember terminal
                </span>
              </label>

              <button
                type="button"
                className="recover-button"
                onClick={() => {
                  setError(
                    "Access recovery will be implemented in a later step."
                  );
                }}
              >
                Recover Access
              </button>
            </div>

            {/* ==================================================
                Submit Button
            ================================================== */}

            <button
              type="submit"
              className="authenticate-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Authenticating...
                </>
              ) : (
                <>
                  Authenticate
                  <span className="arrow">
                    →
                  </span>
                </>
              )}
            </button>
          </form>

          {/* ======================================================
              Footer
          ====================================================== */}

          <div className="login-footer">
            <p>
              System requires dual-factor authentication.
              <br />

              Need assistance?{" "}

              <button
                type="button"
                onClick={() =>
                  setError(
                    "Dispatch Command support will be connected later."
                  )
                }
              >
                Contact Dispatch Command
              </button>
              .
            </p>
          </div>

        </div>
      </section>
    </main>
  );
}