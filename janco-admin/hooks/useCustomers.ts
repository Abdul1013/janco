import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Customer, type CustomerDetail } from "@/lib/api";
import { toast } from "sonner";

interface CustomersFilter {
  page?: number;
  limit?: number;
  search?: string;
}

interface CustomersResponse {
  users: Customer[];
  count: number;
  page: number;
  limit: number;
}

export function useCustomers(filters: CustomersFilter = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);

  return useQuery<CustomersResponse>({
    queryKey: ["customers", filters],
    queryFn: () => api.get(`/v1/admin/users?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

export function useCustomerDetail(id: string | null) {
  return useQuery<CustomerDetail>({
    queryKey: ["customer", id],
    queryFn: () => api.get(`/v1/admin/users/${id}`),
    enabled: !!id,
  });
}

export function useEditCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      full_name,
      phone,
    }: {
      id: string;
      full_name?: string;
      phone?: string;
    }) => api.patch(`/v1/admin/users/${id}`, { full_name, phone }),
    onSuccess: (_, vars) => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", vars.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSuspendCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => api.patch(`/v1/admin/users/${id}/status`, { is_active }),
    onSuccess: (_, vars) => {
      toast.success(vars.is_active ? "Account reactivated" : "Account suspended");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", vars.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
