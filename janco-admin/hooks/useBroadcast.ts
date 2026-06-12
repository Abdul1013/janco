import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type Broadcast,
  type BroadcastChannel,
  type BroadcastAudience,
} from "@/lib/api";
import { toast } from "sonner";

interface BroadcastHistoryResponse {
  broadcasts: Broadcast[];
  count: number;
  page: number;
  limit: number;
}

interface SendBroadcastPayload {
  channel: BroadcastChannel;
  audience: BroadcastAudience;
  target_id?: string;
  subject?: string;
  body: string;
}

export function useBroadcastHistory(page = 1, limit = 30) {
  return useQuery<BroadcastHistoryResponse>({
    queryKey: ["broadcasts", page, limit],
    queryFn: () =>
      api.get(`/v1/admin/broadcast/history?page=${page}&limit=${limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendBroadcastPayload) =>
      api.post<{ broadcast_id: string; recipients_count: number }>(
        "/v1/admin/broadcast",
        payload
      ),
    onSuccess: (res) => {
      toast.success(`Broadcast queued for ${res.recipients_count} recipient(s)`);
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
