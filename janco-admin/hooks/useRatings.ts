import { useQuery } from "@tanstack/react-query";
import { api, type Rating } from "@/lib/api";

interface RatingsFilter {
  page?: number;
  limit?: number;
}

interface RatingsResponse {
  ratings: Rating[];
  count: number;
  page: number;
  limit: number;
}

export function useRatings(filters: RatingsFilter = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  return useQuery<RatingsResponse>({
    queryKey: ["ratings", filters],
    queryFn: () => api.get(`/v1/admin/ratings?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}
