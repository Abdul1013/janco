import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Admin, type AdminLevel } from "@/lib/api";
import { toast } from "sonner";

interface AdminsResponse {
  admins: Admin[];
  count: number;
}

export function useAdmins() {
  return useQuery<Admin[]>({
    queryKey: ["admins"],
    queryFn: () =>
      api.get<AdminsResponse>("/v1/admin/admins").then((r) => r.admins),
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      full_name: string;
      level: AdminLevel;
    }) => api.post("/v1/admin/admins", payload),
    onSuccess: () => {
      toast.success("Admin account created");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetAdminLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, level }: { id: string; level: AdminLevel }) =>
      api.patch(`/v1/admin/admins/${id}/level`, { level }),
    onSuccess: () => {
      toast.success("Admin level updated");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/v1/admin/admins/${userId}`),
    onSuccess: () => {
      toast.success("Admin role revoked");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
