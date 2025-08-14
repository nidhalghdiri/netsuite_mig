import { fetchRecordData } from "@/lib/netsuiteAPI";

export async function GET(request, { params }) {
  const { recordType } = params;
  // console.log("GET recordType: ", recordType);
  const { searchParams } = new URL(request.url);
  // console.log("GET searchParams: ", searchParams);
  const instance = searchParams.get("instance");
  // console.log("GET instance: ", instance);

  // Validate instance parameter
  if (!["old", "new"].includes(instance)) {
    return Response.json(
      { error: 'Invalid instance type. Use "old" or "new".' },
      { status: 400 }
    );
  }

  // Get token from Authorization header
  const authHeader = request.headers.get("Authorization");
  // console.log("GET authHeader: ", authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];

  // console.log("GET token: ", token);

  try {
    const data = await fetchRecordData(recordType, instance, token);
    return Response.json(data);
  } catch (error) {
    console.error(`API Error [${recordType}]:`, error);
    return Response.json(
      { error: error.message || "Failed to fetch records" },
      { status: 500 }
    );
  }
}
