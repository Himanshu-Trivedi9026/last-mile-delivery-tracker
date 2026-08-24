"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Agent = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  zone_id: string | null;
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  created_at: string;
  updated_at: string;
  assigned_order_count: number;
};

export default function DeliveryAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadAgents() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/agents", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load delivery agents."
        );
      }

      setAgents(data.agents ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load delivery agents."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return agents;
    }

    return agents.filter((agent) => {
      return (
        agent.full_name
          .toLowerCase()
          .includes(query) ||
        (agent.phone ?? "")
          .toLowerCase()
          .includes(query) ||
        (agent.zone_id ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [agents, search]);

  const totalAgents = agents.length;

  const availableAgents = agents.filter(
    (agent) => agent.is_available
  ).length;

  const busyAgents = agents.filter(
    (agent) =>
      !agent.is_available &&
      agent.assigned_order_count > 0
  ).length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/dashboard/admin"
              className="text-sm font-medium text-slate-600 hover:text-blue-600"
            >
              ← Back to Admin Dashboard
            </Link>

            <div className="mt-7 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-sm">
                A
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                  Administration
                </div>

                <h1 className="text-4xl font-black tracking-tight text-slate-950">
                  Delivery Agents
                </h1>
              </div>
            </div>

            <p className="mt-4 text-base text-slate-600">
              Manage delivery agents, availability, zones, and
              assigned deliveries.
            </p>
          </div>

          <Link
  href="/dashboard/admin/agents/create"
  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
>
  + Add Agent
</Link>
        </div>

        {/* Statistics */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Total Agents
            </div>

            <div className="mt-3 text-4xl font-black text-slate-950">
              {loading ? "—" : totalAgents}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Registered delivery agents
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Available
            </div>

            <div className="mt-3 text-4xl font-black text-emerald-600">
              {loading ? "—" : availableAgents}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Currently available for assignment
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Busy
            </div>

            <div className="mt-3 text-4xl font-black text-orange-500">
              {loading ? "—" : busyAgents}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Agents with assigned deliveries
            </div>
          </div>
        </div>

        {/* Agents table */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Registered Delivery Agents
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Agents available for order assignment and delivery
                operations.
              </p>
            </div>

            <div>
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search agents..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
              />
            </div>
          </div>

          {error && (
            <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Agent
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Phone
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Zone
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Deliveries
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      Loading delivery agents...
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center"
                    >
                      <div className="text-base font-bold text-slate-900">
                        No delivery agents found
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        Try changing your search.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      {/* Agent */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-600">
                            {agent.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div className="font-bold text-slate-950">
                              {agent.full_name}
                            </div>

                            <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                              {agent.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {agent.phone || "—"}
                      </td>

                      {/* Zone */}
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {agent.zone_id ? (
                          <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {agent.zone_id}
                          </span>
                        ) : (
                          "Unassigned"
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        {agent.is_available ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            Unavailable
                          </span>
                        )}
                      </td>

                      {/* Orders */}
                      <td className="px-6 py-5">
                        <span className="font-bold text-slate-900">
                          {agent.assigned_order_count}
                        </span>

                        <span className="ml-1 text-sm text-slate-500">
                          assigned
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 text-right">
                        <Link
  href={`/dashboard/admin/agents/${agent.id}`}
  className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
>
  View
</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Information */}
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              i
            </div>

            <div>
              <div className="font-bold text-blue-900">
                Delivery agent management
              </div>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Available delivery agents can be automatically
                selected during order creation. Administrators can
                also manually assign pending orders to specific
                delivery agents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}