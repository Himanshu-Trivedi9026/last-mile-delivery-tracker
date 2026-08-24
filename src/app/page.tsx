"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "admin" | "agent" | "customer";

export default function Home() {
  const router = useRouter();

  const [role, setRole] =
    useState<Role>("admin");

  const [isRegistering, setIsRegistering] =
    useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  // Registration fields
  const [fullName, setFullName] =
    useState("");
  const [phone, setPhone] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [remember, setRemember] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ============================================================
  // ROLE CHANGE
  // ============================================================

  function handleRoleChange(
    newRole: Role
  ) {
    setRole(newRole);

    setError("");
    setSuccess("");

    // Registration is available only for customers.
    if (newRole !== "customer") {
      setIsRegistering(false);
    }
  }

  // ============================================================
  // CUSTOMER REGISTRATION
  // ============================================================

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    // ----------------------------------------------------------
    // Client-side validation
    // ----------------------------------------------------------

    if (!fullName.trim()) {
      setError(
        "Full name is required."
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Email address is required."
      );
      return;
    }

    if (!phone.trim()) {
      setError(
        "Phone number is required."
      );
      return;
    }

    if (!password) {
      setError(
        "Password is required."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              fullName:
                fullName.trim(),

              email:
                email.trim(),

              password,

              phone:
                phone.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.error ||
            "Unable to create customer account."
        );

        return;
      }

      // --------------------------------------------------------
      // Registration successful
      // --------------------------------------------------------

      setSuccess(
        data.message ||
          "Account created successfully. You can now log in."
      );

      setPassword("");
      setConfirmPassword("");

      // Keep the registered email in the login form.
      // Clear personal registration fields.
      setFullName("");
      setPhone("");

      // Switch back to login after registration.
      setIsRegistering(false);
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setError(
        "Unable to connect to the registration server."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // ========================================================
      // 1. Login through our authentication API
      // ========================================================

      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

      const data =
        await response.json();

      // Login failed
      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.error ||
            "Authentication failed."
        );

        return;
      }

      // ========================================================
      // 2. Verify the authenticated session
      // ========================================================

      const meResponse =
        await fetch(
          "/api/auth/me",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const meData =
        await meResponse.json();

      if (
        !meResponse.ok ||
        !meData.success
      ) {
        setError(
          meData.error ||
            "Unable to load authenticated user profile."
        );

        return;
      }

      // ========================================================
      // 3. Get the ACTUAL role from Supabase
      // ========================================================

      const actualRole =
        meData.profile?.role;

      if (!actualRole) {
        setError(
          "User role could not be determined."
        );

        return;
      }

      // ========================================================
      // 4. Prevent role spoofing
      // ========================================================
      //
      // The role selected on the login page is only a UI
      // selection. The actual role comes from Supabase.
      //
      // This means a customer cannot select ADMIN and become
      // an administrator.
      //
      // ========================================================

      const selectedRole =
        role === "agent"
          ? "delivery_agent"
          : role;

      if (
        actualRole !== selectedRole
      ) {
        setError(
          `This account is registered as ${actualRole === "delivery_agent"
            ? "delivery agent"
            : actualRole
          }. Please select the correct login type.`
        );

        return;
      }

      // ========================================================
      // 5. Remember terminal preference
      // ========================================================

      if (remember) {
        localStorage.setItem(
          "logistics_remember",
          "true"
        );
      } else {
        localStorage.removeItem(
          "logistics_remember"
        );
      }

      // ========================================================
      // 6. Redirect according to the role stored in Supabase
      // ========================================================

      setSuccess(
        `Authentication successful as ${actualRole}. Redirecting...`
      );

      if (
        actualRole ===
        "delivery_agent"
      ) {
        router.push(
          "/dashboard/agent"
        );

        return;
      }

      if (
        actualRole ===
        "customer"
      ) {
        router.push(
          "/dashboard/customer"
        );

        return;
      }

      if (
        actualRole ===
        "admin"
      ) {
        router.push(
          "/dashboard/admin"
        );

        return;
      }

      // Unknown role
      setError(
        `Unknown user role: ${actualRole}`
      );
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        "Unable to connect to the authentication server."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // SWITCH LOGIN / REGISTRATION
  // ============================================================

  function openRegistration() {
    setRole("customer");
    setIsRegistering(true);

    setError("");
    setSuccess("");

    setPassword("");
    setConfirmPassword("");
  }

  function openLogin() {
    setIsRegistering(false);

    setError("");
    setSuccess("");

    setPassword("");
    setConfirmPassword("");
  }

  // ============================================================
  // UI
  // ============================================================

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
              <span className="shipping-icon">
                🚚
              </span>
            </div>

            <h1>
              LogisticsPro
            </h1>

            <p>
              {isRegistering
                ? "Create Customer Account"
                : "Secure Terminal Access"}
            </p>
          </div>

          {/* ======================================================
              Role Selector
          ====================================================== */}

          <div className="role-selector">

            <div
              className="role-indicator"
              style={{
                transform: `translateX(${
                  [
                    "admin",
                    "agent",
                    "customer",
                  ].indexOf(role) *
                  100
                }%)`,
              }}
            />

            <button
              type="button"
              className={`role-button ${
                role === "admin"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleRoleChange(
                  "admin"
                )
              }
              disabled={
                isRegistering
              }
            >
              ADMIN
            </button>

            <button
              type="button"
              className={`role-button ${
                role === "agent"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleRoleChange(
                  "agent"
                )
              }
              disabled={
                isRegistering
              }
            >
              AGENT
            </button>

            <button
              type="button"
              className={`role-button ${
                role === "customer"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleRoleChange(
                  "customer"
                )
              }
            >
              CLIENT
            </button>
          </div>

          {/* ======================================================
              Registration Form
          ====================================================== */}

          {isRegistering ? (
            <form
              className="login-form"
              onSubmit={
                handleRegister
              }
            >

              {/* Full Name */}
              <div className="field-group">
                <label htmlFor="fullName">
                  Full Name
                </label>

                <div className="input-wrapper">
                  <span className="input-icon">
                    ◉
                  </span>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(
                      event
                    ) =>
                      setFullName(
                        event.target.value
                      )
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="field-group">
                <label htmlFor="register-email">
                  Email Address
                </label>

                <div className="input-wrapper">
                  <span className="input-icon">
                    ◉
                  </span>

                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    placeholder="customer@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="field-group">
                <label htmlFor="phone">
                  Phone Number
                </label>

                <div className="input-wrapper">
                  <span className="input-icon">
                    ☎
                  </span>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(
                      event
                    ) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    placeholder="Enter your phone number"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="field-group">
                <label htmlFor="register-password">
                  Password
                </label>

                <div className="input-wrapper">
                  <span className="input-icon">
                    ◆
                  </span>

                  <input
                    id="register-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Create a password"
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (value) =>
                          !value
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword
                      ? "◉"
                      : "◌"}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="field-group">
                <label htmlFor="confirm-password">
                  Confirm Password
                </label>

                <div className="input-wrapper">
                  <span className="input-icon">
                    ◆
                  </span>

                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        (value) =>
                          !value
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirmPassword
                      ? "◉"
                      : "◌"}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="message error-message">
                  <strong>
                    Registration Failed
                  </strong>

                  <span>
                    {error}
                  </span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="message success-message">
                  <strong>
                    Registration Successful
                  </strong>

                  <span>
                    {success}
                  </span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="authenticate-button"
                disabled={
                  loading
                }
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Customer Account
                    <span className="arrow">
                      →
                    </span>
                  </>
                )}
              </button>

              {/* Back to Login */}
              <div className="options-row">
                <span>
                  Already have an account?
                </span>

                <button
                  type="button"
                  className="recover-button"
                  onClick={
                    openLogin
                  }
                >
                  Sign In
                </button>
              </div>
            </form>
          ) : (
            /* ====================================================
               Login Form
            ==================================================== */

            <form
              className="login-form"
              onSubmit={
                handleLogin
              }
            >

              {/* Email */}
              <div className="field-group">
                <label htmlFor="email">
                  Operator ID / Email
                </label>

                <div className="input-wrapper">
                  <span className="input-icon">
                    ◉
                  </span>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target.value
                      )
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
                  <span className="input-icon">
                    ◆
                  </span>

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target.value
                      )
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
                        (value) =>
                          !value
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword
                      ? "◉"
                      : "◌"}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="message error-message">
                  <strong>
                    Authentication Failed
                  </strong>

                  <span>
                    {error}
                  </span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="message success-message">
                  <strong>
                    Authentication Successful
                  </strong>

                  <span>
                    {success}
                  </span>
                </div>
              )}

              {/* Options */}
              <div className="options-row">

                <label className="remember-option">
                  <input
                    type="checkbox"
                    checked={
                      remember
                    }
                    onChange={(
                      event
                    ) =>
                      setRemember(
                        event.target
                          .checked
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

              {/* Submit Button */}
              <button
                type="submit"
                className="authenticate-button"
                disabled={
                  loading
                }
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

              {/* Customer Registration */}
              {role ===
                "customer" && (
                <div
                  className="options-row"
                  style={{
                    justifyContent:
                      "center",
                    marginTop:
                      "12px",
                  }}
                >
                  <span>
                    New customer?
                  </span>

                  <button
                    type="button"
                    className="recover-button"
                    onClick={
                      openRegistration
                    }
                  >
                    Create Account
                  </button>
                </div>
              )}
            </form>
          )}

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