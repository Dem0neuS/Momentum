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
create sequence if not exists public.momentum_rows_seq_seq as bigint;

create table if not exists public.momentum_rows (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  table_name text        not null,
  row_id     text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  -- Метка времени записи. Сравнение по ней и есть разрешение конфликтов
  -- («у кого правка свежее — тот и победил»), а не порядок доставки.
  updated_at timestamptz not null default now(),
  -- Tombstone: удаление отправляется как строка с заполненным deleted_at,
  -- иначе запись воскреснет из чужого устройства снова и снова.
  deleted_at timestamptz,
  -- Порядковый номер строки. Курсор приёма держится по нему, а не по
  -- updated_at: вся пачка одного запроса получает одно `now()`, и приём по
  -- метке времени терял бы строки, попавшие на границу батча.
  --
  -- Колонка намеренно НЕ identity, а обычный bigint с default из
  -- именованной последовательности: номер обязан меняться при каждой записи,
  -- включая обновление. С identity номер выдавался бы один раз — при вставке,
  -- и правка существующей строки навсегда оставалась бы за уже отданным
  -- курсором, то есть не доезжала бы до других устройств. Подробнее —
  -- в supabase/002-sync-cursor.sql и supabase/003-seq-on-update.sql.
  seq        bigint      not null default nextval('public.momentum_rows_seq_seq'),
  primary key (user_id, table_name, row_id)
);

grant usage, select on sequence public.momentum_rows_seq_seq to authenticated, service_role;

-- Тянущий индекс для запроса «что изменилось после моей метки».
create index if not exists momentum_rows_sync_idx
  on public.momentum_rows (user_id, updated_at);

-- Тянущий индекс для приёма: «дай следующие N строк после курсора».
create index if not exists momentum_rows_seq_idx
  on public.momentum_rows (user_id, seq);

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
    -- Удалённой строке полезные данные не нужны: приём смотрит только на
    -- deleted_at, а payload остался бы лежать в базе как забытые данные
    -- человека. Чистим на сервере, а не только на клиенте.
    case when t.deleted_at is not null then '{}'::jsonb else coalesce(t.payload, '{}'::jsonb) end,
    -- Потолок в час вперёд: метка из будущего (часы устройства уплыли) иначе
    -- зафиксировала бы курсор приёма у всех остальных devices навсегда.
    least(coalesce(t.updated_at, now()), now() + interval '1 hour'),
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
        deleted_at = excluded.deleted_at,
        -- Курсор двигается на каждой записи. Без этого правка глубоко
        -- лежащей в базе строки не переносилась бы за уже отданный курсор
        -- и оставалась бы незамеченной другими устройствами навсегда.
        seq        = nextval('public.momentum_rows_seq_seq')
  -- Строка отстаёт по времени — оставляем её как есть: нового для приёма
  -- тут ничего не появилось, поэтому и курсор не двигаем.
  where momentum_rows.updated_at < excluded.updated_at;
$$;

-- ---------- Приём: следующие строки после курсора ----------
-- Курсор — порядковый номер (seq), а не метка времени: монотонный и без
-- совпадений, поэтому «дальше курсора» — это ровно «ещё не видел», без
-- пропусков на границе батча.
create or replace function public.momentum_pull(
  since_seq  bigint,
  limit_rows int default 1000
)
returns table (
  seq        bigint,
  table_name text,
  row_id     text,
  payload    jsonb,
  updated_at timestamptz,
  deleted_at timestamptz
)
language sql
stable
as $$
  select r.seq, r.table_name, r.row_id, r.payload, r.updated_at, r.deleted_at
  from public.momentum_rows r
  where r.user_id = auth.uid()
    and r.seq > since_seq
  order by r.seq asc
  limit greatest(1, least(limit_rows, 5000));
$$;

grant execute on function public.momentum_push(jsonb) to authenticated;
grant execute on function public.momentum_pull(bigint, int) to authenticated;

-- EXECUTE по умолчанию выдаётся всем через PUBLIC, и anon в их числе. Убираем
-- лишнее: RLS и так не отдаст анонимному запросу чужие строки, но лишние
-- права при отключённой политике стали бы утечкой. PUBLIC и anon снимаются
-- отдельно — явный грант anon не снимается через revoke from public.
revoke execute on function public.momentum_push(jsonb) from public, anon;
revoke execute on function public.momentum_pull(bigint, int) from public, anon;
grant execute on function public.momentum_push(jsonb) to service_role;
grant execute on function public.momentum_pull(bigint, int) to service_role;

-- ---------- Профиль пользователя (зарезервировано) ----------
-- Настройки приложения синхронизируются обычной строкой в momentum_rows
-- (table_name = 'settings', row_id = 'app'): это одна запись, и построчное
-- слияние для неё даёт тот же результат, что и «кто записал последним»,
-- но без отдельного пути в коде и без второй таблицы.
--
-- Таблица остаётся на случай будущего серверного профиля (аватар, дата
-- регистрации). Сейчас приложение её не пишет — это нормально, RLS включён.
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
