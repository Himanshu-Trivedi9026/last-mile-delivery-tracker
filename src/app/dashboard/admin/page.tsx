export default function AdminDashboard() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Admin Dashboard
        </h1>

        <p className="mt-2 text-gray-600">
          Last-Mile Delivery Tracker — Administration
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold">Orders</h2>
            <p className="mt-2 text-sm text-gray-600">
              Manage customer orders and delivery status.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold">Delivery Agents</h2>
            <p className="mt-2 text-sm text-gray-600">
              Assign and manage delivery agents.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold">Rate Cards</h2>
            <p className="mt-2 text-sm text-gray-600">
              Configure delivery rates and COD charges.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-lg font-semibold">Zones & Areas</h2>
            <p className="mt-2 text-sm text-gray-600">
              Manage delivery zones and service areas.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}