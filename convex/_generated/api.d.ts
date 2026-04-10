/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as attestations from "../attestations.js";
import type * as channels from "../channels.js";
import type * as conversations from "../conversations.js";
import type * as messageRequests from "../messageRequests.js";
import type * as messages from "../messages.js";
import type * as seedAgents from "../seedAgents.js";
import type * as seedChannels from "../seedChannels.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  attestations: typeof attestations;
  channels: typeof channels;
  conversations: typeof conversations;
  messageRequests: typeof messageRequests;
  messages: typeof messages;
  seedAgents: typeof seedAgents;
  seedChannels: typeof seedChannels;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
