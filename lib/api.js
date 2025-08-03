import axios from "axios";

// Simulated API helper
export async function fetchFromNetSuite(
  instance,
  recordType,
  subsidiary,
  period
) {
  // In a real implementation, this would make an actual API call
  console.log(
    `Fetching ${recordType} data from ${instance} instance for subsidiary ${subsidiary} and period ${period}`
  );

  // Return mock data
  return new Promise((resolve) => {
    setTimeout(() => {
      const data = [];
      const recordCount = Math.floor(Math.random() * 50) + 10;

      for (let i = 0; i < recordCount; i++) {
        const id = Math.floor(Math.random() * 100000);
        const amount = (Math.random() * 10000).toFixed(2);
        const date = new Date(
          Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)
        );

        data.push({
          id: id.toString(),
          tranId: `${recordType.slice(0, 2).toUpperCase()}${id}`,
          entity: `Customer ${Math.floor(Math.random() * 100)}`,
          amount: `$${amount}`,
          date: date.toLocaleDateString(),
          status: Math.random() > 0.2 ? "Active" : "Inactive",
        });
      }

      resolve(data);
    }, 1000);
  });
}
