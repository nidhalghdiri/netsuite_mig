import { NextResponse } from "next/server";

// app/api/netsuite/suiteql/route.js
export async function POST(request) {
  try {
    const { accountId, token, query } = await request.json();

    // Validate input
    if (!accountId || !token) {
      return NextResponse.json(
        { error: "Missing required parameters or invalid format" },
        { status: 400 }
      );
    }

    let allItems = [];
    let nextLink = null;
    let pageCount = 0;
    const maxPages = 50; // Safety limit to prevent infinite loops

    do {
      const url =
        nextLink ||
        `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`;

      const response = await fetch(url, {
        method: nextLink ? "GET" : "POST", // Use GET for pagination, POST for initial
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "transient",
        },
        body: nextLink ? null : JSON.stringify({ q: query }), // Only include body for initial request
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SuiteQL query failed: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();

      // Add items from current page
      if (result.items && result.items.length > 0) {
        allItems = [...allItems, ...result.items];
      }

      // Check if there's a next page
      nextLink = null;
      if (result.links && result.links.length > 0) {
        const nextLinkObj = result.links.find((link) => link.rel === "next");
        if (nextLinkObj) {
          nextLink = nextLinkObj.href;
        }
      }

      pageCount++;
      console.log(
        `Fetched page ${pageCount}: ${
          result.items?.length || 0
        } items, total: ${allItems.length}, hasMore: ${!!nextLink}`
      );

      // Safety check to prevent infinite loops
      if (pageCount >= maxPages) {
        console.warn(
          `Reached maximum page limit of ${maxPages}. Stopping pagination.`
        );
        break;
      }

      // Add a small delay to avoid rate limiting
      if (nextLink) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (nextLink);

    console.log(`Total items fetched: ${allItems.length}`);

    return NextResponse.json({
      result: {
        items: allItems,
        totalCount: allItems.length,
      },
    });
  } catch (error) {
    console.error("Error in get Transactions:", error);
    return NextResponse.json(
      { error: "Failed to get Transactions", details: error.message },
      { status: 500 }
    );
  }
}
