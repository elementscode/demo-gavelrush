-- auction schema

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

-- Bids, closes and payments are written by rpc, jobs and webhooks, not through
-- a LiveTable view, so the write itself is the broadcast. The payload is the
-- id alone; each app server reads the row back through the view's select,
-- which is where the joins live. The argument is the table's name, which is
-- its LiveTable's channel.
create or replace function notifyRowId()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  r := coalesce(new, old);

  perform pg_notify(channel_name(tg_argv[0]), json_build_object('op', lower(tg_op), 'id', r.id)::text);

  return r;
end;
$$;

create type userRole as enum ('bidder', 'admin');

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  name text not null,
  passwordHash text not null,
  role userRole not null default 'bidder'
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

-- Amounts are whole dollars. status is open until the close job runs;
-- paymentStatus is none (no winner), unpaid, or paid.
create table lots (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  number serial not null unique,
  title text not null,
  description text not null default '',
  startingBid integer not null check (startingBid > 0),
  increment integer not null check (increment > 0),
  closesAt timestamptz not null,
  currentBid integer,
  bidCount integer not null default 0,
  topBidderId uuid references users (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  winnerId uuid references users (id),
  closedAt timestamptz,
  paymentStatus text not null default 'none' check (paymentStatus in ('none', 'unpaid', 'paid')),
  paidAt timestamptz
);

create index lotsOpenClosesAtIdx on lots (closesAt) where status = 'open';

create trigger lotsTouchUpdatedAt
  before update on lots
  for each row execute function touchUpdatedAt();

create trigger lotsNotify
  after insert or update or delete on lots
  for each row execute function notifyRowId('lots');

-- A photo is either uploaded bytes or, for the seeded lots, the name of a file
-- shipped under app/shared/assets/lots.
create table lotPhotos (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  lotId uuid not null references lots (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  contentType text not null,
  data bytea,
  asset text,
  hash text generated always as (coalesce(encode(sha256(data), 'hex'), md5(asset))) stored,
  check ((data is null) <> (asset is null))
);

create index lotPhotosLotIdx on lotPhotos (lotId, position);

create trigger lotPhotosTouchUpdatedAt
  before update on lotPhotos
  for each row execute function touchUpdatedAt();

create table bids (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  lotId uuid not null references lots (id) on delete cascade,
  userId uuid not null references users (id),
  amount integer not null
);

create index bidsLotIdx on bids (lotId, amount desc);

create trigger bidsTouchUpdatedAt
  before update on bids
  for each row execute function touchUpdatedAt();

create trigger bidsNotify
  after insert or update or delete on bids
  for each row execute function notifyRowId('bids');

create table watches (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  lotId uuid not null references lots (id) on delete cascade,
  userId uuid not null references users (id) on delete cascade,
  unique (lotId, userId)
);

create trigger watchesTouchUpdatedAt
  before update on watches
  for each row execute function touchUpdatedAt();

create trigger watchesNotify
  after insert or update or delete on watches
  for each row execute function notifyRowId('watches');

-- stripeSessionId is unique because the return page and the webhook can both
-- record the same payment.
create table payments (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  stripeSessionId text not null unique,
  lotId uuid not null references lots (id),
  userId uuid not null references users (id),
  amountTotal integer not null,
  currency text not null
);

create trigger paymentsTouchUpdatedAt
  before update on payments
  for each row execute function touchUpdatedAt();
