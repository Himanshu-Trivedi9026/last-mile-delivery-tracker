"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

// ============================================================
// TYPES
// ============================================================

type FormData = {
  pickupAddress: string;
  deliveryAddress: string;

  packageWeight: string;
  packageType: string;

  packageLength: string;
  packageWidth: string;
  packageHeight: string;

  orderType: "B2B" | "B2C";

  deliveryType:
    | "standard"
    | "express";

  paymentMethod:
    | "prepaid"
    | "cod";

  orderAmount: string;

  expectedDeliveryDate: string;
};

type FormErrors =
  Partial<
    Record<
      keyof FormData,
      string
    >
  >;

// ============================================================
// COMPONENT
// ============================================================

export default function CreateOrderPage() {
  const router = useRouter();

  // ==========================================================
  // FORM STATE
  // ==========================================================

  const [formData, setFormData] =
    useState<FormData>({
      pickupAddress: "",
      deliveryAddress: "",

      packageWeight: "",
      packageType: "",

      packageLength: "",
      packageWidth: "",
      packageHeight: "",

      orderType: "B2C",

      deliveryType:
        "standard",

      paymentMethod:
        "prepaid",

      orderAmount: "",

      expectedDeliveryDate:
        "",
    });

  const [errors, setErrors] =
    useState<FormErrors>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ==========================================================
  // NUMERIC VALUES
  // ==========================================================

  const packageWeight =
    Number(formData.packageWeight) ||
    0;

  const packageLength =
    Number(formData.packageLength) ||
    0;

  const packageWidth =
    Number(formData.packageWidth) ||
    0;

  const packageHeight =
    Number(formData.packageHeight) ||
    0;

  const orderAmount =
    Number(formData.orderAmount) ||
    0;

  // ==========================================================
  // VOLUMETRIC WEIGHT
  // ==========================================================

  const volumetricWeight =
    useMemo(() => {
      if (
        packageLength <= 0 ||
        packageWidth <= 0 ||
        packageHeight <= 0
      ) {
        return 0;
      }

      return (
        (packageLength *
          packageWidth *
          packageHeight) /
        5000
      );
    }, [
      packageLength,
      packageWidth,
      packageHeight,
    ]);

  // ==========================================================
  // CHARGEABLE WEIGHT
  // ==========================================================

  const chargeableWeight =
    Math.max(
      packageWeight,
      volumetricWeight
    );

  // ==========================================================
  // TEMPORARY DELIVERY FEE
  // ==========================================================
  //
  // The final production rate will later come from
  // Supabase rate_cards.
  //
  // ==========================================================

  const deliveryFee =
    useMemo(() => {
      let fee =
        formData.deliveryType ===
        "express"
          ? 150
          : 80;

      if (
        chargeableWeight > 5
      ) {
        fee +=
          Math.ceil(
            chargeableWeight - 5
          ) * 20;
      }

      return fee;
    }, [
      formData.deliveryType,
      chargeableWeight,
    ]);

  // ==========================================================
  // COD
  // ==========================================================

  const codSurcharge =
    formData.paymentMethod ===
    "cod"
      ? 30
      : 0;

  // ==========================================================
  // TOTAL
  // ==========================================================

  const totalAmount =
    orderAmount +
    deliveryFee +
    codSurcharge;

  // ==========================================================
  // UPDATE FIELD
  // ==========================================================

  function updateField<
    K extends keyof FormData
  >(
    field: K,
    value: FormData[K]
  ) {
    setFormData(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );

    setErrors(
      (previous) => ({
        ...previous,
        [field]: undefined,
      })
    );

    setError("");
  }

  // ==========================================================
  // VALIDATION
  // ==========================================================

  function validateForm(): boolean {
    const newErrors: FormErrors =
      {};

    // --------------------------------------------------------
    // Addresses
    // --------------------------------------------------------

    if (
      formData.pickupAddress
        .trim()
        .length < 5
    ) {
      newErrors.pickupAddress =
        "Pickup address must be at least 5 characters.";
    }

    if (
      formData.deliveryAddress
        .trim()
        .length < 5
    ) {
      newErrors.deliveryAddress =
        "Delivery address must be at least 5 characters.";
    }

    // --------------------------------------------------------
    // Weight
    // --------------------------------------------------------

    if (
      !formData.packageWeight
    ) {
      newErrors.packageWeight =
        "Please enter the package weight.";
    } else if (
      Number.isNaN(
        packageWeight
      )
    ) {
      newErrors.packageWeight =
        "Please enter a valid package weight.";
    } else if (
      packageWeight <= 0
    ) {
      newErrors.packageWeight =
        "Package weight must be greater than 0.";
    } else if (
      packageWeight > 1000
    ) {
      newErrors.packageWeight =
        "Package weight cannot exceed 1000 kg.";
    }

    // --------------------------------------------------------
    // Package type
    // --------------------------------------------------------

    if (
      formData.packageType
        .trim()
        .length < 2
    ) {
      newErrors.packageType =
        "Package type must be at least 2 characters.";
    }

    // --------------------------------------------------------
    // Dimensions
    // --------------------------------------------------------

    if (
      !formData.packageLength ||
      Number.isNaN(packageLength)
    ) {
      newErrors.packageLength =
        "Please enter package length.";
    } else if (
      packageLength <= 0
    ) {
      newErrors.packageLength =
        "Package length must be greater than 0.";
    }

    if (
      !formData.packageWidth ||
      Number.isNaN(packageWidth)
    ) {
      newErrors.packageWidth =
        "Please enter package width.";
    } else if (
      packageWidth <= 0
    ) {
      newErrors.packageWidth =
        "Package width must be greater than 0.";
    }

    if (
      !formData.packageHeight ||
      Number.isNaN(packageHeight)
    ) {
      newErrors.packageHeight =
        "Please enter package height.";
    } else if (
      packageHeight <= 0
    ) {
      newErrors.packageHeight =
        "Package height must be greater than 0.";
    }

    // --------------------------------------------------------
    // Order amount
    // --------------------------------------------------------

    if (
      !formData.orderAmount
    ) {
      newErrors.orderAmount =
        "Please enter the order amount.";
    } else if (
      Number.isNaN(orderAmount) ||
      orderAmount < 0
    ) {
      newErrors.orderAmount =
        "Order amount cannot be negative.";
    }

    // --------------------------------------------------------
    // Expected delivery date
    // --------------------------------------------------------

    if (
      formData.expectedDeliveryDate
    ) {
      const selectedDate =
        new Date(
          `${formData.expectedDeliveryDate}T00:00:00`
        );

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      if (
        selectedDate < today
      ) {
        newErrors.expectedDeliveryDate =
          "Expected delivery date cannot be in the past.";
      }
    }

    setErrors(newErrors);

    return (
      Object.keys(
        newErrors
      ).length === 0
    );
  }

  // ==========================================================
  // SUBMIT
  // ==========================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

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
              pickupAddress:
                formData.pickupAddress.trim(),

              deliveryAddress:
                formData.deliveryAddress.trim(),

              packageWeight:
                packageWeight,

              packageType:
                formData.packageType.trim(),

              packageLength:
                packageLength,

              packageWidth:
                packageWidth,

              packageHeight:
                packageHeight,

              orderType:
                formData.orderType,

              deliveryType:
                formData.deliveryType,

              paymentMethod:
                formData.paymentMethod,

              orderAmount:
                orderAmount,

              expectedDeliveryDate:
                formData.expectedDeliveryDate ||
                undefined,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        if (
          response.status ===
          401
        ) {
          router.push("/");
          return;
        }

        throw new Error(
          data.error ||
            "Failed to create order."
        );
      }

      setSuccess(
        `Order ${
          data.order
            ?.order_number || ""
        } created successfully.`
      );

      setTimeout(() => {
        if (
          data.order?.id
        ) {
          router.push(
            `/dashboard/customer/orders/${data.order.id}`
          );
        } else {
          router.push(
            "/dashboard/customer"
          );
        }

        router.refresh();
      }, 800);
    } catch (err) {
      console.error(
        "Create order error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================
  // CURRENCY
  // ==========================================================

  function formatCurrency(
    value: number
  ) {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    ).format(value);
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-40 border-b border-[#c6c6cd] bg-[#f8f9ff]">

        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-6">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard/customer"
              )
            }
            className="flex items-center gap-2 text-sm font-semibold text-[#0058be] transition hover:text-[#0b1c30]"
          >
            ← Back to My Orders
          </button>

          <div className="font-bold">
            Global Logistics
          </div>

        </div>

      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="px-4 py-8 md:px-6">

        <div className="mx-auto max-w-[1200px]">

          {/* Heading */}

          <div className="mb-7">

            <p className="text-xs font-bold uppercase tracking-wider text-[#0058be]">
              DELIVERY MANAGEMENT
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Create New Order
            </h1>

            <p className="mt-2 text-sm text-[#45464d]">
              Enter the pickup, delivery,
              package and payment information
              for your shipment.
            </p>

          </div>

          {/* Error */}

          {error && (
            <div className="mb-6 rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-4 text-sm text-[#93000a]">

              <div className="font-bold">
                Unable to create order
              </div>

              <div className="mt-1">
                {error}
              </div>

            </div>
          )}

          {/* Success */}

          {success && (
            <div className="mb-6 rounded-lg border border-[#00875a] bg-[#d9f8e8] p-4 text-sm text-[#006b46]">

              <div className="font-bold">
                Order created successfully
              </div>

              <div className="mt-1">
                {success}
              </div>

              <div className="mt-1">
                Redirecting to order details...
              </div>

            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
          >

            {/* ==================================================
                LEFT COLUMN
            ================================================== */}

            <div className="space-y-6">

              {/* ==================================================
                  DELIVERY ROUTE
              ================================================== */}

              <section className="rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm md:p-6">

                <div className="mb-5">

                  <h2 className="text-xl font-bold">
                    Delivery Route
                  </h2>

                  <p className="mt-1 text-sm text-[#45464d]">
                    Enter where the package
                    will be picked up and
                    delivered.
                  </p>

                </div>

                <div className="space-y-5">

                  {/* Pickup */}

                  <div>

                    <label
                      htmlFor="pickupAddress"
                      className="mb-2 block text-sm font-bold"
                    >
                      Pickup Address
                    </label>

                    <textarea
                      id="pickupAddress"
                      value={
                        formData.pickupAddress
                      }
                      onChange={(event) =>
                        updateField(
                          "pickupAddress",
                          event.target.value
                        )
                      }
                      placeholder="Example: VIT Bhopal University, Bhopal"
                      rows={3}
                      maxLength={500}
                      className={`w-full resize-none rounded-lg border bg-[#f8f9ff] px-4 py-3 text-sm outline-none transition focus:border-[#0058be] ${
                        errors.pickupAddress
                          ? "border-[#ba1a1a]"
                          : "border-[#c6c6cd]"
                      }`}
                    />

                    {errors.pickupAddress && (
                      <p className="mt-1 text-xs text-[#ba1a1a]">
                        {errors.pickupAddress}
                      </p>
                    )}

                  </div>

                  {/* Delivery */}

                  <div>

                    <label
                      htmlFor="deliveryAddress"
                      className="mb-2 block text-sm font-bold"
                    >
                      Delivery Address
                    </label>

                    <textarea
                      id="deliveryAddress"
                      value={
                        formData.deliveryAddress
                      }
                      onChange={(event) =>
                        updateField(
                          "deliveryAddress",
                          event.target.value
                        )
                      }
                      placeholder="Example: New Market, Bhopal"
                      rows={3}
                      maxLength={500}
                      className={`w-full resize-none rounded-lg border bg-[#f8f9ff] px-4 py-3 text-sm outline-none transition focus:border-[#0058be] ${
                        errors.deliveryAddress
                          ? "border-[#ba1a1a]"
                          : "border-[#c6c6cd]"
                      }`}
                    />

                    {errors.deliveryAddress && (
                      <p className="mt-1 text-xs text-[#ba1a1a]">
                        {errors.deliveryAddress}
                      </p>
                    )}

                  </div>

                </div>

              </section>

              {/* ==================================================
                  PACKAGE INFORMATION
              ================================================== */}

              <section className="rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm md:p-6">

                <div className="mb-5">

                  <h2 className="text-xl font-bold">
                    Package Information
                  </h2>

                  <p className="mt-1 text-sm text-[#45464d]">
                    Provide package type,
                    weight and dimensions.
                  </p>

                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                  {/* Package Type */}

                  <div>

                    <label
                      htmlFor="packageType"
                      className="mb-2 block text-sm font-bold"
                    >
                      Package Type
                    </label>

                    <input
                      id="packageType"
                      type="text"
                      value={
                        formData.packageType
                      }
                      onChange={(event) =>
                        updateField(
                          "packageType",
                          event.target.value
                        )
                      }
                      placeholder="Electronics"
                      maxLength={100}
                      className={`w-full rounded-lg border bg-[#f8f9ff] px-4 py-3 text-sm outline-none transition focus:border-[#0058be] ${
                        errors.packageType
                          ? "border-[#ba1a1a]"
                          : "border-[#c6c6cd]"
                      }`}
                    />

                    {errors.packageType && (
                      <p className="mt-1 text-xs text-[#ba1a1a]">
                        {errors.packageType}
                      </p>
                    )}

                  </div>

                  {/* Weight */}

                  <div>

                    <label
                      htmlFor="packageWeight"
                      className="mb-2 block text-sm font-bold"
                    >
                      Package Weight
                    </label>

                    <div className="relative">

                      <input
                        id="packageWeight"
                        type="number"
                        min="0.1"
                        max="1000"
                        step="0.1"
                        value={
                          formData.packageWeight
                        }
                        onChange={(event) =>
                          updateField(
                            "packageWeight",
                            event.target.value
                          )
                        }
                        placeholder="2.5"
                        className={`w-full rounded-lg border bg-[#f8f9ff] px-4 py-3 pr-14 text-sm outline-none transition focus:border-[#0058be] ${
                          errors.packageWeight
                            ? "border-[#ba1a1a]"
                            : "border-[#c6c6cd]"
                        }`}
                      />

                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#45464d]">
                        kg
                      </span>

                    </div>

                    {errors.packageWeight && (
                      <p className="mt-1 text-xs text-[#ba1a1a]">
                        {errors.packageWeight}
                      </p>
                    )}

                  </div>

                  {/* ==================================================
                      DIMENSIONS
                  ================================================== */}

                  <div className="md:col-span-2">

                    <label className="mb-3 block text-sm font-bold">
                      Package Dimensions
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                      {/* Length */}

                      <div>

                        <label
                          htmlFor="packageLength"
                          className="mb-2 block text-xs font-semibold text-[#45464d]"
                        >
                          Length
                        </label>

                        <div className="relative">

                          <input
                            id="packageLength"
                            type="number"
                            min="0.1"
                            max="1000"
                            step="0.1"
                            value={
                              formData.packageLength
                            }
                            onChange={(event) =>
                              updateField(
                                "packageLength",
                                event.target.value
                              )
                            }
                            placeholder="30"
                            className={`w-full rounded-lg border bg-[#f8f9ff] px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#0058be] ${
                              errors.packageLength
                                ? "border-[#ba1a1a]"
                                : "border-[#c6c6cd]"
                            }`}
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#45464d]">
                            cm
                          </span>

                        </div>

                        {errors.packageLength && (
                          <p className="mt-1 text-xs text-[#ba1a1a]">
                            {errors.packageLength}
                          </p>
                        )}

                      </div>

                      {/* Width */}

                      <div>

                        <label
                          htmlFor="packageWidth"
                          className="mb-2 block text-xs font-semibold text-[#45464d]"
                        >
                          Width
                        </label>

                        <div className="relative">

                          <input
                            id="packageWidth"
                            type="number"
                            min="0.1"
                            max="1000"
                            step="0.1"
                            value={
                              formData.packageWidth
                            }
                            onChange={(event) =>
                              updateField(
                                "packageWidth",
                                event.target.value
                              )
                            }
                            placeholder="20"
                            className={`w-full rounded-lg border bg-[#f8f9ff] px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#0058be] ${
                              errors.packageWidth
                                ? "border-[#ba1a1a]"
                                : "border-[#c6c6cd]"
                            }`}
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#45464d]">
                            cm
                          </span>

                        </div>

                        {errors.packageWidth && (
                          <p className="mt-1 text-xs text-[#ba1a1a]">
                            {errors.packageWidth}
                          </p>
                        )}

                      </div>

                      {/* Height */}

                      <div>

                        <label
                          htmlFor="packageHeight"
                          className="mb-2 block text-xs font-semibold text-[#45464d]"
                        >
                          Height
                        </label>

                        <div className="relative">

                          <input
                            id="packageHeight"
                            type="number"
                            min="0.1"
                            max="1000"
                            step="0.1"
                            value={
                              formData.packageHeight
                            }
                            onChange={(event) =>
                              updateField(
                                "packageHeight",
                                event.target.value
                              )
                            }
                            placeholder="15"
                            className={`w-full rounded-lg border bg-[#f8f9ff] px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#0058be] ${
                              errors.packageHeight
                                ? "border-[#ba1a1a]"
                                : "border-[#c6c6cd]"
                            }`}
                          />

                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#45464d]">
                            cm
                          </span>

                        </div>

                        {errors.packageHeight && (
                          <p className="mt-1 text-xs text-[#ba1a1a]">
                            {errors.packageHeight}
                          </p>
                        )}

                      </div>

                    </div>

                    {/* Weight calculation */}

                    {volumetricWeight >
                      0 && (
                      <div className="mt-4 rounded-lg bg-[#eff4ff] p-4">

                        <div className="flex justify-between text-sm">

                          <span className="text-[#45464d]">
                            Volumetric Weight
                          </span>

                          <span className="font-semibold">
                            {volumetricWeight.toFixed(
                              2
                            )}{" "}
                            kg
                          </span>

                        </div>

                        <div className="mt-2 flex justify-between text-sm">

                          <span className="text-[#45464d]">
                            Actual Weight
                          </span>

                          <span className="font-semibold">
                            {packageWeight.toFixed(
                              2
                            )}{" "}
                            kg
                          </span>

                        </div>

                        <div className="mt-2 flex justify-between border-t border-[#c6c6cd] pt-2 text-sm">

                          <span className="font-bold">
                            Chargeable Weight
                          </span>

                          <span className="font-bold text-[#0058be]">
                            {chargeableWeight.toFixed(
                              2
                            )}{" "}
                            kg
                          </span>

                        </div>

                      </div>
                    )}

                  </div>

                  {/* ==================================================
                      ORDER TYPE
                  ================================================== */}

                  <div className="md:col-span-2">

                    <label className="mb-3 block text-sm font-bold">
                      Order Type
                    </label>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                      {/* B2B */}

                      <label
                        className={`cursor-pointer rounded-lg border p-4 transition ${
                          formData.orderType ===
                          "B2B"
                            ? "border-[#0058be] bg-[#eff4ff]"
                            : "border-[#c6c6cd] bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >

                        <input
                          type="radio"
                          name="orderType"
                          value="B2B"
                          checked={
                            formData.orderType ===
                            "B2B"
                          }
                          onChange={() =>
                            updateField(
                              "orderType",
                              "B2B"
                            )
                          }
                          className="sr-only"
                        />

                        <div className="font-bold">
                          B2B
                        </div>

                        <div className="mt-1 text-xs text-[#45464d]">
                          Business to Business
                        </div>

                      </label>

                      {/* B2C */}

                      <label
                        className={`cursor-pointer rounded-lg border p-4 transition ${
                          formData.orderType ===
                          "B2C"
                            ? "border-[#0058be] bg-[#eff4ff]"
                            : "border-[#c6c6cd] bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >

                        <input
                          type="radio"
                          name="orderType"
                          value="B2C"
                          checked={
                            formData.orderType ===
                            "B2C"
                          }
                          onChange={() =>
                            updateField(
                              "orderType",
                              "B2C"
                            )
                          }
                          className="sr-only"
                        />

                        <div className="font-bold">
                          B2C
                        </div>

                        <div className="mt-1 text-xs text-[#45464d]">
                          Business to Customer
                        </div>

                      </label>

                    </div>

                  </div>

                </div>

              </section>

              {/* ==================================================
                  DELIVERY OPTIONS
              ================================================== */}

              <section className="rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm md:p-6">

                <div className="mb-5">

                  <h2 className="text-xl font-bold">
                    Delivery Options
                  </h2>

                  <p className="mt-1 text-sm text-[#45464d]">
                    Select your preferred
                    delivery and payment
                    options.
                  </p>

                </div>

                <div className="space-y-6">

                  {/* Delivery Type */}

                  <div>

                    <label className="mb-3 block text-sm font-bold">
                      Delivery Type
                    </label>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                      {/* Standard */}

                      <label
                        className={`cursor-pointer rounded-lg border p-4 transition ${
                          formData.deliveryType ===
                          "standard"
                            ? "border-[#0058be] bg-[#eff4ff]"
                            : "border-[#c6c6cd] bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >

                        <input
                          type="radio"
                          name="deliveryType"
                          value="standard"
                          checked={
                            formData.deliveryType ===
                            "standard"
                          }
                          onChange={() =>
                            updateField(
                              "deliveryType",
                              "standard"
                            )
                          }
                          className="sr-only"
                        />

                        <div className="flex items-start gap-3">

                          <div
                            className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                              formData.deliveryType ===
                              "standard"
                                ? "border-[#0058be]"
                                : "border-[#8b8d94]"
                            }`}
                          >
                            {formData.deliveryType ===
                              "standard" && (
                              <div className="h-2 w-2 rounded-full bg-[#0058be]" />
                            )}
                          </div>

                          <div>

                            <div className="font-bold">
                              Standard
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              Regular delivery service
                            </div>

                            <div className="mt-2 text-sm font-bold text-[#0058be]">
                              ₹80 base fee
                            </div>

                          </div>

                        </div>

                      </label>

                      {/* Express */}

                      <label
                        className={`cursor-pointer rounded-lg border p-4 transition ${
                          formData.deliveryType ===
                          "express"
                            ? "border-[#0058be] bg-[#eff4ff]"
                            : "border-[#c6c6cd] bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >

                        <input
                          type="radio"
                          name="deliveryType"
                          value="express"
                          checked={
                            formData.deliveryType ===
                            "express"
                          }
                          onChange={() =>
                            updateField(
                              "deliveryType",
                              "express"
                            )
                          }
                          className="sr-only"
                        />

                        <div className="flex items-start gap-3">

                          <div
                            className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                              formData.deliveryType ===
                              "express"
                                ? "border-[#0058be]"
                                : "border-[#8b8d94]"
                            }`}
                          >
                            {formData.deliveryType ===
                              "express" && (
                              <div className="h-2 w-2 rounded-full bg-[#0058be]" />
                            )}
                          </div>

                          <div>

                            <div className="font-bold">
                              Express
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              Priority delivery service
                            </div>

                            <div className="mt-2 text-sm font-bold text-[#0058be]">
                              ₹150 base fee
                            </div>

                          </div>

                        </div>

                      </label>

                    </div>

                  </div>

                  {/* Payment */}

                  <div>

                    <label className="mb-3 block text-sm font-bold">
                      Payment Method
                    </label>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                      {/* Prepaid */}

                      <label
                        className={`cursor-pointer rounded-lg border p-4 transition ${
                          formData.paymentMethod ===
                          "prepaid"
                            ? "border-[#0058be] bg-[#eff4ff]"
                            : "border-[#c6c6cd] bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >

                        <input
                          type="radio"
                          name="paymentMethod"
                          value="prepaid"
                          checked={
                            formData.paymentMethod ===
                            "prepaid"
                          }
                          onChange={() =>
                            updateField(
                              "paymentMethod",
                              "prepaid"
                            )
                          }
                          className="sr-only"
                        />

                        <div className="flex items-start gap-3">

                          <div
                            className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                              formData.paymentMethod ===
                              "prepaid"
                                ? "border-[#0058be]"
                                : "border-[#8b8d94]"
                            }`}
                          >
                            {formData.paymentMethod ===
                              "prepaid" && (
                              <div className="h-2 w-2 rounded-full bg-[#0058be]" />
                            )}
                          </div>

                          <div>

                            <div className="font-bold">
                              Prepaid
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              Pay before delivery
                            </div>

                          </div>

                        </div>

                      </label>

                      {/* COD */}

                      <label
                        className={`cursor-pointer rounded-lg border p-4 transition ${
                          formData.paymentMethod ===
                          "cod"
                            ? "border-[#0058be] bg-[#eff4ff]"
                            : "border-[#c6c6cd] bg-white hover:bg-[#f8f9ff]"
                        }`}
                      >

                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={
                            formData.paymentMethod ===
                            "cod"
                          }
                          onChange={() =>
                            updateField(
                              "paymentMethod",
                              "cod"
                            )
                          }
                          className="sr-only"
                        />

                        <div className="flex items-start gap-3">

                          <div
                            className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${
                              formData.paymentMethod ===
                              "cod"
                                ? "border-[#0058be]"
                                : "border-[#8b8d94]"
                            }`}
                          >
                            {formData.paymentMethod ===
                              "cod" && (
                              <div className="h-2 w-2 rounded-full bg-[#0058be]" />
                            )}
                          </div>

                          <div>

                            <div className="font-bold">
                              Cash on Delivery
                            </div>

                            <div className="mt-1 text-xs text-[#45464d]">
                              Pay when package arrives
                            </div>

                            <div className="mt-2 text-sm font-bold text-[#0058be]">
                              +₹30 surcharge
                            </div>

                          </div>

                        </div>

                      </label>

                    </div>

                  </div>

                </div>

              </section>

              {/* ==================================================
                  ORDER DETAILS
              ================================================== */}

              <section className="rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm md:p-6">

                <div className="mb-5">

                  <h2 className="text-xl font-bold">
                    Order Details
                  </h2>

                  <p className="mt-1 text-sm text-[#45464d]">
                    Enter the value of the items
                    being shipped.
                  </p>

                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                  {/* Amount */}

                  <div>

                    <label
                      htmlFor="orderAmount"
                      className="mb-2 block text-sm font-bold"
                    >
                      Order Amount
                    </label>

                    <div className="relative">

                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold">
                        ₹
                      </span>

                      <input
                        id="orderAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          formData.orderAmount
                        }
                        onChange={(event) =>
                          updateField(
                            "orderAmount",
                            event.target.value
                          )
                        }
                        placeholder="1500"
                        className={`w-full rounded-lg border bg-[#f8f9ff] py-3 pl-9 pr-4 text-sm outline-none transition focus:border-[#0058be] ${
                          errors.orderAmount
                            ? "border-[#ba1a1a]"
                            : "border-[#c6c6cd]"
                        }`}
                      />

                    </div>

                    {errors.orderAmount && (
                      <p className="mt-1 text-xs text-[#ba1a1a]">
                        {errors.orderAmount}
                      </p>
                    )}

                  </div>

                  {/* Date */}

                  <div>

                    <label
                      htmlFor="expectedDeliveryDate"
                      className="mb-2 block text-sm font-bold"
                    >
                      Expected Delivery Date
                    </label>

                    <input
                      id="expectedDeliveryDate"
                      type="date"
                      value={
                        formData.expectedDeliveryDate
                      }
                      onChange={(event) =>
                        updateField(
                          "expectedDeliveryDate",
                          event.target.value
                        )
                      }
                      className={`w-full rounded-lg border bg-[#f8f9ff] px-4 py-3 text-sm outline-none transition focus:border-[#0058be] ${
                        errors.expectedDeliveryDate
                          ? "border-[#ba1a1a]"
                          : "border-[#c6c6cd]"
                      }`}
                    />

                    {errors.expectedDeliveryDate && (
                      <p className="mt-1 text-xs text-[#ba1a1a]">
                        {errors.expectedDeliveryDate}
                      </p>
                    )}

                  </div>

                </div>

              </section>

            </div>

            {/* ==================================================
                RIGHT COLUMN
            ================================================== */}

            <div className="lg:sticky lg:top-24 lg:self-start">

              <section className="rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm md:p-6">

                <h2 className="text-xl font-bold">
                  Order Summary
                </h2>

                <p className="mt-1 text-sm text-[#45464d]">
                  Review the charges before
                  placing your order.
                </p>

                {/* Charges */}

                <div className="mt-6 space-y-4">

                  <SummaryRow
                    label="Order Amount"
                    value={formatCurrency(
                      orderAmount
                    )}
                  />

                  <SummaryRow
                    label="Delivery Fee"
                    value={formatCurrency(
                      deliveryFee
                    )}
                  />

                  <SummaryRow
                    label="COD Surcharge"
                    value={formatCurrency(
                      codSurcharge
                    )}
                  />

                  <div className="border-t border-[#c6c6cd] pt-4">

                    <div className="flex items-center justify-between">

                      <span className="font-bold">
                        Total
                      </span>

                      <span className="text-2xl font-black text-[#0058be]">
                        {formatCurrency(
                          totalAmount
                        )}
                      </span>

                    </div>

                  </div>

                </div>

                {/* Shipment Summary */}

                <div className="mt-6 rounded-lg bg-[#eff4ff] p-4">

                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#45464d]">
                    Shipment Summary
                  </div>

                  <div className="space-y-2 text-sm">

                    <SummaryDetail
                      label="Package"
                      value={
                        formData.packageType ||
                        "Not specified"
                      }
                    />

                    <SummaryDetail
                      label="Actual Weight"
                      value={
                        packageWeight > 0
                          ? `${packageWeight} kg`
                          : "Not specified"
                      }
                    />

                    <SummaryDetail
                      label="Chargeable Weight"
                      value={
                        chargeableWeight > 0
                          ? `${chargeableWeight.toFixed(
                              2
                            )} kg`
                          : "Not specified"
                      }
                    />

                    <SummaryDetail
                      label="Order Type"
                      value={
                        formData.orderType
                      }
                    />

                    <SummaryDetail
                      label="Delivery"
                      value={
                        formData.deliveryType ===
                        "express"
                          ? "Express"
                          : "Standard"
                      }
                    />

                    <SummaryDetail
                      label="Payment"
                      value={
                        formData.paymentMethod ===
                        "cod"
                          ? "Cash on Delivery"
                          : "Prepaid"
                      }
                    />

                  </div>

                </div>

                {/* Create */}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 w-full rounded-lg bg-[#0058be] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#00479a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Creating Order..."
                    : "Create Order"}
                </button>

                {/* Cancel */}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    router.push(
                      "/dashboard/customer"
                    )
                  }
                  className="mt-3 w-full rounded-lg border border-[#c6c6cd] bg-white px-5 py-3.5 text-sm font-bold text-[#0b1c30] transition hover:bg-[#f8f9ff] disabled:opacity-50"
                >
                  Cancel
                </button>

                <p className="mt-4 text-center text-[11px] leading-5 text-[#45464d]">
                  By creating this order,
                  you confirm that the
                  information provided is
                  correct.
                </p>

              </section>

            </div>

          </form>

        </div>

      </main>

    </div>
  );
}

// ============================================================
// SUMMARY ROW
// ============================================================

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">

      <span className="text-[#45464d]">
        {label}
      </span>

      <span className="font-semibold">
        {value}
      </span>

    </div>
  );
}

// ============================================================
// SUMMARY DETAIL
// ============================================================

function SummaryDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <span className="text-[#45464d]">
        {label}
      </span>

      <span className="max-w-[180px] text-right font-semibold">
        {value}
      </span>

    </div>
  );
}