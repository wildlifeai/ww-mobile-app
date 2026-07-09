-- Cosine k-NN over media_embeddings.embedding (pgvector). Replaces Qdrant search.
-- Filters by embedding_model so compared vectors share a dim; optionally scopes to
-- deployments and excludes the query media itself. Candidate sets are small
-- (deployment-scoped or a run's set), so an exact scan is fine — no ANN index yet.
create or replace function public.match_media_embeddings(
  query_embedding extensions.vector,
  p_model text,
  match_count int default 20,
  p_deployment_ids uuid[] default null,
  p_exclude_media_id uuid default null
)
returns table (media_id uuid, deployment_id uuid, cluster_id int, distance real)
language sql
stable
as $$
  select
    me.media_id,
    me.deployment_id,
    me.cluster_id,
    (me.embedding <=> query_embedding)::real as distance
  from public.media_embeddings me
  where me.embedding is not null
    and me.embedding_model = p_model
    and (p_deployment_ids is null or me.deployment_id = any (p_deployment_ids))
    and (p_exclude_media_id is null or me.media_id <> p_exclude_media_id)
  order by me.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_media_embeddings(extensions.vector, text, int, uuid[], uuid) to service_role;
