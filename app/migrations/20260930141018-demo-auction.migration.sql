-- demo auction: one admin, four bidders, twelve lots

insert into users (email, name, role, passwordHash) values
  ('admin@gavelrush.test', 'Morgan Reyes', 'admin', crypt('admin-pass', genSalt('bf', 12))),
  ('ada@gavelrush.test', 'Ada Lovelace', 'bidder', crypt('bidder-pass', genSalt('bf', 12))),
  ('grace@gavelrush.test', 'Grace Hopper', 'bidder', crypt('bidder-pass', genSalt('bf', 12))),
  ('alan@gavelrush.test', 'Alan Turing', 'bidder', crypt('bidder-pass', genSalt('bf', 12))),
  ('katherine@gavelrush.test', 'Katherine Johnson', 'bidder', crypt('bidder-pass', genSalt('bf', 12)));

insert into lots (number, title, description, startingBid, increment, closesAt) values
  (1, 'Vintage 35mm film camera',
   'A serviced 1970s 35mm SLR with a 50 mm f/1.7 lens, a leather strap and ten rolls of colour film. Donated by a local photo studio, which adds a one-hour lesson.',
   80, 5, now() + interval '12 minutes'),
  (2, 'Weekend at a mountain lodge',
   'Two nights for two at a timber lodge above the cloud line, with breakfast each morning and a guided sunrise hike. Valid any weekend through next autumn.',
   400, 25, now() + interval '3 hours'),
  (3, 'Two original paintings',
   'A bold abstract in acrylic (60 x 80 cm) and a floral still life in oils after the Dutch masters (50 x 60 cm), both by artists from the community studio. Framing included.',
   300, 25, now() + interval '9 hours'),
  (4, 'Chef''s table dinner for six',
   'A five-course dinner cooked in your own kitchen by the head chef of a neighbourhood bistro, with wine pairings and cleanup.',
   500, 50, now() + interval '20 hours'),
  (5, 'Case of reserve red wine',
   'Twelve bottles of estate reserve red from a family vineyard, with a private tasting for eight at the cellar door.',
   250, 20, now() + interval '1 day 4 hours'),
  (6, 'Studio wireless headphones',
   'Over-ear noise-cancelling headphones, new in the box, with a travel case and two-year warranty.',
   120, 10, now() + interval '1 day 11 hours'),
  (7, 'Hand-thrown stoneware pair',
   'A pitcher and a tall bud vase in matte white glaze, thrown and fired by a local potter. The pitcher holds a litre and a half.',
   90, 10, now() + interval '1 day 22 hours'),
  (8, 'Round of golf for four',
   'Eighteen holes for four players at the country club, with carts, range balls and lunch at the clubhouse.',
   350, 25, now() + interval '2 days 6 hours'),
  (9, 'Leather-bound classics',
   'Eight antique leather-bound volumes from a retired bookbinder''s collection, restored and boxed, plus a hand-bound notebook.',
   150, 10, now() + interval '2 days 15 hours'),
  (10, 'Backstage concert passes',
   'Two floor tickets and backstage passes for the closing night of the summer festival, with a meet and greet after the set.',
   300, 25, now() + interval '3 days 2 hours'),
  (11, 'Silver chronograph watch',
   'A stainless steel automatic chronograph with a silver dial and black leather strap, water resistant to 100 m. Serviced and boxed, with papers.',
   1500, 100, now() + interval '3 days 12 hours'),
  (12, 'Red cruiser bike',
   'A step-through steel cruiser in cherry red with a sprung saddle, chrome fenders and a rear rack, sized for riders 160 to 185 cm. Includes a lock and lights.',
   450, 25, now() + interval '4 days 1 hour');

insert into lotPhotos (lotId, position, name, contentType, asset)
  select l.id, p.position, p.asset || '.jpg', 'image/jpeg', p.asset
    from (values
      (1, 0, 'camera-1'), (1, 1, 'camera-2'),
      (2, 0, 'cabin-1'), (2, 1, 'cabin-2'),
      (3, 0, 'painting-1'), (3, 1, 'painting-2'),
      (4, 0, 'dinner-1'), (4, 1, 'dinner-2'),
      (5, 0, 'wine-1'),
      (6, 0, 'headphones-1'),
      (7, 0, 'ceramics-1'), (7, 1, 'ceramics-2'),
      (8, 0, 'golf-1'), (8, 1, 'golf-2'),
      (9, 0, 'books-1'), (9, 1, 'books-2'),
      (10, 0, 'concert-1'), (10, 1, 'concert-2'),
      (11, 0, 'watch-1'),
      (12, 0, 'bike-1')
    ) as p (lotNumber, position, asset)
    join lots l on l.number = p.lotNumber;

-- Each bid is minutes older than the next, so the history reads in order.
insert into bids (lotId, userId, amount, createdAt)
  select l.id, u.id, b.amount, now() - (b.ago * interval '1 minute')
    from (values
      (1, 'katherine', 80, 200), (1, 'alan', 85, 120), (1, 'grace', 95, 70), (1, 'ada', 105, 25),
      (2, 'ada', 400, 180), (2, 'grace', 425, 150), (2, 'alan', 450, 90), (2, 'ada', 500, 40),
      (3, 'grace', 300, 300), (3, 'katherine', 350, 240), (3, 'grace', 375, 60),
      (4, 'alan', 500, 400), (4, 'ada', 550, 320), (4, 'katherine', 600, 200), (4, 'alan', 700, 30),
      (5, 'grace', 250, 100),
      (6, 'ada', 120, 500), (6, 'katherine', 130, 250),
      (8, 'alan', 350, 90), (8, 'grace', 375, 45),
      (9, 'katherine', 150, 60),
      (10, 'ada', 300, 700), (10, 'grace', 325, 600), (10, 'alan', 350, 420), (10, 'katherine', 400, 100), (10, 'ada', 450, 20),
      (11, 'alan', 1500, 800),
      (12, 'grace', 450, 350), (12, 'ada', 475, 300)
    ) as b (lotNumber, who, amount, ago)
    join lots l on l.number = b.lotNumber
    join users u on u.email = b.who || '@gavelrush.test';

update lots l
   set currentBid = top.amount,
       topBidderId = top.userId,
       bidCount = top.n
  from (
    select distinct on (lotId) lotId, amount, userId, count(*) over (partition by lotId) as n
      from bids
     order by lotId, amount desc
  ) top
 where top.lotId = l.id;

insert into watches (lotId, userId)
  select distinct lotId, userId from bids;

insert into watches (lotId, userId)
  select l.id, u.id
    from lots l, users u
   where (l.number, u.email) in ((7, 'ada@gavelrush.test'), (11, 'grace@gavelrush.test'), (11, 'katherine@gavelrush.test'))
      on conflict do nothing;

select setval(pg_get_serial_sequence('lots', 'number'), (select max(number) from lots));
