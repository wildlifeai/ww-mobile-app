/**
 * AI Models RTK Query API
 * Redux Toolkit Query configuration for AI model management
 *
 * Features:
 * - Organisation-scoped AI model fetching
 * - Automatic caching and invalidation
 * - Type-safe hooks for React components
 * - Tag-based cache management
 *
 * Integration:
 * - Used by CreateProjectScreen for model selection
 * - Filters models by organisation_id for proper multi-tenancy
 */

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react"
import { getSupabaseClient } from "../../services/supabase"
import type { Database } from "../../types/database.types"
import { log, logError } from "../../utils/logger"

type AIModel = Database["public"]["Tables"]["ai_models"]["Row"]

export const aiModelsApi = createApi({
	reducerPath: "aiModelsApi",
	baseQuery: fakeBaseQuery(),
	tagTypes: ["AIModels"],
	endpoints: (builder) => ({
		// Get all AI models for organisation (accepts organisationId as parameter)
		getAIModels: builder.query<AIModel[], string>({
			queryFn: async (organisationId: string) => {
				log("🤖 RTK Query - getAIModels - STARTING")

				try {
					if (!organisationId) {
						logError("❌ No organisation ID provided")
						return {
							error: {
								status: "CUSTOM_ERROR",
								error: "Organisation ID is required",
							},
						}
					}

					log(
						`🤖 RTK Query - Fetching AI models for organisation: ${organisationId}`,
					)

					// Query ai_models table filtered by organisation_id
					const supabase = getSupabaseClient()
					const { data, error } = await supabase
						.from("ai_models")
						.select("*")
						.eq("organisation_id", organisationId)
						.is("deleted_at", null) // Exclude soft-deleted models
						.order("name", { ascending: true })

					if (error) {
						logError(`❌ RTK Query - getAIModels failed: ${error.message}`)
						return {
							error: {
								status: "CUSTOM_ERROR",
								error: error.message,
							},
						}
					}

					log(
						`✅ RTK Query - Retrieved ${data?.length || 0} AI models`,
					)
					log(
						`   Model names: ${data?.map((m: AIModel) => `${m.name} (${m.version})`).join(', ')}`,
					)

					return { data: data || [] }
				} catch (error) {
					logError(`❌ RTK Query - getAIModels exception: ${error instanceof Error ? error.message : String(error)}`)
					logError(
						`   Error details: ${JSON.stringify({
							message: error instanceof Error ? error.message : "Unknown",
							stack: error instanceof Error ? error.stack : undefined,
						})}`,
					)
					return {
						error: {
							status: "CUSTOM_ERROR",
							error: error instanceof Error ? error.message : String(error),
						},
					}
				}
			},
			providesTags: (result, _error, organisationId) =>
				result
					? [
						...result.map(({ id }) => ({ type: "AIModels" as const, id })),
						{ type: "AIModels", id: `ORG-${organisationId}` },
					]
					: [{ type: "AIModels", id: `ORG-${organisationId}` }],
		}),
	}),
})

// Export hooks for usage in functional components
export const { useGetAIModelsQuery } = aiModelsApi
