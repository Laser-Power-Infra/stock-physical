import { configureStore } from "@reduxjs/toolkit";
import gmdUpdateReducer from "./gmdUpdateSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      gmdUpdate: gmdUpdateReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];