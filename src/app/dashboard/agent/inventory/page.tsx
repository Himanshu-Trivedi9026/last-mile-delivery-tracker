"use client";

import { useEffect, useState } from "react";

interface InventoryItem {
  id: string;
  order_id: string;
  package_type: string;
  weight: number;
  current_location: string;
  status: string;
  assigned_agent_id: string | null;
  created_at: string;
}

export default function AgentInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/inventory");

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load inventory"
        );
      }

      setInventory(data.inventory || []);
    } catch (err) {
      console.error("Inventory fetch error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load inventory"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
            Delivery Operations
          </p>

          <div className="mt-1 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Inventory
              </h1>

              <p className="mt-1 text-slate-500">
                Manage packages assigned to you.
              </p>
            </div>

            <button
              onClick={fetchInventory}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <p className="text-slate-500">
              Loading inventory...
            </p>
          </div>
        ) : inventory.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <div className="mb-3 text-4xl">📦</div>

            <h2 className="text-lg font-semibold text-slate-900">
              No inventory found
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              There are currently no packages assigned to you.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Package
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Order ID
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Weight
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {inventory.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {item.package_type}
                        </div>

                        <div className="text-xs text-slate-400">
                          {item.id}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {item.order_id}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {item.weight} kg
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {item.current_location}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}