-- Momentum — зеркало данных для синхронизации.
--
-- Приложение читает и пишет в IndexedDB. Эта база — не модель запросов,
-- а хранилище реплики: движок синхронизации отправляет сюда изменённые
-- записи и забирает чужие. Поэтому здесь одна таблица с jsonb-payload,
-- а не 13 таблиц с колонками под каждый TS-тип: изменение типа в
-- приложении не потребует миграции SQL.
--
-- Слияние — «побеждает более свежая запись» на уровне строки,
-- выполняется атомарно внутри Postgres (см. momentum_push).
--
-- Применить: в Supabase → SQL Editor → вставить и выполнить.

-- ---------- Таблица ----------
create table if not exists public.momentum_rows (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  table_name text        not null,
  row_id     text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  -- Метка времени записи. Сравнение по ней и есть разрешение конфликтов.
  updated_at timestamptz not null default now(),
  -- Tombstone: удаление отправляется как строка с заполненным deleted_at,
  -- иначе запись воскреснет из чужого устройства снова и снова.
  deleted_at timestamptz,
  primary key (user_id, table_name, row_id)
);

-- Тянущий индекс для запроса «что изменилось после моей метки».
create index if not exists momentum_rows_sync_idx
  on public.momentum_rows (user_id, updated_at);

-- ---------- Доступ ----------
-- Каждый видит и меняет только свои строки. Проверка идёт по auth.uid(),
-- то есть по подписанному токену, а не по переданному с клиента значению:
-- подделать user_id из браузера нельзя.
alter table public.momentum_rows enable row level security;

create policy "momentum_rows_select_own"
  on public.momentum_rows for select
  using (auth.uid() = user_id);

create policy "momentum_rows_insert_own"
  on public.momentum_rows for insert
  with check (auth.uid() = user_id);

create policy "momentum_rows_update_own"
  on public.momentum_rows for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Физическое удаление не даём: чистка делается по истечении retention,
-- чтобы устройство, которое долго было офлайн, не притащило обратно
-- то, что человек осознанно удалил.
create policy "momentum_rows_delete_own"
  on public.momentum_rows for delete
  using (auth.uid() = user_id);

-- ---------- Отправка: вставка пачки с разрешением конфликтов ----------
-- SECURITY INVOKER (по умолчанию) — политики RLS продолжают действовать,
-- поэтому чужие строки этой функцией не достать.
create or replace function public.momentum_push(rows jsonb)
returns void
language sql
as $$
  insert into public.momentum_rows (user_id, table_name, row_id, payload, updated_at, deleted_at)
  select
    auth.uid(),
    t.table_name,
    t.row_id,
    coalesce(t.payload, '{}'::jsonb),
    coalesce(t.updated_at, now()),
    t.deleted_at
  from jsonb_to_recordset(rows) as t(
    table_name text,
    row_id     text,
    payload    jsonb,
    updated_at timestamptz,
    deleted_at timestamptz
  )
  on conflict (user_id, table_name, row_id) do update
    set payload    = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
  -- Строка отстаёт по времени — оставляем её как есть.
  where momentum_rows.updated_at < excluded.updated_at;
$$;

-- ---------- Приём: всё, что изменилось после метки ----------
-- limit защищает от выкачивания всей баки, если метка вдруг потерялась.
create or replace function public.momentum_pull(since timestamptz, limit_rows int default 5000)
returns table (
  table_name text,
  row_id     text,
  payload    jsonb,
  updated_at timestamptz,
  deleted_at timestamptz
)
language sql
as $$
  select r.table_name, r.row_id, r.payload, r.updated_at, r.deleted_at
  from public.momentum_rows r
  where r.user_id = auth.uid()
    and r.updated_at > since
  order by r.updated_at asc
  limit limit_rows;
$$;

grant execute on function public.momentum_push(jsonb) to authenticated;
grant execute on function public.momentum_pull(timestamptz, int) to authenticated;

-- ---------- Настройки приложения ----------
-- Это единственные данные, которые НЕ помечены updated_at:
-- настройки — одна строка на пользователя, и конфликт решается
-- «кто записал последним», а не построчным слиянием.
create table if not exists public.momentum_profile (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.momentum_profile enable row level security;

create policy "momentum_profile_select_own"
  on public.momentum_profile for select
  using (auth.uid() = user_id);

create policy "momentum_profile_upsert_own"
  on public.momentum_profile for insert
  with check (auth.uid() = user_id);

create policy "momentum_profile_update_own"
  on public.momentum_profile for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
