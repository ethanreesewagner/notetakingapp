import { configureStore } from "@reduxjs/toolkit";
import pageReducer from "./pageSlice";

export const store = configureStore({
  reducer: {
    page: pageReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Since Firestore Timestamp has non-serializable fields
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
