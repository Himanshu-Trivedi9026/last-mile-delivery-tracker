"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  zones?: Zone[];
  zone?: Zone;
};

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [editingZone, setEditingZone] =
    useState<Zone | null>(null);

  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] =
    useState("");

  const [search, setSearch] = useState("");

  // ============================================================
  // LOAD ZONES
  // ============================================================

  const loadZones = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/zones",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to load delivery zones."
        );
      }

      setZones(
        Array.isArray(data.zones)
          ? data.zones
          : []
      );
    } catch (err) {
      console.error(
        "Load zones error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load delivery zones."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  // ============================================================
  // RESET FORM
  // ============================================================

  function resetForm() {
    setZoneName("");
    setZoneDescription("");
    setEditingZone(null);
    setShowForm(false);
  }

  // ============================================================
  // OPEN CREATE FORM
  // ============================================================

  function openCreateForm() {
    setError("");
    setSuccess("");

    setEditingZone(null);
    setZoneName("");
    setZoneDescription("");

    setShowForm(true);
  }

  // ============================================================
  // OPEN EDIT FORM
  // ============================================================

  function openEditForm(zone: Zone) {
    setError("");
    setSuccess("");

    setEditingZone(zone);

    setZoneName(zone.name);
    setZoneDescription(
      zone.description ?? ""
    );

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ============================================================
  // CREATE / UPDATE ZONE
  // ============================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const trimmedName =
      zoneName.trim();

    const trimmedDescription =
      zoneDescription.trim();

    if (!trimmedName) {
      setError(
        "Zone name is required."
      );
      return;
    }

    if (trimmedName.length > 100) {
      setError(
        "Zone name must be 100 characters or less."
      );
      return;
    }

    if (
      trimmedDescription.length >
      500
    ) {
      setError(
        "Zone description must be 500 characters or less."
      );
      return;
    }

    try {
      setSaving(true);

      const isEditing =
        Boolean(editingZone);

      const url = isEditing
        ? `/api/admin/zones/${editingZone!.id}`
        : "/api/admin/zones";

      const method = isEditing
        ? "PUT"
        : "POST";

      const response = await fetch(
        url,
        {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            description:
              trimmedDescription || null,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            (isEditing
              ? "Failed to update zone."
              : "Failed to create zone.")
        );
      }

      setSuccess(
        isEditing
          ? "Zone updated successfully."
          : "Zone created successfully."
      );

      resetForm();

      await loadZones();
    } catch (err) {
      console.error(
        "Save zone error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save zone."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // DELETE ZONE
  // ============================================================

  async function handleDelete(
    zone: Zone
  ) {
    setError("");
    setSuccess("");

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${zone.name}"?\n\nThis should only be done if the zone is not being used by delivery areas.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(zone.id);

      const response =
        await fetch(
          `/api/admin/zones/${zone.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Failed to delete zone."
        );
      }

      setSuccess(
        "Zone deleted successfully."
      );

      await loadZones();
    } catch (err) {
      console.error(
        "Delete zone error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete zone."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ============================================================
  // FILTER
  // ============================================================

  const normalizedSearch =
    search.trim().toLowerCase();

  const filteredZones =
    zones.filter((zone) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        zone.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (
          zone.description ?? ""
        )
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div>
            <button
              type="button"
              onClick={() =>
                window.history.back()
              }
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600"
            >
              ← Back
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-600/20">
                Z
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                  Administration
                </p>

                <h1 className="text-3xl font-black tracking-tight text-slate-950">
                  Delivery Zones
                </h1>
              </div>
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Manage the delivery zones used by
              the order routing and pricing
              engine.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <span className="text-lg">
              +
            </span>

            Create Zone
          </button>
        </div>

        {/* =====================================================
            ALERTS
        ===================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold">
              !
            </div>

            <div>
              <p className="font-bold">
                Action failed
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-auto text-lg font-bold text-red-500 hover:text-red-700"
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold">
              ✓
            </div>

            <div>
              <p className="font-bold">
                Success
              </p>

              <p className="mt-1">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="ml-auto text-lg font-bold text-emerald-500 hover:text-emerald-700"
              aria-label="Close success message"
            >
              ×
            </button>
          </div>
        )}

        {/* =====================================================
            CREATE / EDIT FORM
        ===================================================== */}

        {showForm && (
          <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Zone Configuration
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {editingZone
                      ? "Edit Delivery Zone"
                      : "Create Delivery Zone"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editingZone
                      ? "Update the zone information."
                      : "Add a new delivery zone to the system."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8"
            >
              <div className="grid gap-6 md:grid-cols-2">

                {/* NAME */}

                <div>
                  <label
                    htmlFor="zone-name"
                    className="mb-2 block text-sm font-bold text-slate-800"
                  >
                    Zone Name
                  </label>

                  <input
                    id="zone-name"
                    type="text"
                    value={zoneName}
                    onChange={(event) =>
                      setZoneName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Bhopal Central"
                    maxLength={100}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    {zoneName.length}/100
                    characters
                  </p>
                </div>

                {/* DESCRIPTION */}

                <div>
                  <label
                    htmlFor="zone-description"
                    className="mb-2 block text-sm font-bold text-slate-800"
                  >
                    Description
                  </label>

                  <input
                    id="zone-description"
                    type="text"
                    value={zoneDescription}
                    onChange={(event) =>
                      setZoneDescription(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Central Bhopal delivery zone"
                    maxLength={500}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    {zoneDescription.length}/500
                    characters
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !zoneName.trim()
                  }
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingZone
                      ? "Update Zone"
                      : "Create Zone"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Zones
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950">
              {zones.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Configured delivery zones
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Visible
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950">
              {filteredZones.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Zones matching your search
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
              Routing
            </p>

            <p className="mt-2 text-lg font-black text-blue-900">
              Zone-based
            </p>

            <p className="mt-1 text-sm text-blue-700">
              Used by order zone detection
            </p>
          </div>
        </section>

        {/* =====================================================
            ZONE LIST
        ===================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* LIST HEADER */}

          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <h2 className="text-xl font-black text-slate-950">
                Configured Zones
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Create, update, or remove delivery zones.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search zones..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="px-6 py-20 text-center sm:px-8">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Loading delivery zones...
              </p>
            </div>
          ) : filteredZones.length ===
            0 ? (
            <div className="px-6 py-20 text-center sm:px-8">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-black text-slate-400">
                Z
              </div>

              <h3 className="mt-5 text-lg font-black text-slate-900">
                {zones.length === 0
                  ? "No delivery zones yet"
                  : "No matching zones"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {zones.length === 0
                  ? "Create your first delivery zone to start configuring the delivery network."
                  : "Try a different search term."}
              </p>

              {zones.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Create First Zone
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 sm:px-8">
                        Zone
                      </th>

                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                        Description
                      </th>

                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                        Created
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredZones.map(
                      (zone) => (
                        <tr
                          key={zone.id}
                          className="border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-5 sm:px-8">
                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-600">
                                Z
                              </div>

                              <div>
                                <p className="font-bold text-slate-900">
                                  {zone.name}
                                </p>

                                <p className="mt-1 max-w-xs truncate font-mono text-[11px] text-slate-400">
                                  {zone.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <p className="max-w-md text-sm text-slate-600">
                              {zone.description ||
                                "No description provided."}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-slate-500">
                            {formatDate(
                              zone.created_at
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditForm(
                                    zone
                                  )
                                }
                                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    zone
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  zone.id
                                }
                                className="rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId ===
                                zone.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}

              <div className="divide-y divide-slate-100 md:hidden">
                {filteredZones.map(
                  (zone) => (
                    <div
                      key={zone.id}
                      className="p-5"
                    >
                      <div className="flex items-start gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-600">
                          Z
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-slate-900">
                            {zone.name}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {zone.description ||
                              "No description provided."}
                          </p>

                          <p className="mt-3 text-xs font-medium text-slate-400">
                            Created{" "}
                            {formatDate(
                              zone.created_at
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEditForm(
                              zone
                            )
                          }
                          className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              zone
                            )
                          }
                          disabled={
                            deletingId ===
                            zone.id
                          }
                          className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId ===
                          zone.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </section>

        {/* =====================================================
            INFORMATION
        ===================================================== */}

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
              !
            </div>

            <div>
              <h3 className="text-sm font-black text-amber-900">
                Zone management note
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Zones are referenced by delivery
                areas and are used during order
                creation to determine pickup and
                delivery zones. Avoid deleting a
                zone that is already assigned to
                delivery areas.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
