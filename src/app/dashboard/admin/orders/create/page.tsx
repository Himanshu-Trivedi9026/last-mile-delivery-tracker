"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type FormState = {
  customerId: string;
  pickupAddress: string;
  deliveryAddress: string;
  packageType: string;
  packageWeight: string;
  length: string;
  width: string;
  height: string;
  orderType: "B2B" | "B2C";
  paymentMethod: "prepaid" | "cod";
};

export default function AdminCreateOrderPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [form, setForm] =
    useState<FormState>({
      customerId: "",
      pickupAddress: "",
      deliveryAddress: "",
      packageType: "",
      packageWeight: "",
      length: "",
      width: "",
      height: "",
      orderType: "B2C",
      paymentMethod: "prepaid",
    });

  useEffect(() => {
    async function loadCustomers() {
      try {
        const response =
          await fetch(
            "/api/admin/customers"
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Failed to load customers."
          );
        }

        setCustomers(
          data.customers ?? []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load customers."
        );
      } finally {
        setLoadingCustomers(false);
      }
    }

    loadCustomers();
  }, []);

  const selectedCustomer =
    useMemo(
      () =>
        customers.find(
          (customer) =>
            customer.id ===
            form.customerId
        ),
      [
        customers,
        form.customerId,
      ]
    );

  function updateField(
    field: keyof FormState,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.customerId) {
      setError(
        "Please select a customer."
      );
      return;
    }

    if (
      !form.pickupAddress.trim() ||
      !form.deliveryAddress.trim()
    ) {
      setError(
        "Pickup and delivery addresses are required."
      );
      return;
    }

    if (
      !form.packageType.trim()
    ) {
      setError(
        "Package type is required."
      );
      return;
    }

    const weight =
      Number(form.packageWeight);

    const length =
      Number(form.length);

    const width =
      Number(form.width);

    const height =
      Number(form.height);

    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      setError(
        "Package weight must be greater than 0."
      );
      return;
    }

    if (
      !Number.isFinite(length) ||
      length <= 0 ||
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(height) ||
      height <= 0
    ) {
      setError(
        "Package dimensions must all be greater than 0."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/orders",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              customerId:
                form.customerId,

              pickup_address:
                form.pickupAddress.trim(),

              delivery_address:
                form.deliveryAddress.trim(),

              package_type:
                form.packageType.trim(),

              package_weight:
                weight,

              length,
              width,
              height,

              order_type:
                form.orderType,

              payment_method:
                form.paymentMethod,
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
            "Failed to create order."
        );
      }

      setSuccess(
        `Order ${
          data.order?.order_number ??
          ""
        } created successfully.`
      );

      setTimeout(() => {
        if (data.order?.id) {
          router.push(
            `/dashboard/admin/orders/${data.order.id}`
          );
        } else {
          router.push(
            "/dashboard/admin/orders"
          );
        }
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Admin Terminal
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              Create Order
            </h1>

            <p className="mt-2 text-slate-600">
              Create a delivery order on behalf
              of a customer.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/admin/orders"
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to Orders
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[1fr_340px]"
        >
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                Customer
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select the customer for whom
                this order is being created.
              </p>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Customer
                </span>

                <select
                  value={form.customerId}
                  onChange={(event) =>
                    updateField(
                      "customerId",
                      event.target.value
                    )
                  }
                  disabled={
                    loadingCustomers
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">
                    {loadingCustomers
                      ? "Loading customers..."
                      : "Select a customer"}
                  </option>

                  {customers.map(
                    (customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.full_name ||
                          "Unnamed customer"}
                        {customer.phone
                          ? ` — ${customer.phone}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              {selectedCustomer && (
                <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">
                    {selectedCustomer.full_name ||
                      "Customer"}
                  </p>

                  {selectedCustomer.phone && (
                    <p className="mt-1 text-slate-600">
                      {selectedCustomer.phone}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                Delivery Route
              </h2>

              <div className="mt-5 grid gap-5">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Pickup Address
                  </span>

                  <textarea
                    value={
                      form.pickupAddress
                    }
                    onChange={(event) =>
                      updateField(
                        "pickupAddress",
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Example: VIT Bhopal University, Bhopal"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Delivery Address
                  </span>

                  <textarea
                    value={
                      form.deliveryAddress
                    }
                    onChange={(event) =>
                      updateField(
                        "deliveryAddress",
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Example: New Market, Bhopal"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                Package Information
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Package Type
                  </span>

                  <input
                    value={
                      form.packageType
                    }
                    onChange={(event) =>
                      updateField(
                        "packageType",
                        event.target.value
                      )
                    }
                    placeholder="Electronics"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Actual Weight (kg)
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      form.packageWeight
                    }
                    onChange={(event) =>
                      updateField(
                        "packageWeight",
                        event.target.value
                      )
                    }
                    placeholder="2.5"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Package Dimensions (cm)
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.length}
                    onChange={(event) =>
                      updateField(
                        "length",
                        event.target.value
                      )
                    }
                    placeholder="Length"
                    className="rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.width}
                    onChange={(event) =>
                      updateField(
                        "width",
                        event.target.value
                      )
                    }
                    placeholder="Width"
                    className="rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.height}
                    onChange={(event) =>
                      updateField(
                        "height",
                        event.target.value
                      )
                    }
                    placeholder="Height"
                    className="rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                Order Configuration
              </h2>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Order Type
                  </span>

                  <select
                    value={form.orderType}
                    onChange={(event) =>
                      updateField(
                        "orderType",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="B2C">
                      B2C
                    </option>

                    <option value="B2B">
                      B2B
                    </option>
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Payment Type
                  </span>

                  <select
                    value={
                      form.paymentMethod
                    }
                    onChange={(event) =>
                      updateField(
                        "paymentMethod",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                  >
                    <option value="prepaid">
                      Prepaid
                    </option>

                    <option value="cod">
                      Cash on Delivery
                    </option>
                  </select>
                </label>
              </div>
            </section>
          </div>

          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-bold text-slate-950">
              Admin Order Summary
            </h2>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-slate-500">
                  Customer
                </p>

                <p className="font-semibold text-slate-900">
                  {selectedCustomer?.full_name ||
                    "Not selected"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  Order Type
                </p>

                <p className="font-semibold text-slate-900">
                  {form.orderType}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  Payment
                </p>

                <p className="font-semibold text-slate-900">
                  {form.paymentMethod ===
                  "cod"
                    ? "COD"
                    : "Prepaid"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  Chargeable Weight
                </p>

                <p className="font-semibold text-slate-900">
                  {form.packageWeight
                    ? `${Number(
                        form.packageWeight
                      ).toFixed(2)} kg actual`
                    : "Not specified"}
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Automatic calculation
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-700">
                  The backend will detect the
                  pickup and delivery zones,
                  calculate volumetric weight,
                  select the correct B2B/B2C
                  rate card, apply COD surcharge,
                  and assign an available agent.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                loadingCustomers
              }
              className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Creating Order..."
                : "Create Order"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/dashboard/admin/orders"
                )
              }
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </aside>
        </form>
      </div>
    </main>
  );
}
