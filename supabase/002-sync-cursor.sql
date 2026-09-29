-- Momentum — курсор приёма по порядковому номеру строки.
--
-- Зачем это нужно. Первая версия принимала изменения по метке времени
-- (`updated_at > since`). Метка ставится на сервере, и вся пачка, отправленная
-- одним запросом, получает одно и то же `now()`. Батч приёма ограничен
-- `limit`, поэтому последняя строка батча могла делить метку с ещё не
-- переданными строками — курсор перепрыгивал бы через них, и на другом
-- устройстве пропала бы часть изменений навсегда.
--
-- Порядковый номер (`seq`, identity) монотонен и уникален: «дальше курсора»
-- значит ровно «строки, которых ещё не видел», без пропусков и дублей.
-- Конфликты по-прежнему решает `updated_at` — он нужен только для выбора
-- победителя, а не для курсора.
--
-- Применять: в Supabase → SQL Editor → вставить и выполнить.
-- Повторный запуск безопасен: все операции через `if not exists` / `or replace`.

-- ---------- Порядковый номер ----------
alter table public.momentum_rows
  add column if not exists seq bigint generated always as identity;

create index if not exists momentum_rows_seq_idx
  on public.momentum_rows (user_id, seq);

-- ---------- Отправка ----------
-- Метку времени берём клиентскую: по ней «кто прав был раньше», а не «кто
-- отправил позже» — правка с телефона, сделанная минуту назад, не должна
-- проигрывать правке с компьютера, отправленной секунду назад.
--
-- Единственная корректировка — потолок в час вперёд. Часы устройства могут
-- уплыть (особенно в браузере без NTP), и метка из будущего зафиксировала бы
-- курсор приёма у всех остальных devices навсегда. Час вперёд не мешает
-- обычному порядку, но не даёт одной сбитой метке навредить всем.
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
    -- человека. Чистим на сервере, а не только на клиенте — иначе достаточно
    -- одного клиента постарше или чужой ручной вставки, чтобы содержимое
    -- удалённой записи осталось в облаке навсегда.
    case when t.deleted_at is not null then '{}'::jsonb else coalesce(t.payload, '{}'::jsonb) end,
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
        deleted_at = excluded.deleted_at
  -- Строка отстаёт по времени — оставляем её как есть.
  where momentum_rows.updated_at < excluded.updated_at;
$$;

-- ---------- Приём ----------
-- Старая сигнатура по метке времени больше не используется. Её нужно убрать:
-- PostgREST не выбирает между перегруженными одноимёнными функциями и ответил бы
-- ошибкой вместо вызова.
drop function if exists public.momentum_pull(timestamptz, int);

create or replace function public.momentum_pull(
  since_seq   bigint,
  limit_rows  int default 1000
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

-- Postgres по умолчанию даёт EXECUTE всем через PUBLIC, и anon — в их числе.
-- Само по себе это не утечка: RLS включён, политика отбирает auth.uid(), а у
-- анонимного запроса он NULL, поэтому функция вернёт пустое. Но лишние права
-- убираем, чтобы случайно отключённая политика не открыла чужие данные.
--
-- PUBLIC и anon снимаются отдельно и по разным причинам: у momentum_push
-- есть явный грант роли anon, и revoke from public его не трогает — проверить
-- можно запросом pg_proc.proacl.
revoke execute on function public.momentum_push(jsonb) from public, anon;
revoke execute on function public.momentum_pull(bigint, int) from public, anon;
grant execute on function public.momentum_push(jsonb) to service_role;
grant execute on function public.momentum_pull(bigint, int) to service_role;

-- PostgREST держит свой кэш схемы. Версия проекта перечитывает его сама,
-- но если после запуска функции всё ещё «не найдена» — эта строка чинит руками.
notify pgrst, 'reload schema';
