-- دالة مساعدة لصلاحيات إدخال التقدّم/الحضور (مطلوبة قبل سياسات الخطط)
create or replace function public.can_manage_progress_entries(_user_id uuid, _tenant_id uuid, _circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.tenant_subscription_active(_tenant_id)
    and (
      exists (
        select 1
        from public.user_roles r
        join public.tenants t on t.id = r.tenant_id
        where r.user_id = _user_id
          and r.tenant_id = _tenant_id
          and r.role = 'teacher'
          and t.progress_entry_mode in ('teacher', 'both')
          and (r.circle_id is null or r.circle_id = _circle_id)
      )
      or exists (
        select 1
        from public.user_roles r
        join public.tenants t on t.id = r.tenant_id
        where r.user_id = _user_id
          and r.tenant_id = _tenant_id
          and r.role = 'supervisor'
          and t.progress_entry_mode in ('supervisor', 'both')
          and (r.circle_id is null or r.circle_id = _circle_id)
      )
    );
$$;
