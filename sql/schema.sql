-- Nossas Receitas · Schema Supabase
-- Execute este SQL no Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- Uso pessoal/familiar: RLS com leitura/escrita pública (proteja seu link)

-- ============================================================
-- 1. Tabelas
-- ============================================================

create table if not exists public.categorias (
  id         text primary key,
  nome       text not null,
  icone      text default '🍽️',
  cor        text default '#C4845A',
  ordem      int  default 100,
  criado_em  timestamptz default now()
);

create table if not exists public.receitas (
  id             text primary key,
  titulo         text not null,
  categoria_id   text references public.categorias(id) on delete set null,
  categoria_nome text,
  tags           jsonb default '[]'::jsonb,
  tempo_preparo  text default '',
  tempo_forno    text default '',
  porcoes        int default 0,
  dificuldade    text default 'Facil',
  foto           text default '',
  foto_thumb     text default '',
  ingredientes   jsonb default '[]'::jsonb,
  modo_preparo   jsonb default '[]'::jsonb,
  dica           text default '',
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create index if not exists receitas_categoria_idx on public.receitas(categoria_id);
create index if not exists receitas_atualizado_idx on public.receitas(atualizado_em desc);

-- ============================================================
-- 2. RLS (acesso público simples)
-- ============================================================

alter table public.categorias enable row level security;
alter table public.receitas   enable row level security;

drop policy if exists "leitura publica categorias" on public.categorias;
drop policy if exists "escrita publica categorias" on public.categorias;
drop policy if exists "leitura publica receitas"   on public.receitas;
drop policy if exists "escrita publica receitas"   on public.receitas;

create policy "leitura publica categorias" on public.categorias for select using (true);
create policy "escrita publica categorias" on public.categorias for all    using (true) with check (true);

create policy "leitura publica receitas"   on public.receitas   for select using (true);
create policy "escrita publica receitas"   on public.receitas   for all    using (true) with check (true);

-- ============================================================
-- 3. Categorias padrão (as 4 da tela de índice)
-- ============================================================

insert into public.categorias (id, nome, icone, cor, ordem) values
  ('doces',   'Doces & Sobremesas', '🍰', '#C4845A', 1),
  ('massas',  'Massas & Grãos',     '🍝', '#A0522D', 2),
  ('carnes',  'Carnes & Aves',      '🥩', '#8B4513', 3),
  ('saladas', 'Saladas & Entradas', '🥗', '#6B7C5C', 4)
on conflict (id) do update set
  nome  = excluded.nome,
  icone = excluded.icone,
  cor   = excluded.cor,
  ordem = excluded.ordem;
