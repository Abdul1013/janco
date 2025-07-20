import { supabase } from "../lib/supabase";
import { useAuth } from "./authContext";
import { useState, useEffect } from "react";

export const useJanitorProfile = (userId) => {
  const [availability, setAvailability] = useState(false);
  const [jobs, setJobs] = useState([]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("janitors")
      .select("availability ")
      .eq("janitor_id", userId)
      .single();

    if (data) setAvailability(data.availability);
  };

  const updateAvailability = async () => {
    setAvailability(value);
    const { data, error } = await supabase
      .from("janitor")
      .update({ availability: value })
      .eq("janitor_id", userId);
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("janitor_id", userId)
      .order("scheduled_date", { ascending: true });

    if (data) setJobs(data);
  };

  const completeJob = async (jobId) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "completed" })
      .eq("id", jobId);

    if (!error) await fetchJobs();
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchJobs();
    }
  }, [userId]);

  return {
    availability,
    updateAvailability,
    jobs,
    completeJob,
  };
};
