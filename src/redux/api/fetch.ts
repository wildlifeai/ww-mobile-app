import { fetchBaseQuery } from "@reduxjs/toolkit/query"
import { RootState } from ".."

// Lazy load config to avoid NativeModule access during initialization
let Config: any = null;
let _extendedBaseQuery: any = null;

const getConfig = () => {
  if (!Config) {
    Config = require("../../utils/environment").default;
  }
  return Config;
};

const createExtendedBaseQuery = () => {
  if (!_extendedBaseQuery) {
    _extendedBaseQuery = fetchBaseQuery({
      baseUrl: getConfig().API_BASE || '',
      prepareHeaders: (headers, { getState }) => {
        const token = (getState() as RootState).authentication.token

        // If we have a token set in state, let's assume that we should be passing it.
        if (token) {
          headers.set("Authorization", `Bearer ${token}`)
        }

        headers.set("Content-type", "application/json")

        return headers
      },
    });
  }
  return _extendedBaseQuery;
};

export const extendedBaseQuery = (args: any, api: any, extraOptions: any) => {
  return createExtendedBaseQuery()(args, api, extraOptions);
};
