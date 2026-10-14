import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { axiosInstance } from "../../../api/axiosinstance";
import { forgetSession } from "../../../api/queryClient";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => axiosInstance.post("/auth/logout"),
    // Even if the request fails, this browser is logged out: drop everything
    // cached, so the next person at this screen sees nothing of the last one.
    // Done here (not in the button's own callback): the page unmounts as soon
    // as the user is gone, and a callback on an unmounted page never runs.
    onSettled: () => {
      forgetSession(queryClient);
      navigate("/login", { replace: true });
      toast.success("Logged out");
    },
  });
}
