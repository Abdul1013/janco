import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Application, type Janitor, type JanitorDetail } from "@/lib/api";
import { toast } from "sonner";

interface ApplicationsResponse {
  applications: Application[];
  count: number;
}

interface JanitorsResponse {
  janitors: Janitor[];
  count: number;
}

export function useApplications(status?: string) {
  const params = status ? `?status=${status}` : "";
  return useQuery<Application[]>({
    queryKey: ["applications", status],
    queryFn: () =>
      api.get<ApplicationsResponse>(`/v1/admin/applications${params}`)
        .then((r) => r.applications),
  });
}

export function useApplication(id: string | null) {
  return useQuery<Application>({
    queryKey: ["application", id],
    queryFn: () => api.get(`/v1/admin/applications/${id}`),
    enabled: !!id,
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: "approved" | "rejected";
      notes?: string;
    }) => api.patch(`/v1/admin/applications/${id}`, { status, notes }),
    onSuccess: (_, vars) => {
      toast.success(`Application ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActiveJanitors() {
  return useQuery<Janitor[]>({
    queryKey: ["janitors-active"],
    queryFn: () =>
      api.get<JanitorsResponse>("/v1/admin/janitors/active")
        .then((r) => r.janitors),
  });
}

export function useJanitorDetail(id: string | null) {
  return useQuery<JanitorDetail>({
    queryKey: ["janitor", id],
    queryFn: () => api.get(`/v1/admin/janitors/${id}`),
    enabled: !!id,
  });
}

export function useCreateJanitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      full_name: string;
      phone: string;
      address: string;
      service_types: string[];
      experience?: string;
      bio?: string;
    }) => api.post("/v1/admin/janitors", payload),
    onSuccess: () => {
      toast.success("Janitor account created and approved");
      qc.invalidateQueries({ queryKey: ["janitors-active"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
