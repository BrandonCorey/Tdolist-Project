'use strict';

const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const flash = require('express-flash');
const store = require('connect-loki');
const TodoList = require('./lib/todolist');
const Todo = require('./lib/todo');
const { sortTodos } = require('./lib/sort');
const SessionPersistence = require('./lib/session-persistence');

const app = express();
const host = 'localhost';
const port = 3000;

const LokiStore = store(session);

app.set('views', './views');
app.set('view engine', 'pug');

app.use(morgan('common'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000,
    path: '/',
    secure: false,
  },
  name: 'todos-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'this is not very secure',
  store: new LokiStore({}),
}));

app.use(flash());

// Create new datastore
// Constructor needs access to req.session so that it can access persited data of store
app.use((req, res, next) => {
  res.locals.store = new SessionPersistence(req.session);
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.get('/', (req, res) => {
  res.redirect('/lists');
});

app.get('/lists', (req, res) => {
  let store = res.locals.store;
  let todoLists = store.sortedTodoLists();

  let todosInfo = todoLists.map(todoList => ({
    countAllTodos: todoList.todos.length,
    countDoneTodos: todoList.todos.filter(todo => todo.done).length,
    isDone: store.isDoneTodoList(todoList)
  }));

  res.render('lists', {
    todoLists,
    todosInfo
  });
});

app.get('/lists/new', (req, res) => {
  res.render('new-list');
});

app.get('/lists/:todoListId', (req, res, next) => {
  let store = res.locals.store;
  let { todoListId } = req.params;
  let todoList = store.loadTodoList(+todoListId);

  if (!todoList) {
    next(new Error('Not found.'));
  } else {
    res.render('list', {
      todoList,
      todos: store.sortedTodos(todoList),
      isDoneTodoList: store.isDoneTodoList(todoList),
      hasUndoneTodos: store.hasUndoneTodos(todoList),
    });
  }
});

app.get('/lists/:todoListId/edit', (req, res, next) => {
  let store = res.locals.store;
  let { todoListId } = req.params;
  let todoList = store.loadTodoList(+todoListId);

  if (!todoList) {
    next(new Error('Not found.'));
  } else {
    res.render('edit-list', { todoList });
  }
});

app.post('/lists',
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('A list title is required.')
      .bail()
      .isLength({ max: 100})
      .withMessage('The title must be less than 100 characters')
      .bail()
      .custom((title, { req }) => {
        return req.session.todoLists.every(list => list.title !== title);
      })
      .withMessage('List title already in use.')
  ],
  (req, res) => {
    let errors = validationResult(req);
    let { todoListTitle } = req.body;

    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash('error', error.msg));
      res.render('new-list', {
        flash: req.flash(),
        todoListTitle,
      });

    } else {
      req.session.todoLists.push(new TodoList(todoListTitle));
      req.flash('success', 'The todo list has been created.');
      res.redirect('/lists');
    }
  }
);

app.post('/lists/:todoListId/todos/:todoId/toggle', (req, res, next) => {
  let store = res.locals.store;
  let { todoListId, todoId } = req.params;
  let toggleResult = store.toggleTodo(+todoListId, +todoId);

  if (!toggleResult) {
    next(new Error('Not Found.'));
  } else {
    let todo = store.loadTodo(+todoListId, +todoId);

    if (todo.done) {
      req.flash("success", `"${todo.title}" marked done.`);
    } else {
      req.flash("success", `"${todo.title}" marked as NOT done!`);
    }
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/todos/:todoId/destroy', (req, res, next) => {
  let store = res.locals.store;
  let { todoListId, todoId } = req.params;
  let deletionResult = store.deleteTodo(+todoListId, +todoId);

  if (!deletionResult) {
    next(new Error('Not Found.'));
  } else {

    req.flash('success', 'The todo has been deleted.');
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/complete_all', (req, res, next) => {
  let store = res.locals.store;
  let { todoListId } = req.params;
  let todoList = store.loadTodoList(+todoListId);

  if (!todoList) {
    next(new Error('Not found.'));
  } else {
    let title = todoList.title;

    todoList.markAllDone();
    req.flash('success', `All todos in "${title}" were marked as done!`);
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/todos',
  [
    body('todoTitle')
      .isLength({ min: 1 })
      .withMessage('A title is required.')
      .bail()
      .isLength({ max: 100 })
      .withMessage('The title must be less than 100 characters long.')
  ],
  (req, res, next) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let { todoTitle } = req.body;
    let todoList = store.loadTodoList(+todoListId);

    if (!todoList) {
      next(new Error('Not found.'));
    } else {
      let errors = validationResult(req);

      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash('error', error.msg));
        res.render('list', {
          todoList,
          todos: sortTodos(todoList),
          todoTitle,
          flash: req.flash(),
        });
      } else {
        todoList.add(new Todo(todoTitle));
        req.flash('success', `"${todoTitle}" was added to ${todoList.title}`);
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

app.post('/lists/:todoListId/destroy', (req, res, next) => {
  let store = res.locals.store;
  let { todoListId } = req.params;
  let todoList = store.loadTodoList(+todoListId);
  let todoLists = req.session.todoLists;

  if (!todoList) {
    next(new Error('Not found.'));
  } else {
    todoLists.splice(todoLists.indexOf(todoList), 1);
    req.flash('success', `"${todoList.title}" was successfully deleted!`);
    res.redirect('/lists');
  }
});

app.post('/lists/:todoListId/edit',
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('A list title is required.')
      .bail()
      .isLength({ max: 100})
      .withMessage('The title must be less than 100 characters')
      .bail()
      .custom((title, { req }) => {
        return req.session.todoLists.every(list => list.title !== title);
      })
      .withMessage('List title already in use.')
  ],
  (req, res, next) => {
    let { todoListId } = req.params;
    let { todoListTitle } = req.body;
    let todoList = store.loadTodoList(+todoListId);

    if (!todoList) {
      next(new Error('Not found.'));
    } else {
      let errors = validationResult(req);
      errors.array().forEach(error => req.flash('error', error.msg));

      if (!errors.isEmpty()) {
        res.render('edit-list', {
          todoList,
          todoListTitle,
          flash: req.flash(),
        });
      } else {
        todoList.setTitle(todoListTitle);
        req.flash('success', 'List name was successfully changed!');

        res.redirect(`/lists/${todoListId}`);
      }
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