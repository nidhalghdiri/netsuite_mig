export default function StatusCard({ title, oldCount, newCount, status }) {
  const statusColors = {
    complete: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    "in-progress": "bg-blue-100 text-blue-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-gray-200 border-2 border-dashed rounded-xl w-12 h-12" />
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {oldCount} → {newCount}
                </div>
              </dd>
            </dl>
          </div>
        </div>
        <div className="mt-4">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusColors[status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {status.replace("-", " ")}
          </span>
        </div>
      </div>
    </div>
  );
}
