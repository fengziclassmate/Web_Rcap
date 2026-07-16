create or replace function public.delete_relationship_attachment_atomic(p_attachment_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  insert into public.relationship_storage_cleanup (user_id, storage_path)
  select current_user_id, storage_path from public.relationship_attachments
  where id = p_attachment_id and user_id = current_user_id
  on conflict (user_id, storage_path) do nothing;
  delete from public.relationship_attachments where id = p_attachment_id and user_id = current_user_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.delete_relationship_attachment_atomic(uuid) from public;
grant execute on function public.delete_relationship_attachment_atomic(uuid) to authenticated;
