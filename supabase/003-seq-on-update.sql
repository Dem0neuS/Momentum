-- Momentum — курсор приёма должен двигаться при каждой записи, а не только
-- при первой.
--
-- Предыдущая версия объявляла `seq bigint generated always as identity`.
-- Такое `seq` присваивается один раз — при вставке строки. Ветка
-- `on conflict ... do update` его не трогала, а это ломало приём:
--
--   устройство А создаёт привычку            → seq = 100, А запоминает курсор 100
--   устройство Б переименовывает её позже    → seq остаётся 100
--   устройство А тянет изменения после 100   → правку переименования не видит никогда
--
-- Строка не «приезжает второй раз»: она навсегда остаётся позади курсора.
-- Пока обмен шёл только свежими записями, это не проявлялось — правки
-- привычки на втором устройстве просто не доезжали.
--
-- Лечится тем, что `seq` становится обычной колонкой со значением из
-- именованной последовательности, а ветка конфликта двигает её через
-- `nextval`. Порядок сохраняется: и вставка, и обновление берут номер из
-- одной монотонной последовательности.
--
-- Куда применить: в Supabase → SQL Editor → вставить и выполнить. Повторный
-- запуск безопасен: все шаги через `if not exists` / `if exists`.

-- Сначала снимаем identity. Порядок именно такой: `drop identity` удаляет и
-- собственную последовательность колонки, поэтому создавать её надо уже
-- после этого шага — иначе default сослался бы на несуществующее имя.
alter table public.momentum_rows
  alter column seq drop identity if exists;

-- Именованная последовательность: на неё ссылаются и default колонки,
-- и ветка конфликта в momentum_push.
create sequence if not exists public.momentum_rows_seq_seq as bigint;

alter table public.momentum_rows
  alter column seq set default nextval('public.momentum_rows_seq_seq');

-- nextval из функции идёт от имени вошедшего пользователя, поэтому доступ к
-- последовательности нужен явно, а не «по умолчанию».
grant usage, select on sequence public.momentum_rows_seq_seq to authenticated, service_role;

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
    -- зафиксировала бы разрешение конфликтов у всех остальных devices.
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
        -- Главное отличие от прежней версии: обновление двигает курсор.
        -- Без этого правка существующей строки была бы видна только тем,
        -- у кого курсор ещё не прошёл мимо её исходного номера.
        seq        = nextval('public.momentum_rows_seq_seq')
  -- Строка отстаёт по времени — оставляем её как есть, и курсор не двигаем:
  -- ничего нового для приёма здесь не появилось.
  where momentum_rows.updated_at < excluded.updated_at;
$$;

grant execute on function public.momentum_push(jsonb) to authenticated;
revoke execute on function public.momentum_push(jsonb) from public, anon;
grant execute on function public.momentum_push(jsonb) to service_role;

-- Уже существующие строки поднимаем: у них номера выданы до перехода, и
-- устройства, курсор которых прошёл мимо, иначе не увидят накопленное.
--
-- Порядок обязателен: сначала последовательность догоняется до текущего
-- максимума, и только потом строки перенумеровываются. Иначе она отсчитает
-- номера с единицы (свежесозданная последовательность), и все строки разом
-- окажутся позади курсоров, которые устройства уже получили.
select setval(
  'public.momentum_rows_seq_seq',
  greatest(
    (select coalesce(max(seq), 0) from public.momentum_rows),
    (select last_value from public.momentum_rows_seq_seq)
  ),
  true
);

update public.momentum_rows r
   set seq = nextval('public.momentum_rows_seq_seq');

notify pgrst, 'reload schema';
