"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Zone = {
  id: string;
  name: string;
};

type ZoneResponse = {
  success: boolean;
  zones?: Zone[];
  error?: string;
};

export default function CreateAgentPage() {
  const router = useRouter();

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [zoneId, setZoneId] =
    useState("");

  const [isAvailable, setIsAvailable] =
    useState(true);

  const [zones, setZones] =
    useState<Zone[]>([]);

  const [loadingZones, setLoadingZones] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  // ============================================================
  // Load zones
  // ============================================================

  useEffect(() => {
    async function loadZones() {
      try {
        setLoadingZones(true);

        const response =
          await fetch(
            "/api/admin/zones",
            {
              cache: "no-store",
            }
          );

        const data: ZoneResponse =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Failed to load zones."
          );
        }

        setZones(
          data.zones ?? []
        );
      } catch (err) {
        console.error(
          "Load zones error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load zones."
        );
      } finally {
        setLoadingZones(false);
      }
    }

    loadZones();
  }, []);

  // ============================================================
  // Submit
  // ============================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!fullName.trim()) {
      setError(
        "Full name is required."
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Email is required."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (!phone.trim()) {
      setError(
        "Phone number is required."
      );
      return;
    }

    try {
      setSaving(true);

      const response =
        await fetch(
          "/api/admin/agents",
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

              zoneId:
                zoneId || null,

              isAvailable,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Failed to create delivery agent."
        );
      }

      router.push(
        "/dashboard/admin/agents"
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Create agent error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create delivery agent."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">

        {/* Back */}
        <Link
          href="/dashboard/admin/agents"
          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          ← Back to Delivery Agents
        </Link>

        {/* Header */}
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Administration
          </div>

          <h1 className="mt-2 text-4xl font-black text-slate-950">
            Add Delivery Agent
          </h1>

          <p className="mt-3 text-slate-600">
            Create a new delivery-agent account
            and configure its availability and zone.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">

            {/* Full Name */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Full Name
              </label>

              <input
                type="text"
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value
                  )
                }
                placeholder="Enter full name"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Phone Number
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value
                  )
                }
                placeholder="9876543210"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="agent@example.com"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Initial Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Minimum 6 characters"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Zone */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Delivery Zone
              </label>

              <select
                value={zoneId}
                onChange={(event) =>
                  setZoneId(
                    event.target.value
                  )
                }
                disabled={loadingZones}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">
                  {loadingZones
                    ? "Loading zones..."
                    : "Select a zone"}
                </option>

                {zones.map((zone) => (
                  <option
                    key={zone.id}
                    value={zone.id}
                  >
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Initial Availability
              </label>

              <label className="mt-3 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(event) =>
                    setIsAvailable(
                      event.target.checked
                    )
                  }
                  className="h-5 w-5 rounded border-slate-300"
                />

                <span className="text-sm text-slate-600">
                  Agent is available for assignment
                </span>
              </label>
            </div>
          </div>

          {/* Info */}
          <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            The agent will receive a Supabase
            authentication account. The profile
            will automatically be created by your
            existing database trigger.
          </div>

          {/* Buttons */}
          <div className="mt-8 flex justify-end gap-3">

            <Link
              href="/dashboard/admin/agents"
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Creating..."
                : "Create Agent"}
            </button>

          </div>
        </form>
      </div>
    </main>
  );
}
