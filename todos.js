'use strict';

const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const flash = require('express-flash');
const TodoList = require('./lib/todolist');

const app = express();
const host = 'localhost';
const port = 3000;

let todoLists = require('./lib/seed-data');
const { sortTodos, sortTodoLists } = require('./lib/sort');

app.set('views', './views');
app.set('view engine', 'pug');

app.use(morgan('common'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'todos-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'this is not very secure',
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

const loadTodoList = (todoListId) => {
  return todoLists.find(list => {
    return list.id === Number(todoListId);
  });
};

app.get('/', (req, res) => {
  res.redirect('/lists');
});

app.get('/lists', (req, res) => {
  res.render('lists', {
    todoLists: sortTodoLists(todoLists),
  });
});

app.get('/lists/new', (req, res) => {
  res.render('new-list');
});

app.get('/lists/:todoListId', (req, res, next) => {
  let { todoListId } = req.params;
  let todoList = loadTodoList(todoListId);

  if (todoList === undefined) {
    next(new Error('Not found.'));
  } else {
    res.render('list', {
      todoList,
      todos: sortTodos(todoList)
    });
  }
});

app.post('/lists',
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('The list title is required.')
      .bail()
      .isLength({ max: 100})
      .withMessage('The title must be less than 100 characters')
      .bail()
      .custom(title => {
        return todoLists.every(list => list.title !== title);
      })
      .withMessage('List title already in use.')
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash('error', error.msg));
      res.render('new-list', {
        flash: req.flash(),
        title: req.body.todoListTitle,
      });

    } else {
      todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash('success', 'The todo list has been created.');
      res.redirect('/lists');
    }
  }
);

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log(`Listening on port ${port} of ${host}`);
});