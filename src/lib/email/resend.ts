import { Resend } from "resend";

const resendApiKey =
  process.env.RESEND_API_KEY;

const emailFrom =
  process.env.EMAIL_FROM;

const resend =
  resendApiKey
    ? new Resend(resendApiKey)
    : null;

export type TrackingEmailData = {
  customerEmail: string;
  customerName?: string | null;

  orderNumber: string;

  status: string;

  description?: string | null;

  location?: string | null;

  deliveryAddress?: string | null;

  rescheduledDate?: string | null;

  deliveryAttempt?: number | null;
};

function formatStatus(
  status: string
) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function escapeHtml(
  value: string
) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTrackingEmailHtml(
  data: TrackingEmailData
) {
  const customerName =
    data.customerName?.trim() ||
    "Customer";

  const status =
    formatStatus(data.status);

  const description =
    data.description?.trim() || "";

  const location =
    data.location?.trim() || "";

  const deliveryAddress =
    data.deliveryAddress?.trim() || "";

  const rescheduledDate =
    data.rescheduledDate?.trim() || "";

  const deliveryAttempt =
    data.deliveryAttempt != null
      ? String(data.deliveryAttempt)
      : "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>
      Delivery Status Update
    </title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
    "
  >
    <div
      style="
        max-width: 620px;
        margin: 0 auto;
        padding: 32px 16px;
      "
    >
      <div
        style="
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          border: 1px solid #e2e8f0;
        "
      >
        <h1
          style="
            margin: 0 0 8px;
            font-size: 24px;
          "
        >
          Last-Mile Delivery Tracker
        </h1>

        <p
          style="
            margin: 0 0 24px;
            color: #64748b;
            font-size: 14px;
          "
        >
          Delivery status update
        </p>

        <p
          style="
            margin: 0 0 20px;
            font-size: 16px;
          "
        >
          Hello ${escapeHtml(customerName)},
        </p>

        <p
          style="
            margin: 0 0 20px;
            font-size: 15px;
            line-height: 1.6;
          "
        >
          Your order
          <strong>
            ${escapeHtml(data.orderNumber)}
          </strong>
          has been updated.
        </p>

        <div
          style="
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
          "
        >
          <p
            style="
              margin: 0 0 8px;
              color: #64748b;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            "
          >
            Current Status
          </p>

          <p
            style="
              margin: 0;
              font-size: 22px;
              font-weight: 700;
            "
          >
            ${escapeHtml(status)}
          </p>
        </div>

        ${
          description
            ? `
        <div
          style="
            margin-bottom: 16px;
          "
        >
          <strong>
            Update:
          </strong>

          <span>
            ${escapeHtml(description)}
          </span>
        </div>
        `
            : ""
        }

        ${
          location
            ? `
        <div
          style="
            margin-bottom: 16px;
          "
        >
          <strong>
            Location:
          </strong>

          <span>
            ${escapeHtml(location)}
          </span>
        </div>
        `
            : ""
        }

        ${
          deliveryAddress
            ? `
        <div
          style="
            margin-bottom: 16px;
          "
        >
          <strong>
            Delivery Address:
          </strong>

          <span>
            ${escapeHtml(
              deliveryAddress
            )}
          </span>
        </div>
        `
            : ""
        }

        ${
          rescheduledDate
            ? `
        <div
          style="
            margin-bottom: 16px;
          "
        >
          <strong>
            New Delivery Date:
          </strong>

          <span>
            ${escapeHtml(
              rescheduledDate
            )}
          </span>
        </div>
        `
            : ""
        }

        ${
          deliveryAttempt
            ? `
        <div
          style="
            margin-bottom: 16px;
          "
        >
          <strong>
            Delivery Attempt:
          </strong>

          <span>
            ${escapeHtml(
              deliveryAttempt
            )}
          </span>
        </div>
        `
            : ""
        }

        <p
          style="
            margin: 28px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
          "
        >
          You will receive another notification
          when the status of your order changes.
        </p>
      </div>

      <p
        style="
          margin: 16px 0 0;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        "
      >
        This is an automated message from
        Last-Mile Delivery Tracker.
      </p>
    </div>
  </body>
</html>
`;
}

export async function sendTrackingStatusEmail(
  data: TrackingEmailData
) {
  if (!resendApiKey) {
    console.warn(
      "RESEND_API_KEY is not configured. Tracking email was not sent."
    );

    return {
      success: false,
      skipped: true,
      error:
        "RESEND_API_KEY is not configured.",
    };
  }

  if (!emailFrom) {
    console.warn(
      "EMAIL_FROM is not configured. Tracking email was not sent."
    );

    return {
      success: false,
      skipped: true,
      error:
        "EMAIL_FROM is not configured.",
    };
  }

  if (!resend) {
    return {
      success: false,
      skipped: true,
      error:
        "Resend client could not be initialized.",
    };
  }

  if (!data.customerEmail?.trim()) {
    return {
      success: false,
      skipped: true,
      error:
        "Customer email address is missing.",
    };
  }

  const status =
    formatStatus(data.status);

  try {
    const result =
      await resend.emails.send({
        from: emailFrom,
        to: [data.customerEmail],
        subject:
          `Order ${data.orderNumber} - ${status}`,
        html:
          buildTrackingEmailHtml(data),
      });

    if (result.error) {
      console.error(
        "Resend email error:",
        result.error
      );

      return {
        success: false,
        skipped: false,
        error:
          result.error.message ??
          "Failed to send tracking email.",
      };
    }

    return {
      success: true,
      skipped: false,
      id: result.data?.id ?? null,
    };
  } catch (error) {
    console.error(
      "Tracking email exception:",
      error
    );

    return {
      success: false,
      skipped: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send tracking email.",
    };
  }
}
