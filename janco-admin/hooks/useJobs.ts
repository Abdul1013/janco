import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Job } from "@/lib/api";
import { toast } from "sonner";

interface JobsFilter {
  page?: number;
  limit?: number;
  status?: string;
  payment_status?: string;
}

interface JobsResponse {
  jobs: Job[];
  count: number;  // total matching rows
  page: number;
  limit: number;
}

export function useJobs(filters: JobsFilter = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.status) params.set("status", filters.status);
  if (filters.payment_status) params.set("payment_status", filters.payment_status);

  return useQuery<JobsResponse>({
    queryKey: ["jobs", filters],
    queryFn: () => api.get(`/v1/admin/jobs?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

export function useJob(id: string | null) {
  return useQuery<Job>({
    queryKey: ["job", id],
    queryFn: () => api.get(`/v1/admin/jobs/${id}`),
    enabled: !!id,
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/v1/admin/jobs/${id}`, { status }),
    onSuccess: () => {
      toast.success("Job status updated");
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch(`/v1/admin/jobs/${id}/pay`),
    onSuccess: () => {
      toast.success("Payment marked as paid");
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
