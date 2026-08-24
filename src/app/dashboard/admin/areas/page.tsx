"use client";

import { FormEvent, useEffect, useState } from "react";

type Zone = {
  id: string;
  name: string;
};

type Area = {
  id: string;
  name: string;
  zone_id: string;
  created_at: string;
  zones?: Zone | Zone[] | null;
};

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [name, setName] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const [areasResponse, zonesResponse] = await Promise.all([
        fetch("/api/admin/areas"),
        fetch("/api/admin/zones"),
      ]);

      const areasData = await areasResponse.json();
      const zonesData = await zonesResponse.json();

      if (areasResponse.ok) {
        setAreas(areasData.areas ?? []);
      }

      if (zonesResponse.ok) {
        setZones(zonesData.zones ?? []);
      }
    } catch {
      setMessage("Failed to load areas and zones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setName("");
    setZoneId("");
    setEditingId(null);
  }

  async function saveArea(event: FormEvent) {
    event.preventDefault();

    if (!name.trim() || !zoneId) {
      setMessage("Area name and zone are required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const url = editingId
        ? `/api/admin/areas/${editingId}`
        : "/api/admin/areas";

      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          zoneId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Failed to save area.");
        return;
      }

      setMessage(
        editingId
          ? "Area updated successfully."
          : "Area created successfully."
      );

      resetForm();
      await loadData();
    } catch {
      setMessage("Failed to save area.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(area: Area) {
    setEditingId(area.id);
    setName(area.name);
    setZoneId(area.zone_id);
    setMessage("");
  }

  async function deleteArea(area: Area) {
    if (
      !window.confirm(
        `Delete area "${area.name}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/areas/${area.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error ?? "Failed to delete area."
        );
        return;
      }

      setMessage("Area deleted successfully.");
      await loadData();
    } catch {
      setMessage("Failed to delete area.");
    }
  }

  function getZoneName(area: Area) {
    if (Array.isArray(area.zones)) {
      return area.zones[0]?.name ?? "Unknown Zone";
    }

    return area.zones?.name ?? "Unknown Zone";
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold">
          Delivery Areas
        </h1>

        <p className="mb-6 text-sm opacity-70">
          Manage delivery areas and assign each area to a
          delivery zone.
        </p>

        {message && (
          <div className="mb-6 rounded-lg border p-3">
            {message}
          </div>
        )}

        <form
          onSubmit={saveArea}
          className="mb-8 rounded-xl border p-6"
        >
          <h2 className="mb-4 text-xl font-semibold">
            {editingId
              ? "Edit Delivery Area"
              : "Create Delivery Area"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Area name"
              className="rounded-lg border px-4 py-3"
            />

            <select
              value={zoneId}
              onChange={(event) =>
                setZoneId(event.target.value)
              }
              className="rounded-lg border px-4 py-3"
            >
              <option value="">
                Select zone
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

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border px-5 py-2 font-medium"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Area"
                  : "Create Area"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-5 py-2"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="rounded-xl border">
          <div className="border-b p-5">
            <h2 className="text-xl font-semibold">
              Configured Areas
            </h2>
          </div>

          {loading ? (
            <div className="p-6">
              Loading areas...
            </div>
          ) : areas.length === 0 ? (
            <div className="p-6">
              No delivery areas configured.
            </div>
          ) : (
            <div className="divide-y">
              {areas.map((area) => (
                <div
                  key={area.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {area.name}
                    </div>

                    <div className="text-sm opacity-70">
                      Zone: {getZoneName(area)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        startEdit(area)
                      }
                      className="rounded-lg border px-4 py-2"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteArea(area)
                      }
                      className="rounded-lg border px-4 py-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
