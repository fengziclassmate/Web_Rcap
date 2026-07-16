drop policy if exists "relationship_storage_cleanup_insert_own" on public.relationship_storage_cleanup;
create policy "relationship_storage_cleanup_insert_own" on public.relationship_storage_cleanup
for insert to authenticated with check (auth.uid() = user_id);
