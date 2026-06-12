import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type FinanceSummary, type Payout, type Expense } from "@/lib/api";
import { toast } from "sonner";

interface PayoutsResponse {
  payouts: Payout[];
  count: number;
  commission_rate: number;
  days: number;
}

interface ExpensesResponse {
  expenses: Expense[];
  count: number;
  page: number;
  limit: number;
}

export function useFinanceSummary(days = 30) {
  return useQuery<FinanceSummary>({
    queryKey: ["finance-summary", days],
    queryFn: () => api.get(`/v1/admin/finance/summary?days=${days}`),
    refetchInterval: 120_000,
  });
}

export function usePayouts(days = 30) {
  return useQuery<PayoutsResponse>({
    queryKey: ["finance-payouts", days],
    queryFn: () => api.get(`/v1/admin/finance/payouts?days=${days}`),
  });
}

export function useExpenses(page = 1, limit = 30) {
  return useQuery<ExpensesResponse>({
    queryKey: ["finance-expenses", page, limit],
    queryFn: () => api.get(`/v1/admin/finance/expenses?page=${page}&limit=${limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      category: string;
      description: string;
      amount: number;
      incurred_on?: string;
    }) => api.post("/v1/admin/finance/expenses", payload),
    onSuccess: () => {
      toast.success("Expense recorded");
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/admin/finance/expenses/${id}`),
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
