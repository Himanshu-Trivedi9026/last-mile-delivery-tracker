"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RateCard = {
  id: string;
  rate_type: "intra" | "inter";
  order_type: "B2B" | "B2C";
  base_rate: number;
  per_kg_rate: number;
  cod_surcharge: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  rate_type: "intra" | "inter";
  order_type: "B2B" | "B2C";
  base_rate: string;
  per_kg_rate: string;
  cod_surcharge: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  rate_type: "intra",
  order_type: "B2B",
  base_rate: "",
  per_kg_rate: "",
  cod_surcharge: "",
  is_active: true,
};

function formatCurrency(value: number) {
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RateCardsPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function loadRateCards() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/rate-cards", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load rate cards.");
      }

      setRateCards(data.rateCards ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load rate cards."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRateCards();
  }, []);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rateCards.filter((card) => {
      const matchesSearch =
        !query ||
        card.rate_type.toLowerCase().includes(query) ||
        card.order_type.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "all" ||
        card.rate_type === typeFilter;

      const matchesOrder =
        orderFilter === "all" ||
        card.order_type === orderFilter;

      return matchesSearch && matchesType && matchesOrder;
    });
  }, [rateCards, search, typeFilter, orderFilter]);

  const activeCount = rateCards.filter(
    (card) => card.is_active
  ).length;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(card: RateCard) {
    setEditingId(card.id);

    setForm({
      rate_type: card.rate_type,
      order_type: card.order_type,
      base_rate: String(card.base_rate),
      per_kg_rate: String(card.per_kg_rate),
      cod_surcharge: String(card.cod_surcharge),
      is_active: card.is_active,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveRateCard(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        rate_type: form.rate_type,
        order_type: form.order_type,
        base_rate: Number(form.base_rate),
        per_kg_rate: Number(form.per_kg_rate),
        cod_surcharge: Number(form.cod_surcharge),
        is_active: form.is_active,
      };

      const response = await fetch(
        editingId
          ? `/api/admin/rate-cards/${editingId}`
          : "/api/admin/rate-cards",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to save rate card."
        );
      }

      setSuccess(
        editingId
          ? "Rate card updated successfully."
          : "Rate card created successfully."
      );

      await loadRateCards();

      setTimeout(() => {
        closeForm();
      }, 500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save rate card."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(card: RateCard) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/admin/rate-cards/${card.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !card.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to update status."
        );
      }

      await loadRateCards();

      setSuccess(
        `Rate card ${
          !card.is_active ? "activated" : "deactivated"
        } successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update status."
      );
    }
  }

  async function deleteRateCard(card: RateCard) {
    const confirmed = window.confirm(
      `Delete the ${card.rate_type.toUpperCase()} / ${card.order_type} rate card?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/admin/rate-cards/${card.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to delete rate card."
        );
      }

      await loadRateCards();
      setSuccess("Rate card deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete rate card."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/dashboard/admin"
          className="text-sm font-semibold text-slate-600 hover:text-blue-600"
        >
          ← Back to Admin Dashboard
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Administration
            </div>

            <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-950">
              Rate Cards
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Configure delivery pricing for intra-zone and
              inter-zone shipments.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            + Create Rate Card
          </button>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Total Rate Cards
            </div>

            <div className="mt-2 text-4xl font-black text-slate-950">
              {rateCards.length}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Configured pricing rules
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Active
            </div>

            <div className="mt-2 text-4xl font-black text-emerald-600">
              {activeCount}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Currently used by order pricing
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Pricing Engine
            </div>

            <div className="mt-2 text-xl font-black text-blue-950">
              Zone + Weight
            </div>

            <p className="mt-1 text-sm text-blue-700">
              Base rate + chargeable weight × per-kg rate
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Configured Rate Cards
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Pricing rules used during order creation.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search rate cards..."
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All rate types</option>
                <option value="intra">Intra</option>
                <option value="inter">Inter</option>
              </select>

              <select
                value={orderFilter}
                onChange={(event) =>
                  setOrderFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All order types</option>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading rate cards...
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-lg font-bold text-slate-900">
                No rate cards found
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters or create a new rate
                card.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4">
                      Rate Type
                    </th>

                    <th className="px-5 py-4">
                      Order Type
                    </th>

                    <th className="px-5 py-4">
                      Base Rate
                    </th>

                    <th className="px-5 py-4">
                      Per KG
                    </th>

                    <th className="px-5 py-4">
                      COD
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4">
                      Created
                    </th>

                    <th className="px-5 py-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCards.map((card) => (
                    <tr
                      key={card.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-5">
                        <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase text-blue-700">
                          {card.rate_type}
                        </span>
                      </td>

                      <td className="px-5 py-5 font-bold text-slate-900">
                        {card.order_type}
                      </td>

                      <td className="px-5 py-5 font-semibold text-slate-700">
                        {formatCurrency(card.base_rate)}
                      </td>

                      <td className="px-5 py-5 font-semibold text-slate-700">
                        {formatCurrency(card.per_kg_rate)}
                      </td>

                      <td className="px-5 py-5 font-semibold text-slate-700">
                        {formatCurrency(card.cod_surcharge)}
                      </td>

                      <td className="px-5 py-5">
                        <button
                          type="button"
                          onClick={() =>
                            toggleActive(card)
                          }
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            card.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {card.is_active
                            ? "Active"
                            : "Inactive"}
                        </button>
                      </td>

                      <td className="px-5 py-5 text-sm text-slate-500">
                        {formatDate(card.created_at)}
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(card)
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteRateCard(card)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="font-bold text-amber-900">
            Pricing engine note
          </div>

          <p className="mt-1 text-sm text-amber-800">
            Active rate cards are automatically selected during
            order creation using the pickup/delivery zone type
            and B2B/B2C order type. COD surcharge is applied only
            to COD orders.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  {editingId
                    ? "Edit Rate Card"
                    : "Create Rate Card"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure delivery pricing.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="text-xl text-slate-400 hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveRateCard}
              className="space-y-5 p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Rate Type
                  </span>

                  <select
                    value={form.rate_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        rate_type:
                          event.target.value as
                            | "intra"
                            | "inter",
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="intra">
                      Intra — Same Zone
                    </option>

                    <option value="inter">
                      Inter — Different Zones
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Order Type
                  </span>

                  <select
                    value={form.order_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        order_type:
                          event.target.value as
                            | "B2B"
                            | "B2C",
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="B2B">
                      B2B
                    </option>

                    <option value="B2C">
                      B2C
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Base Rate
                  </span>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.base_rate}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        base_rate:
                          event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="50"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Per KG
                  </span>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.per_kg_rate}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        per_kg_rate:
                          event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="10"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    COD Surcharge
                  </span>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.cod_surcharge}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        cod_surcharge:
                          event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="40"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      is_active:
                        event.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />

                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Active rate card
                  </div>

                  <div className="text-xs text-slate-500">
                    Active cards can be selected by the pricing
                    engine.
                  </div>
                </div>
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  disabled={saving}
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Rate Card"
                    : "Create Rate Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
