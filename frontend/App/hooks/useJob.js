import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function useJobs(initialJobId = null) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(initialJobId);

  //hooks tp fetch Job by ID

  const fetchJob = async (id = jobId) => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Fetched Job Error ", error);
    } else {
      setJob(data);
    }
    setLoading(false);
  };

  //check for status every 10sec
  useEffect(() => {
    if (!jobId) return;
    fetchJob();

    const interval = setInterval(() => {
      fetchJob();
    }, 10000);

    return () => clearInterval(interval); //clean up function
  }, [jobId]);
  //create a new job

  const createJob = async (bookingData) => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("jobs")
      .insert([
        {
          ...bookingData,
          user_id: user.id, //fetch from local store
          status: "pending",
          payment_status: "unpaid",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Job creation failed: ", error);
      throw error;
    } else {
      setJob(data);
      setJobId(data.id);
      return data;
    }
  };
  //job status update

  const updateJobStatus = async (newStatus) => {
    if (!job?.id) return;

    const { data, error } = await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", job.id)
      .select()
      .single();

    if (error) {
      console.error("Update Status Error: ", error);
    } else {
      setJob(data);
    }
  };
  return {job,loading,createJob,updateJobStatus,setJobId};
}

// Convert polling (setInterval) to Supabase real-time (Postgres changes over WebSocket).

// Use supabase.channel().on('postgres_changes', ...) to listen to jobs table in real-time.