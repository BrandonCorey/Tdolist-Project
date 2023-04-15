INSERT INTO todolists (title)
  VALUES ('Work Todos'),
         ('Home Todos'),
         ('Additional Todos'),
         ('social todos');

-- Note: in the following statement, get the todo list IDs from
-- the todolists table. If the todo list IDs are 1, 2, 3, and 4, then our code looks like this:
INSERT INTO todos (title, done, todolist_id)
  VALUES ('Get coffee', TRUE, 1),
         ('Chat with co-workers', TRUE, 1),
         ('Duck out of meeting', FALSE, 1),
         ('Feed the cats', TRUE, 2),
         ('Go to bed', TRUE, 2),
         ('Buy milk', TRUE, 2),
         ('Study for Launch School', TRUE, 2),
         ('Go to Libby''s birthday party', FALSE, 4);