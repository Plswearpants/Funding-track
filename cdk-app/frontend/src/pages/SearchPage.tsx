import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Award } from "../api";

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => api.search(query, page),
    enabled: query.length > 0,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input.trim());
    setPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Search Awards</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by title, keywords, summary, researcher..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {isLoading && <p className="text-gray-500">Searching...</p>}

      {data && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            Showing results for &ldquo;{query}&rdquo;
          </p>
          <div className="space-y-3">
            {data.results.map((award: Award & { rank?: number; organization_name_en?: string }) => (
              <Link
                key={`${award.application_id}-${award.fiscal_year}`}
                to={`/awards/${encodeURIComponent(award.application_id)}?fiscal_year=${award.fiscal_year}`}
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
              >
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {award.application_title || award.application_id}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {award.researcher_name}
                      {award.organization_name_en && ` · ${award.organization_name_en}`}
                    </p>
                  </div>
                  <span className="font-semibold text-green-700 whitespace-nowrap">
                    {currency.format(award.award_amount)}
                  </span>
                </div>
              </Link>
            ))}
            {data.results.length === 0 && (
              <p className="text-gray-500 text-center py-8">No results found.</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={data.results.length < data.limit}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {!query && (
        <p className="text-gray-400 text-center py-12">
          Enter a search term to find awards by title, keywords, summary, or researcher name.
        </p>
      )}
    </div>
  );
}
