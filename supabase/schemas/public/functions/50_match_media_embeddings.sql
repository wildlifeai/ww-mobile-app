-- Cosine k-NN over media_embeddings.embedding (pgvector). Replaces Qdrant search.
-- Filters by embedding_model so compared vectors share a dim; optionally scopes to
-- deployments and excludes the query media itself. Candidate sets are small
-- (deployment-scoped or a run's set), so an exact scan is fine — no ANN index yet.
-- plpgsql (not sql) so the body isn't validated at create time — functions are
-- seeded before tables in the declarative loader, and this references media_embeddings.
--
-- The embedding column is UNBOUNDED (mixed 384-d / 1280-d), so `<=>` must never be
-- evaluated on a row whose dim differs from the query. WHERE filters by model, but a
-- non-seqscan plan could evaluate the SELECT/ORDER-BY `<=>` before that filter and
-- raise "different vector dimensions". Wrapping `<=>` in a CASE on the same model
-- predicate short-circuits to NULL for any mismatched row, plan-independently.
create or replace function public.match_media_embeddings(
  query_embedding extensions.vector,
  p_model text,
  match_count int default 20,
  p_deployment_ids uuid[] default null,
  p_exclude_media_id uuid default null
)
returns table (media_id uuid, deployment_id uuid, cluster_id int, distance real)
language plpgsql
stable
as $$
begin
  return query
    select
      me.media_id,
      me.deployment_id,
      me.cluster_id,
      (case when me.embedding_model = p_model then me.embedding <=> query_embedding end)::real as distance
    from public.media_embeddings me
    where me.embedding is not null
      and me.embedding_model = p_model
      and (p_deployment_ids is null or me.deployment_id = any (p_deployment_ids))
      and (p_exclude_media_id is null or me.media_id <> p_exclude_media_id)
    order by case when me.embedding_model = p_model then me.embedding <=> query_embedding end
    limit match_count;
end;
$$;

-- No explicit GRANT: functions keep the default PUBLIC execute (default privileges
-- only revoke table/sequence access, not function EXECUTE), matching the other
-- functions here. service_role (the backend's caller) executes it via PUBLIC.
