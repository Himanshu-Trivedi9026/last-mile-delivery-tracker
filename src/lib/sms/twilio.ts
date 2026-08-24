type TrackingSmsData = {
  customerPhone: string;
  customerName?: string | null;
  orderNumber: string;
  status: string;
  description?: string | null;
  deliveryAddress?: string | null;
  rescheduledDate?: string | null;
  deliveryAttempt?: number | null;
};

function normalizePhoneNumber(
  phone: string
): string {
  const value = phone.trim();

  // Indian 10-digit number
  if (/^\d{10}$/.test(value)) {
    return `+91${value}`;
  }

  // Indian number without "+"
  if (/^91\d{10}$/.test(value)) {
    return `+${value}`;
  }

  return value;
}

function formatStatus(
  status: string
): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

/*
 * Twilio Trial accounts do not allow
 * arbitrary SMS bodies.
 *
 * They require one of Twilio's
 * predefined trial templates.
 *
 * For this project we use:
 *
 * sms_delivery_updates
 */
function getTrialSmsTemplate(
  status: string
): string {
  const normalizedStatus =
    status.toLowerCase();

  switch (normalizedStatus) {
    case "assigned":
    case "picked_up":
    case "in_transit":
    case "out_for_delivery":
    case "delivered":
    case "failed":
    case "rescheduled":
      return "sms_delivery_updates";

    default:
      return "sms_delivery_updates";
  }
}

export async function sendTrackingStatusSms(
  data: TrackingSmsData
) {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;

  const authToken =
    process.env.TWILIO_AUTH_TOKEN;

  const fromNumber =
    process.env.TWILIO_PHONE_NUMBER;

  /*
   * ============================================================
   * 1. Validate Twilio configuration
   * ============================================================
   */

  if (!accountSid) {
    console.warn(
      "TWILIO_ACCOUNT_SID is not configured. Tracking SMS was not sent."
    );

    return {
      success: false,
      skipped: true,
      error:
        "TWILIO_ACCOUNT_SID is not configured.",
    };
  }

  if (!authToken) {
    console.warn(
      "TWILIO_AUTH_TOKEN is not configured. Tracking SMS was not sent."
    );

    return {
      success: false,
      skipped: true,
      error:
        "TWILIO_AUTH_TOKEN is not configured.",
    };
  }

  if (!fromNumber) {
    console.warn(
      "TWILIO_PHONE_NUMBER is not configured. Tracking SMS was not sent."
    );

    return {
      success: false,
      skipped: true,
      error:
        "TWILIO_PHONE_NUMBER is not configured.",
    };
  }

  /*
   * ============================================================
   * 2. Validate customer phone
   * ============================================================
   */

  if (!data.customerPhone?.trim()) {
    return {
      success: false,
      skipped: true,
      error:
        "Customer phone number is missing.",
    };
  }

  const toNumber =
    normalizePhoneNumber(
      data.customerPhone
    );

  /*
   * ============================================================
   * 3. Select Twilio Trial template
   * ============================================================
   */

  const template =
    getTrialSmsTemplate(
      data.status
    );

  /*
   * ============================================================
   * 4. Create Twilio authentication
   * ============================================================
   */

  const credentials =
    Buffer.from(
      `${accountSid}:${authToken}`
    ).toString("base64");

  /*
   * ============================================================
   * 5. Create request body
   * ============================================================
   *
   * IMPORTANT:
   *
   * During a Twilio Trial, "Body" must contain
   * one of Twilio's predefined template names.
   *
   * We therefore DO NOT send our custom
   * order/status message here.
   */

  const formData =
    new URLSearchParams();

  formData.append(
    "To",
    toNumber
  );

  formData.append(
    "From",
    fromNumber
  );

  formData.append(
    "Body",
    template
  );

  /*
   * ============================================================
   * 6. Twilio Messages API
   * ============================================================
   */

  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  try {
    const response =
      await fetch(url, {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          formData.toString(),
      });

    const result =
      await response.json();

    /*
     * ========================================================
     * 7. Handle Twilio error
     * ========================================================
     */

    if (!response.ok) {
      console.error(
        "Twilio SMS error:",
        result
      );

      return {
        success: false,
        skipped: false,
        error:
          result?.message ||
          "Twilio failed to send SMS.",

        code:
          result?.code ?? null,
      };
    }

    /*
     * ========================================================
     * 8. Success
     * ========================================================
     */

    console.log(
      "Twilio SMS sent successfully:",
      {
        sid:
          result.sid,

        status:
          result.status,

        to:
          toNumber,

        template,
      }
    );

    return {
      success: true,
      skipped: false,

      id:
        result.sid,

      status:
        result.status,

      template,
    };
  } catch (error) {
    /*
     * ========================================================
     * 9. Network/API error
     * ========================================================
     */

    console.error(
      "Twilio SMS request error:",
      error
    );

    return {
      success: false,
      skipped: false,

      error:
        error instanceof Error
          ? error.message
          : "Unknown Twilio error.",
    };
  }
}