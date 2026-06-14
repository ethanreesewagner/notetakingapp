"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { setActivePageId } from "../store/pageSlice";

export default function PageRouteSync({ pageId }: { pageId: string }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { pages } = useSelector((state: RootState) => state.page);

  useEffect(() => {
    if (!pageId) return;

    const page = pages.find((p) => p.id === pageId);
    if (page) {
      dispatch(setActivePageId(pageId));
      return;
    }

    if (pages.length > 0) {
      router.replace("/");
    }
  }, [pageId, pages, dispatch, router]);

  return null;
}
